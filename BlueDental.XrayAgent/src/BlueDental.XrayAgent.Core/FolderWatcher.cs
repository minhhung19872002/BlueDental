using System.Collections.Concurrent;
using System.IO.Enumeration;
using System.Threading.Channels;

namespace BlueDental.XrayAgent.Core;

public static class FileStability
{
    /// <summary>
    /// True once the file has kept the same non-zero size for one
    /// <paramref name="quiet"/> period and nothing else holds it open — the
    /// imaging software has finished writing. False when it vanished or never
    /// settled within <paramref name="maxRounds"/>; the next rescan retries it.
    /// </summary>
    public static async Task<bool> WaitUntilStableAsync(string path, TimeSpan quiet, int maxRounds, CancellationToken ct)
    {
        long previous = -1;
        for (var round = 0; round < maxRounds; round++)
        {
            var file = new FileInfo(path);
            if (!file.Exists)
                return false;

            var size = file.Length;
            if (size > 0 && size == previous && CanOpenExclusively(path))
                return true;

            previous = size;
            await Task.Delay(quiet, ct);
        }

        return false;
    }

    private static bool CanOpenExclusively(string path)
    {
        try
        {
            using var _ = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.None);
            return true;
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }
}

/// <summary>
/// Watches the picture folder: FileSystemWatcher for speed, plus a full
/// rescan every minute because watchers miss events (buffer overflow, network
/// shares). One consumer sends files one at a time.
/// </summary>
public sealed class FolderWatcher : IAsyncDisposable
{
    private const int MaxStableRounds = 30;

    private readonly string _folder;
    private readonly bool _includeSubfolders;
    private readonly UploadPipeline _pipeline;
    private readonly IAgentLog _log;
    private readonly TimeSpan _rescanEvery;
    private readonly TimeSpan _quiet;
    private readonly Channel<string> _queue = Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true });
    private readonly ConcurrentDictionary<string, byte> _queued = new(StringComparer.OrdinalIgnoreCase);
    private readonly CancellationTokenSource _cts = new();
    private FileSystemWatcher? _watcher;
    private Task _consumer = Task.CompletedTask;
    private Task _rescanner = Task.CompletedTask;

    public FolderWatcher(
        string folder,
        bool includeSubfolders,
        UploadPipeline pipeline,
        IAgentLog log,
        TimeSpan? rescanEvery = null,
        TimeSpan? quiet = null)
    {
        _folder = folder;
        _includeSubfolders = includeSubfolders;
        _pipeline = pipeline;
        _log = log;
        _rescanEvery = rescanEvery ?? TimeSpan.FromSeconds(60);
        _quiet = quiet ?? TimeSpan.FromSeconds(2);
    }

    /// <summary>Raised after each file the pipeline handled (any outcome but Skipped).</summary>
    public event Action<UploadOutcome>? Processed;

    public void Start()
    {
        _watcher = new FileSystemWatcher(_folder)
        {
            IncludeSubdirectories = _includeSubfolders,
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size,
            InternalBufferSize = 64 * 1024,
        };
        _watcher.Created += (_, e) => Enqueue(e.FullPath);
        _watcher.Changed += (_, e) => Enqueue(e.FullPath);
        _watcher.Renamed += (_, e) => Enqueue(e.FullPath);
        _watcher.Error += (_, e) =>
        {
            _log.Warn($"folder watcher error: {LogSafe.Describe(e.GetException())}; rescanning");
            Rescan();
        };
        _watcher.EnableRaisingEvents = true;

        _consumer = Task.Run(ConsumeAsync);
        _rescanner = Task.Run(RescanLoopAsync);
        _log.Info("watching started");
    }

    /// <summary>Puts every eligible picture under the folder in the queue.</summary>
    public void Rescan()
    {
        try
        {
            var options = new EnumerationOptions
            {
                RecurseSubdirectories = _includeSubfolders,
                IgnoreInaccessible = true,
                AttributesToSkip = FileAttributes.Hidden | FileAttributes.System,
            };
            var files = new FileSystemEnumerable<string>(_folder, (ref FileSystemEntry entry) => entry.ToFullPath(), options)
            {
                ShouldIncludePredicate = (ref FileSystemEntry entry) =>
                    !entry.IsDirectory
                    && UploadPipeline.HasImageExtension(entry.FileName.ToString())
                    && _pipeline.IsRecentEnough(entry.LastWriteTimeUtc.UtcDateTime),
            };
            foreach (var path in files)
                Enqueue(path);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            _log.Warn($"rescan failed: {LogSafe.Describe(e)}");
        }
    }

    private void Enqueue(string path)
    {
        if (UploadPipeline.HasImageExtension(path) && _queued.TryAdd(path, 0))
            _queue.Writer.TryWrite(path);
    }

    private async Task RescanLoopAsync()
    {
        Rescan();
        using var timer = new PeriodicTimer(_rescanEvery);
        try
        {
            while (await timer.WaitForNextTickAsync(_cts.Token))
                Rescan();
        }
        catch (OperationCanceledException)
        {
            // Stopping.
        }
    }

    private async Task ConsumeAsync()
    {
        var ct = _cts.Token;
        try
        {
            await foreach (var path in _queue.Reader.ReadAllAsync(ct))
            {
                _queued.TryRemove(path, out _);
                await HandleAsync(path, ct);
            }
        }
        catch (OperationCanceledException)
        {
            // Stopping.
        }
    }

    private async Task HandleAsync(string path, CancellationToken ct)
    {
        try
        {
            if (_pipeline.Look(path) != Triage.Ready)
                return;
            if (!await FileStability.WaitUntilStableAsync(path, _quiet, MaxStableRounds, ct))
                return;

            var result = await _pipeline.ProcessAsync(path, ct);
            if (result.Outcome != UploadOutcome.Skipped)
                Processed?.Invoke(result.Outcome);
            if (result.RetryAfter is { } delay && delay > TimeSpan.Zero)
                _ = RetryLaterAsync(path, delay, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception e)
        {
            _log.Error($"processing failed: {LogSafe.Describe(e)}");
        }
    }

    private async Task RetryLaterAsync(string path, TimeSpan delay, CancellationToken ct)
    {
        try
        {
            await Task.Delay(delay, ct);
            Enqueue(path);
        }
        catch (OperationCanceledException)
        {
            // Stopping; the next start rescans anyway.
        }
    }

    public async ValueTask DisposeAsync()
    {
        await _cts.CancelAsync();
        _watcher?.Dispose();
        _queue.Writer.TryComplete();
        await Task.WhenAll(_consumer, _rescanner);
        _cts.Dispose();
    }
}
