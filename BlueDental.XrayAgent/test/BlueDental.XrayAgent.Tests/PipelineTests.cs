using BlueDental.XrayAgent.Core;

namespace BlueDental.XrayAgent.Tests;

public sealed class UploadPipelineTests : IDisposable
{
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3];
    private static readonly DateTime Written = new(2026, 11, 11, 1, 0, 0, DateTimeKind.Utc);

    private readonly TempFolder _temp = new();
    private readonly ManualTime _time = new(new DateTimeOffset(2026, 11, 11, 2, 0, 0, TimeSpan.Zero));
    private readonly RecordingLog _log = new();
    private readonly FakeStation _station = new();
    private readonly UploadLedger _ledger;
    private readonly AgentSettings _settings = new();

    public UploadPipelineTests()
    {
        _ledger = UploadLedger.Load(null, _time.Now);
    }

    public void Dispose() => _temp.Dispose();

    private UploadPipeline Pipeline() => new(
        _settings, new HintParser(_settings.FileNamePattern, _settings.CodeFromParentFolder), _ledger, _station, _log, _time);

    [Fact]
    public async Task Sends_once_with_the_code_and_logs_no_name()
    {
        var path = _temp.Write("DH260052_Tran Van B.jpg", Jpeg, Written);
        var pipeline = Pipeline();

        var first = await pipeline.ProcessAsync(path, CancellationToken.None);
        var again = await pipeline.ProcessAsync(path, CancellationToken.None);

        first.Outcome.ShouldBe(UploadOutcome.Sent);
        again.Outcome.ShouldBe(UploadOutcome.Skipped);
        _station.Uploads.Count.ShouldBe(1);
        _station.Uploads[0].Hints.Code.ShouldBe("DH260052");
        _station.Uploads[0].ContentType.ShouldBe("image/jpeg");
        _station.Uploads[0].Bytes.ShouldBe(Jpeg);
        _log.Lines.ShouldAllBe(line => !line.Contains("Tran") && !line.Contains(_temp.Path));
        _log.Lines.ShouldContain(line => line.Contains("code=DH260052") && line.Contains("sha="));
    }

    [Fact]
    public async Task A_file_without_a_code_still_goes_up_for_the_inbox()
    {
        var path = _temp.Write("IMG_0001.png", Jpeg, Written);

        var result = await Pipeline().ProcessAsync(path, CancellationToken.None);

        result.Outcome.ShouldBe(UploadOutcome.Sent);
        _station.Uploads.Single().Hints.Code.ShouldBeNull();
        _station.Uploads.Single().ContentType.ShouldBe("image/png");
    }

    [Fact]
    public void Ignores_other_extensions_and_pictures_older_than_start()
    {
        _settings.StartFrom = new DateTimeOffset(Written.AddMinutes(1));
        var pipeline = Pipeline();

        pipeline.Look(_temp.Write("DH260052.dcm", Jpeg, Written.AddHours(1))).ShouldBe(Triage.Ignore);
        pipeline.Look(_temp.Write("DH260052.jpg", Jpeg, Written)).ShouldBe(Triage.Ignore);
        pipeline.Look(_temp.Write("DH260053.jpg", Jpeg, Written.AddHours(1))).ShouldBe(Triage.Ready);
    }

    [Fact]
    public async Task Unavailable_backs_off_then_retries()
    {
        _station.UploadAnswers.Enqueue(new StationResult<UploadReceipt>(null, StationFailure.Unavailable, "HTTP 502"));
        var path = _temp.Write("DH260052.jpg", Jpeg, Written);
        var pipeline = Pipeline();

        var failed = await pipeline.ProcessAsync(path, CancellationToken.None);
        pipeline.Look(path).ShouldBe(Triage.Waiting);
        _time.Now += TimeSpan.FromSeconds(6);
        var retried = await pipeline.ProcessAsync(path, CancellationToken.None);

        failed.ShouldBe(new PipelineResult(UploadOutcome.Retrying, TimeSpan.FromSeconds(5)));
        retried.Outcome.ShouldBe(UploadOutcome.Sent);
        _station.Uploads.Count.ShouldBe(2);
    }

    [Fact]
    public async Task Rejected_is_never_sent_again()
    {
        _station.UploadAnswers.Enqueue(new StationResult<UploadReceipt>(null, StationFailure.Rejected, "BlueDental:Imaging:0003"));
        var path = _temp.Write("DH260052.jpg", Jpeg, Written);
        var pipeline = Pipeline();

        (await pipeline.ProcessAsync(path, CancellationToken.None)).Outcome.ShouldBe(UploadOutcome.Rejected);

        pipeline.Look(path).ShouldBe(Triage.Finished);
    }

    [Fact]
    public async Task A_refused_token_pauses_everything_and_raises_once()
    {
        _station.UploadAnswers.Enqueue(new StationResult<UploadReceipt>(null, StationFailure.Unauthorized, "BlueDental:Imaging:0002"));
        var first = _temp.Write("DH260052.jpg", Jpeg, Written);
        var second = _temp.Write("DH260053.jpg", Jpeg, Written);
        var pipeline = Pipeline();
        var raised = 0;
        pipeline.AuthorizationLost += () => raised++;

        (await pipeline.ProcessAsync(first, CancellationToken.None)).Outcome.ShouldBe(UploadOutcome.Paused);
        (await pipeline.ProcessAsync(second, CancellationToken.None)).Outcome.ShouldBe(UploadOutcome.Paused);

        raised.ShouldBe(1);
        _station.Uploads.Count.ShouldBe(1);
        _ledger.IsFinished(UploadLedger.Fingerprint(first, Jpeg.Length, Written)).ShouldBeFalse();
    }

    [Fact]
    public async Task Duplicate_counts_as_done()
    {
        _station.UploadAnswers.Enqueue(StationResult<UploadReceipt>.Ok(new UploadReceipt(2, true)));
        var path = _temp.Write("DH260052.jpg", Jpeg, Written);
        var pipeline = Pipeline();

        (await pipeline.ProcessAsync(path, CancellationToken.None)).Outcome.ShouldBe(UploadOutcome.Duplicate);
        pipeline.Look(path).ShouldBe(Triage.Finished);
    }
}

