using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace BlueDental.XrayAgent.Core;

/// <summary>Why a station call did not give an answer.</summary>
public enum StationFailure
{
    None,
    /// <summary>Token unknown or revoked — stop and ask for a new one.</summary>
    Unauthorized,
    /// <summary>No record with that code in the device's branch.</summary>
    NotFound,
    /// <summary>The server refused this request for good (not an image, too large, infected).</summary>
    Rejected,
    /// <summary>Network, timeout, 5xx, scanner down — try again later.</summary>
    Unavailable,
}

public sealed record StationResult<T>(T? Value, StationFailure Failure, string Detail) where T : class
{
    public static StationResult<T> Ok(T value) => new(value, StationFailure.None, "ok");
}

public sealed record StationInfo(string DeviceName, string BranchName);

public sealed record StationUpload(
    Stream Content,
    string FileName,
    string ContentType,
    FileNameHints Hints,
    DateTimeOffset? CapturedAt);

public sealed record UploadReceipt(int Status, bool Duplicate);

/// <summary>The three calls the agent makes, all under <c>api/v1/public/xray-station</c>.</summary>
public interface IStationApi
{
    Task<StationResult<StationInfo>> PingAsync(CancellationToken ct);
    Task<StationResult<UploadReceipt>> UploadAsync(StationUpload upload, CancellationToken ct);
    Task<StationResult<StationPatient>> GetPatientByCodeAsync(string code, CancellationToken ct);
}

public enum ServerUrlProblem
{
    None,
    Invalid,
    /// <summary>Plain http to anything but this PC — the token would cross the network in clear.</summary>
    InsecureHttp,
}

/// <summary>
/// Talks to BlueDental with the device token in <c>X-Xray-Device-Token</c>.
/// ABP answers a business error as 403 with a code in the body, so the code —
/// not the status — decides between "token gone", "refused" and "retry".
/// </summary>
public sealed class StationClient : IStationApi, IDisposable
{
    public const string TokenHeader = "X-Xray-Device-Token";
    public const string BasePath = "api/v1/public/xray-station/";

    /// <summary>BlueDental's Imaging error codes (BlueDentalDomainErrorCodes.Imaging).</summary>
    public static class ErrorCodes
    {
        public const string DeviceNotPaired = "BlueDental:Imaging:0002";
        public const string InvalidImage = "BlueDental:Imaging:0003";
        public const string ImageTooLarge = "BlueDental:Imaging:0004";
        public const string ImageInfected = "BlueDental:Imaging:0005";
        public const string MalwareScanUnavailable = "BlueDental:Imaging:0006";
        public const string PatientUnavailable = "BlueDental:Imaging:0009";
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly HttpClient _http;

    public StationClient(string serverUrl, string token, HttpMessageHandler? handler = null)
    {
        _http = handler is null ? new HttpClient() : new HttpClient(handler, disposeHandler: false);
        _http.BaseAddress = BuildBase(serverUrl);
        _http.Timeout = TimeSpan.FromMinutes(5);
        _http.DefaultRequestHeaders.Add(TokenHeader, token.Trim());
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        _http.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("BlueDental.XrayAgent", "1.0"));
    }

    public static ServerUrlProblem ValidateServerUrl(string? serverUrl)
    {
        if (!Uri.TryCreate(serverUrl?.Trim(), UriKind.Absolute, out var uri)
            || uri.Scheme is not ("http" or "https")
            || !string.IsNullOrEmpty(uri.Query))
            return ServerUrlProblem.Invalid;
        return uri.Scheme == "http" && !uri.IsLoopback ? ServerUrlProblem.InsecureHttp : ServerUrlProblem.None;
    }

    public static Uri BuildBase(string serverUrl) =>
        new(serverUrl.Trim().TrimEnd('/') + "/" + BasePath, UriKind.Absolute);

    public Task<StationResult<StationInfo>> PingAsync(CancellationToken ct) =>
        SendAsync(() => new HttpRequestMessage(HttpMethod.Get, string.Empty), ReadStationAsync, ct);

    public Task<StationResult<UploadReceipt>> UploadAsync(StationUpload upload, CancellationToken ct) =>
        SendAsync(() => new HttpRequestMessage(HttpMethod.Post, "images") { Content = BuildForm(upload) }, ReadReceiptAsync, ct);

    public Task<StationResult<StationPatient>> GetPatientByCodeAsync(string code, CancellationToken ct) =>
        SendAsync(
            () => new HttpRequestMessage(HttpMethod.Get, "patients/by-code?code=" + Uri.EscapeDataString(code)),
            ReadPatientAsync,
            ct);

    public void Dispose() => _http.Dispose();

