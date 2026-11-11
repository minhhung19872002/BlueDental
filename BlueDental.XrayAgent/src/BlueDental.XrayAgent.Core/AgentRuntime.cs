namespace BlueDental.XrayAgent.Core;

public enum WatchState
{
    /// <summary>No folder set.</summary>
    Off,
    Watching,
    FolderMissing,
}

/// <summary>
/// Everything one set of settings runs: the station client, the upload
/// pipeline with its folder watcher, and the EzDent-i bridge. Settings change
/// → dispose this one, start a new one.
/// </summary>
public sealed class AgentRuntime : IAsyncDisposable
{
    private readonly StationClient _station;
    private readonly FolderWatcher? _watcher;

    private AgentRuntime(StationClient station, UploadPipeline pipeline, EzdentBridge bridge, FolderWatcher? watcher, WatchState state)
    {
        _station = station;
        Pipeline = pipeline;
        Bridge = bridge;
        _watcher = watcher;
        WatchState = state;
    }

    public UploadPipeline Pipeline { get; }
    public EzdentBridge Bridge { get; }
    public WatchState WatchState { get; }
    public FolderWatcher? Watcher => _watcher;

    public static AgentRuntime Start(
        AgentSettings settings,
        string token,
        string dataFolder,
        IProcessLauncher launcher,
        IAgentLog log,
        TimeProvider time,
        HttpMessageHandler? handler = null)
    {
        var station = new StationClient(settings.ServerUrl, token, handler);
        var ledger = UploadLedger.Load(Path.Combine(dataFolder, "state.json"), time.GetUtcNow());
        var parser = new HintParser(settings.FileNamePattern, settings.CodeFromParentFolder);
        var pipeline = new UploadPipeline(settings, parser, ledger, station, log, time);
        var bridge = new EzdentBridge(settings, station, launcher, log, dataFolder);

        FolderWatcher? watcher = null;
        var state = WatchState.Off;
        if (!string.IsNullOrWhiteSpace(settings.WatchFolder))
        {
            if (Directory.Exists(settings.WatchFolder))
            {
                watcher = new FolderWatcher(settings.WatchFolder, settings.IncludeSubfolders, pipeline, log);
                watcher.Start();
                state = WatchState.Watching;
            }
            else
            {
                log.Warn("watch folder not found; sending is off");
                state = WatchState.FolderMissing;
            }
        }

        return new AgentRuntime(station, pipeline, bridge, watcher, state);
    }

    public Task<StationResult<StationInfo>> PingAsync(CancellationToken ct) => _station.PingAsync(ct);

    public async ValueTask DisposeAsync()
    {
        if (_watcher is not null)
            await _watcher.DisposeAsync();
        _station.Dispose();
    }
}