public sealed class FolderWatcherTests
{
    [Fact]
    public async Task Picks_up_a_new_picture_and_sends_it()
    {
        using var temp = new TempFolder();
        var station = new FakeStation();
        var settings = new AgentSettings();
        var pipeline = new UploadPipeline(
            settings, new HintParser(settings.FileNamePattern, false), UploadLedger.Load(null, DateTimeOffset.UtcNow),
            station, new RecordingLog(), TimeProvider.System);
        var done = new TaskCompletionSource<UploadOutcome>(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var watcher = new FolderWatcher(
            temp.Path, includeSubfolders: true, pipeline, new RecordingLog(),
            rescanEvery: TimeSpan.FromSeconds(1), quiet: TimeSpan.FromMilliseconds(100));
        watcher.Processed += outcome => done.TrySetResult(outcome);

        watcher.Start();
        temp.Write(Path.Combine("sub", "DH260052.jpg"), [0xFF, 0xD8, 0xFF, 9]);

        (await done.Task.WaitAsync(TimeSpan.FromSeconds(15))).ShouldBe(UploadOutcome.Sent);
        station.Uploads.Single().Hints.Code.ShouldBe("DH260052");
    }

    [Fact]
    public async Task Stability_waits_for_a_non_empty_settled_file()
    {
        using var temp = new TempFolder();
        var empty = temp.Write("a.jpg", []);
        var full = temp.Write("b.jpg", [1, 2, 3]);

        (await FileStability.WaitUntilStableAsync(empty, TimeSpan.FromMilliseconds(10), 3, CancellationToken.None)).ShouldBeFalse();
        (await FileStability.WaitUntilStableAsync(full, TimeSpan.FromMilliseconds(10), 3, CancellationToken.None)).ShouldBeTrue();
        (await FileStability.WaitUntilStableAsync(Path.Combine(temp.Path, "gone.jpg"), TimeSpan.FromMilliseconds(10), 3, CancellationToken.None)).ShouldBeFalse();
    }
}
