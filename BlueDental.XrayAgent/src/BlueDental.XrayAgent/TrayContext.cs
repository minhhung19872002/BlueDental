using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using BlueDental.XrayAgent.Core;

namespace BlueDental.XrayAgent;

/// <summary>
/// The tray icon and everything behind it. Work from the watcher and the
/// pipe arrives on pool threads and is marshalled to the UI thread through
/// <see cref="_ui"/> before it touches the menu or shows a balloon.
/// </summary>
internal sealed class TrayContext : ApplicationContext
{
    private readonly SettingsStore _store = new(AgentPaths.SettingsFile);
    private readonly DpapiTokenProtector _protector = new();
    private readonly FileAgentLog _log = new(AgentPaths.LogFolder, TimeProvider.System);
    private readonly Control _ui = new();
    private readonly CancellationTokenSource _cts = new();
    private readonly NotifyIcon _icon;
    private readonly ToolStripMenuItem _connection = new() { Enabled = false };
    private readonly ToolStripMenuItem _watch = new() { Enabled = false };
    private readonly ToolStripMenuItem _counters = new() { Enabled = false };
    private AgentSettings _settings;
    private AgentRuntime? _runtime;
    private int _sent, _retrying, _rejected;

    public TrayContext(SingleInstance instance, string? pendingCode)
    {
        _ui.CreateControl();
        _settings = _store.Load();
        _icon = new NotifyIcon
        {
            Icon = CreateTrayIcon(),
            Text = Strings.AppName,
            ContextMenuStrip = BuildMenu(),
            Visible = true,
        };
        _icon.DoubleClick += (_, _) => ShowSettings();

        _ = instance.ListenAsync(OnPipeMessage, _cts.Token);
        _ = RestartAsync(pendingCode);
    }

    private ContextMenuStrip BuildMenu()
    {
        var menu = new ContextMenuStrip();
        var status = new ToolStripMenuItem(Strings.MenuStatus) { Enabled = false, Font = new Font(menu.Font, FontStyle.Bold) };
        menu.Items.AddRange(
        [
            status,
            _connection,
            _watch,
            _counters,
            new ToolStripSeparator(),
            new ToolStripMenuItem(Strings.MenuSettings, null, (_, _) => ShowSettings()),
            new ToolStripMenuItem(Strings.MenuOpenWatchFolder, null, (_, _) => OpenFolder(_settings.WatchFolder)),
            new ToolStripMenuItem(Strings.MenuOpenLogFolder, null, (_, _) => OpenFolder(AgentPaths.LogFolder)),
            new ToolStripSeparator(),
            new ToolStripMenuItem(Strings.MenuExit, null, async (_, _) => await ExitAsync()),
        ]);
        return menu;
    }

    /// <summary>Stops what runs, starts again from the saved settings, then opens a pending record.</summary>
    private async Task RestartAsync(string? pendingCode = null)
    {
        if (_runtime is not null)
        {
            await _runtime.DisposeAsync();
            _runtime = null;
        }

        _sent = _retrying = _rejected = 0;
        UpdateCounters();

        var token = _settings.IsConfigured ? _settings.ReadToken(_protector) : null;
        if (token is null)
        {
            _connection.Text = _settings.IsConfigured ? Strings.StatusTokenUnreadable : Strings.StatusNotConfigured;
            _watch.Text = Strings.WatchOff;
            if (pendingCode is not null)
                Balloon(Strings.OpenNotConfigured, ToolTipIcon.Warning);
            ShowSettings();
            return;
        }

        try
        {
            _runtime = AgentRuntime.Start(_settings, token, AgentPaths.DataFolder, new ProcessLauncher(), _log, TimeProvider.System);
        }
        catch (Exception e) when (e is ArgumentException or UriFormatException or IOException)
        {
            _log.Error($"agent did not start: {LogSafe.Describe(e)}");
            _connection.Text = Strings.StatusNotConfigured;
            return;
        }

        _runtime.Pipeline.AuthorizationLost += () => Post(() =>
        {
            _connection.Text = Strings.StatusTokenRefused;
            Balloon(Strings.TokenRefusedBalloon, ToolTipIcon.Error);
        });
        if (_runtime.Watcher is { } watcher)
            watcher.Processed += outcome => Post(() => Count(outcome));
        _watch.Text = _runtime.WatchState switch
        {
            WatchState.Watching => Strings.WatchOn,
            WatchState.FolderMissing => Strings.WatchFolderMissing,
            _ => Strings.WatchOff,
        };

        if (pendingCode is not null)
            await OpenRecordAsync(pendingCode);
        await RefreshConnectionAsync();
    }

