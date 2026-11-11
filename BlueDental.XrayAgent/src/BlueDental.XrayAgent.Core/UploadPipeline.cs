using System.Security.Cryptography;

namespace BlueDental.XrayAgent.Core;

public enum Triage
{
    /// <summary>Not a picture we send (extension, older than StartFrom, gone).</summary>
    Ignore,
    /// <summary>Already sent or refused for good.</summary>
    Finished,
    /// <summary>Failed before; its backoff has not run out.</summary>
    Waiting,
    /// <summary>The token stopped working; nothing goes out until it is replaced.</summary>
    Paused,
    Ready,
}

public enum UploadOutcome
{
    Sent,
    Duplicate,
    Rejected,
    Retrying,
    Paused,
    Skipped,
}

public sealed record PipelineResult(UploadOutcome Outcome, TimeSpan? RetryAfter = null);

/// <summary>
/// Sends one picture: reads what its name says, sends it, and records the
/// answer in the ledger. The log line names the customer code and the first
/// 12 hex of the file's SHA-256 — never the file name, which may hold a name.
/// </summary>
public sealed class UploadPipeline(
    AgentSettings settings,
    HintParser parser,
    UploadLedger ledger,
    IStationApi station,
    IAgentLog log,
    TimeProvider time)
{
    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
    };

    private int _paused;

    /// <summary>Raised once when the server says the token is no longer valid.</summary>
    public event Action? AuthorizationLost;

    public bool IsPaused => Volatile.Read(ref _paused) == 1;

    public static bool HasImageExtension(string path) => ContentTypes.ContainsKey(Path.GetExtension(path));

    /// <summary>Whether a file written at this time is new enough to send.</summary>
    public bool IsRecentEnough(DateTime lastWriteUtc) =>
        settings.StartFrom is not { } start || lastWriteUtc >= start.UtcDateTime;

    /// <summary>Cheap look, before waiting for the file to settle.</summary>
    public Triage Look(string path)
    {
        if (IsPaused)
            return Triage.Paused;
        if (!HasImageExtension(path))
            return Triage.Ignore;

        var file = new FileInfo(path);
        if (!file.Exists || !IsRecentEnough(file.LastWriteTimeUtc))
            return Triage.Ignore;

        var key = UploadLedger.Fingerprint(file.FullName, file.Length, file.LastWriteTimeUtc);
        if (ledger.IsFinished(key))
            return Triage.Finished;
        return ledger.NextAttempt(key) is { } next && next > time.GetUtcNow() ? Triage.Waiting : Triage.Ready;
    }

    public async Task<PipelineResult> ProcessAsync(string path, CancellationToken ct)
    {
        switch (Look(path))
        {
            case Triage.Paused:
                return new PipelineResult(UploadOutcome.Paused);
            case Triage.Waiting:
                var next = ledger.NextAttempt(KeyOf(new FileInfo(path)));
                return new PipelineResult(UploadOutcome.Skipped, next - time.GetUtcNow());
            case not Triage.Ready:
                return new PipelineResult(UploadOutcome.Skipped);
        }

        var file = new FileInfo(path);
        var key = KeyOf(file);
        var now = time.GetUtcNow();
        var hints = parser.Parse(file.FullName, now.Year);
        var codeTag = hints.Code ?? "-";

        string shaTag;
        StationResult<UploadReceipt> result;
        try
        {
            await using var stream = new FileStream(file.FullName, FileMode.Open, FileAccess.Read, FileShare.Read);
            shaTag = Convert.ToHexStringLower(await SHA256.HashDataAsync(stream, ct))[..12];
            stream.Position = 0;
            result = await station.UploadAsync(
                new StationUpload(stream, file.Name, ContentTypes[file.Extension], hints, new DateTimeOffset(file.LastWriteTimeUtc)),
                ct);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            var wait = ledger.MarkFailed(key, now, "read failed");
            log.Warn($"read failed code={codeTag}: {LogSafe.Describe(e)}; retry in {wait.TotalSeconds:0}s");
            return new PipelineResult(UploadOutcome.Retrying, wait);
        }

        var tag = $"code={codeTag} sha={shaTag}";
        if (result.Value is { } receipt)
        {
            ledger.MarkSent(key, now, receipt.Duplicate ? "duplicate" : $"status {receipt.Status}");
            log.Info($"sent {tag} status={receipt.Status}{(receipt.Duplicate ? " duplicate" : string.Empty)}");
            return new PipelineResult(receipt.Duplicate ? UploadOutcome.Duplicate : UploadOutcome.Sent);
        }

        switch (result.Failure)
        {
            case StationFailure.Unauthorized:
                log.Error($"token refused ({result.Detail}); sending paused until the token is replaced");
                if (Interlocked.Exchange(ref _paused, 1) == 0)
                    AuthorizationLost?.Invoke();
                return new PipelineResult(UploadOutcome.Paused);

            case StationFailure.Rejected or StationFailure.NotFound:
                ledger.MarkRejected(key, now, result.Detail);
                log.Warn($"refused {tag}: {result.Detail}");
                return new PipelineResult(UploadOutcome.Rejected);

            default:
                var wait = ledger.MarkFailed(key, now, result.Detail);
                log.Warn($"not sent {tag}: {result.Detail}; retry in {wait.TotalSeconds:0}s");
                return new PipelineResult(UploadOutcome.Retrying, wait);
        }
    }

    private static string KeyOf(FileInfo file) =>
        UploadLedger.Fingerprint(file.FullName, file.Length, file.LastWriteTimeUtc);
}
