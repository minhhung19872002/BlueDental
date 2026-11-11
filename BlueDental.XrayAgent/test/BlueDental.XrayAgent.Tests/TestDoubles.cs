using System.Net;
using System.Text;
using BlueDental.XrayAgent.Core;

namespace BlueDental.XrayAgent.Tests;

internal sealed class ManualTime(DateTimeOffset start) : TimeProvider
{
    public DateTimeOffset Now { get; set; } = start;

    public override DateTimeOffset GetUtcNow() => Now;
}

internal sealed class RecordingLog : IAgentLog
{
    public List<string> Lines { get; } = [];

    public void Info(string message) => Lines.Add("INFO " + message);
    public void Warn(string message) => Lines.Add("WARN " + message);
    public void Error(string message) => Lines.Add("ERROR " + message);
}

/// <summary>Answers station calls from a queue; records each upload's hints and bytes.</summary>
internal sealed class FakeStation : IStationApi
{
    public Queue<StationResult<UploadReceipt>> UploadAnswers { get; } = new();
    public StationResult<StationPatient> PatientAnswer { get; set; } =
        new(null, StationFailure.NotFound, "BlueDental:Imaging:0009");
    public List<(FileNameHints Hints, string FileName, string ContentType, byte[] Bytes)> Uploads { get; } = [];
    public List<string> LookedUp { get; } = [];

    public Task<StationResult<StationInfo>> PingAsync(CancellationToken ct) =>
        Task.FromResult(StationResult<StationInfo>.Ok(new StationInfo("Máy 1", "CN 1")));

    public async Task<StationResult<UploadReceipt>> UploadAsync(StationUpload upload, CancellationToken ct)
    {
        using var copy = new MemoryStream();
        await upload.Content.CopyToAsync(copy, ct);
        Uploads.Add((upload.Hints, upload.FileName, upload.ContentType, copy.ToArray()));
        return UploadAnswers.Count > 0 ? UploadAnswers.Dequeue() : StationResult<UploadReceipt>.Ok(new UploadReceipt(1, false));
    }

    public Task<StationResult<StationPatient>> GetPatientByCodeAsync(string code, CancellationToken ct)
    {
        LookedUp.Add(code);
        return Task.FromResult(PatientAnswer);
    }
}

/// <summary>Captures the request and answers with a canned response.</summary>
internal sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
{
    public HttpRequestMessage? Request { get; private set; }
    public string? RequestBody { get; private set; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Request = request;
        if (request.Content is not null)
            RequestBody = await request.Content.ReadAsStringAsync(ct);
        return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
    }
}

internal sealed class TempFolder : IDisposable
{
    public TempFolder()
    {
        Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "bd-xray-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path);
    }

    public string Path { get; }

    public string Write(string relative, byte[] content, DateTime? lastWriteUtc = null)
    {
        var full = System.IO.Path.Combine(Path, relative);
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(full)!);
        File.WriteAllBytes(full, content);
        if (lastWriteUtc is { } when)
            File.SetLastWriteTimeUtc(full, when);
        return full;
    }

    public void Dispose()
    {
        try
        {
            Directory.Delete(Path, recursive: true);
        }
        catch (IOException)
        {
            // A file a test still held; the OS temp cleaner takes it.
        }
    }
}