    private async Task RefreshConnectionAsync()
    {
        if (_runtime is not { } runtime)
            return;
        _connection.Text = Strings.StatusConnecting;
        StationResult<StationInfo> answer;
        try
        {
            answer = await runtime.PingAsync(_cts.Token);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        _connection.Text = answer switch
        {
            { Value: { } info } => string.Format(Strings.StatusConnected, info.DeviceName, info.BranchName),
            { Failure: StationFailure.Unauthorized } => Strings.StatusTokenRefused,
            _ => string.Format(Strings.StatusOffline, answer.Detail),
        };
    }

    private void OnPipeMessage(string message)
    {
        if (AgentLink.TryParse(message, out var code))
            Post(async () => await OpenRecordAsync(code));
    }

    private async Task OpenRecordAsync(string code)
    {
        if (_runtime is not { } runtime)
        {
            Balloon(Strings.OpenNotConfigured, ToolTipIcon.Warning);
            return;
        }

        BridgeOutcome outcome;
        try
        {
            outcome = await runtime.Bridge.OpenAsync(code, _cts.Token);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        var message = outcome switch
        {
            BridgeOutcome.Opened => null,
            BridgeOutcome.LoaderMissing => string.Format(Strings.OpenLoaderMissing, _settings.LoaderName),
            BridgeOutcome.PatientNotFound => string.Format(Strings.OpenPatientNotFound, code),
            BridgeOutcome.Unauthorized => Strings.OpenUnauthorized,
            BridgeOutcome.ServerUnavailable => Strings.OpenServerUnavailable,
            BridgeOutcome.WriteFailed => Strings.OpenWriteFailed,
            _ => Strings.OpenLaunchFailed,
        };
        if (message is not null)
            Balloon(message, ToolTipIcon.Warning);
    }

    private void Count(UploadOutcome outcome)
    {
        switch (outcome)
        {
            case UploadOutcome.Sent or UploadOutcome.Duplicate:
                _sent++;
                break;
            case UploadOutcome.Retrying:
                _retrying++;
                break;
            case UploadOutcome.Rejected:
                _rejected++;
                Balloon(Strings.RejectedBalloon, ToolTipIcon.Warning);
                break;
        }

        UpdateCounters();
    }

    private void UpdateCounters() =>
        _counters.Text = string.Format(Strings.Counters, _sent, _retrying, _rejected);

    private bool _settingsOpen;

    private async void ShowSettings()
    {
        if (_settingsOpen)
            return;
        _settingsOpen = true;
        try
        {
            using var form = new SettingsForm(_settings, _protector);
            if (form.ShowDialog() != DialogResult.OK)
                return;

            _settings = form.Result;
            _store.Save(_settings);
            _log.Info("settings saved");
            await RestartAsync();
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            _log.Error($"settings not saved: {LogSafe.Describe(e)}");
        }
        finally
        {
            _settingsOpen = false;
        }
    }

    private static void OpenFolder(string folder)
    {
        if (string.IsNullOrWhiteSpace(folder) || !Directory.Exists(folder))
            return;
        using var _ = Process.Start(new ProcessStartInfo("explorer.exe", $"\"{folder}\"") { UseShellExecute = true });
    }

    private void Balloon(string text, ToolTipIcon icon) => _icon.ShowBalloonTip(5000, Strings.AppName, text, icon);

    private void Post(Action action)
    {
        if (!_ui.IsDisposed)
            _ui.BeginInvoke(action);
    }

    private async Task ExitAsync()
    {
        await _cts.CancelAsync();
        if (_runtime is not null)
            await _runtime.DisposeAsync();
        _icon.Visible = false;
        ExitThread();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _icon.Dispose();
            _ui.Dispose();
            _cts.Dispose();
        }

        base.Dispose(disposing);
    }

    /// <summary>A blue disc with an "X", drawn at start so the exe needs no icon file.</summary>
    private static Icon CreateTrayIcon()
    {
        using var bitmap = new Bitmap(32, 32);
        using (var g = Graphics.FromImage(bitmap))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
            using var disc = new SolidBrush(Color.FromArgb(37, 99, 235));
            g.FillEllipse(disc, 1, 1, 30, 30);
            using var font = new Font("Segoe UI", 17, FontStyle.Bold, GraphicsUnit.Pixel);
            using var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            g.DrawString("X", font, Brushes.White, new RectangleF(0, 0, 32, 32), format);
        }

        var handle = bitmap.GetHicon();
        try
        {
            using var borrowed = Icon.FromHandle(handle);
            return (Icon)borrowed.Clone();
        }
        finally
        {
            DestroyIcon(handle);
        }
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DestroyIcon(IntPtr handle);
}