    private static MultipartFormDataContent BuildForm(StationUpload upload)
    {
        var form = new MultipartFormDataContent();
        var file = new StreamContent(upload.Content);
        file.Headers.ContentType = new MediaTypeHeaderValue(upload.ContentType);
        form.Add(file, "file", upload.FileName);
        if (upload.Hints.Code is { } code)
            form.Add(new StringContent(code), "code");
        if (upload.Hints.Name is { } name)
            form.Add(new StringContent(name), "name");
        if (upload.Hints.BirthYear is { } year)
            form.Add(new StringContent(year.ToString(CultureInfo.InvariantCulture)), "birthYear");
        if (upload.CapturedAt is { } captured)
            form.Add(new StringContent(captured.ToString("O", CultureInfo.InvariantCulture)), "capturedAt");
        return form;
    }

    private async Task<StationResult<T>> SendAsync<T>(
        Func<HttpRequestMessage> build,
        Func<HttpContent, CancellationToken, Task<T?>> read,
        CancellationToken ct) where T : class
    {
        try
        {
            using var request = build();
            using var response = await _http.SendAsync(request, ct);
            if (response.IsSuccessStatusCode)
            {
                var value = await read(response.Content, ct);
                return value is null
                    ? new StationResult<T>(null, StationFailure.Unavailable, "unreadable answer")
                    : StationResult<T>.Ok(value);
            }

            var errorCode = await ReadErrorCodeAsync(response.Content, ct);
            return new StationResult<T>(null, Classify(response.StatusCode, errorCode), errorCode ?? $"HTTP {(int)response.StatusCode}");
        }
        catch (HttpRequestException e)
        {
            return new StationResult<T>(null, StationFailure.Unavailable, LogSafe.Describe(e));
        }
        catch (TaskCanceledException e) when (!ct.IsCancellationRequested)
        {
            return new StationResult<T>(null, StationFailure.Unavailable, LogSafe.Describe(e));
        }
    }

    internal static StationFailure Classify(HttpStatusCode status, string? errorCode) => errorCode switch
    {
        ErrorCodes.DeviceNotPaired => StationFailure.Unauthorized,
        ErrorCodes.InvalidImage or ErrorCodes.ImageTooLarge or ErrorCodes.ImageInfected => StationFailure.Rejected,
        ErrorCodes.PatientUnavailable => StationFailure.NotFound,
        ErrorCodes.MalwareScanUnavailable => StationFailure.Unavailable,
        _ => (int)status switch
        {
            401 or 403 => StationFailure.Unauthorized,
            // A bare 404 means a wrong address or an older server, not a bad picture.
            404 or 408 or 429 or >= 500 => StationFailure.Unavailable,
            _ => StationFailure.Rejected,
        },
    };

    private static async Task<string?> ReadErrorCodeAsync(HttpContent content, CancellationToken ct)
    {
        try
        {
            using var doc = await JsonDocument.ParseAsync(await content.ReadAsStreamAsync(ct), cancellationToken: ct);
            return doc.RootElement.TryGetProperty("error", out var error)
                && error.ValueKind == JsonValueKind.Object
                && error.TryGetProperty("code", out var code)
                && code.ValueKind == JsonValueKind.String
                    ? code.GetString()
                    : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private sealed record StationDto(string? DeviceName, string? BranchName);
    private sealed record ReceiptDto(int Status, bool Duplicate);
    private sealed record PatientDto(string? PatientCode, string? LastName, string? FirstName, DateOnly? DateOfBirth, JsonElement Gender);

    private static async Task<StationInfo?> ReadStationAsync(HttpContent content, CancellationToken ct)
    {
        var dto = await ReadJsonAsync<StationDto>(content, ct);
        return dto is null ? null : new StationInfo(dto.DeviceName ?? string.Empty, dto.BranchName ?? string.Empty);
    }

    private static async Task<UploadReceipt?> ReadReceiptAsync(HttpContent content, CancellationToken ct)
    {
        var dto = await ReadJsonAsync<ReceiptDto>(content, ct);
        return dto is null ? null : new UploadReceipt(dto.Status, dto.Duplicate);
    }

    private static async Task<StationPatient?> ReadPatientAsync(HttpContent content, CancellationToken ct)
    {
        var dto = await ReadJsonAsync<PatientDto>(content, ct);
        if (dto?.PatientCode is null)
            return null;
        return new StationPatient(dto.PatientCode, dto.LastName, dto.FirstName, dto.DateOfBirth, ReadGender(dto.Gender));
    }

    private static PatientGender ReadGender(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Number when value.TryGetInt32(out var n) && Enum.IsDefined((PatientGender)n) => (PatientGender)n,
        JsonValueKind.String when Enum.TryParse<PatientGender>(value.GetString(), ignoreCase: true, out var g) => g,
        _ => PatientGender.Unknown,
    };

    private static async Task<T?> ReadJsonAsync<T>(HttpContent content, CancellationToken ct) where T : class
    {
        try
        {
            return await JsonSerializer.DeserializeAsync<T>(await content.ReadAsStreamAsync(ct), Json, ct);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
