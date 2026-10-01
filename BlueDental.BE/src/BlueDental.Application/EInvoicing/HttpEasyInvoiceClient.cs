using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Volo.Abp.DependencyInjection;

namespace BlueDental.EInvoicing;

/// <summary>
/// EasyInvoice over HTTP (docs/clone/integrations/easyinvoice.md). Every
/// endpoint is a POST with the same signed header; the answer is an envelope
/// <c>{ Status, Message, Data, ErrorCode }</c> where <c>Status == 2</c> is
/// success — except the PDF call, which streams the file itself.
///
/// Nothing here throws for a provider problem, and nothing here logs the
/// request: the header carries the account password and the body carries
/// the patient's name.
/// </summary>
public class HttpEasyInvoiceClient : IEasyInvoiceClient, ITransientDependency
{
    public const string ClientName = "EasyInvoice";
    public const string ImportInvoicePath = "/api/publish/importInvoice";
    public const string ImportAndPublishPath = "/api/publish/importAndPublishInv";
    public const string GetByIkeysPath = "/api/publish/getInvoicesByIkeys";
    public const string GetPdfPath = "/api/publish/getInvoicePdf";

    private const int SuccessStatus = 2;
    private const int MaxErrorBody = 300;

    private readonly IHttpClientFactory _httpClientFactory;

    public HttpEasyInvoiceClient(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public Task<EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>> ImportInvoiceAsync(
        EasyInvoiceSettings settings, string xmlData, CancellationToken cancellationToken = default) =>
        ImportAsync(ImportInvoicePath, settings, xmlData, cancellationToken);

    public Task<EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>> ImportAndPublishAsync(
        EasyInvoiceSettings settings, string xmlData, CancellationToken cancellationToken = default) =>
        ImportAsync(ImportAndPublishPath, settings, xmlData, cancellationToken);

    public async Task<EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>> GetByIkeysAsync(
        EasyInvoiceSettings settings, IReadOnlyList<string> ikeys, CancellationToken cancellationToken = default)
    {
        var (outcome, data) = await SendJsonAsync(settings, GetByIkeysPath, new { Ikeys = ikeys }, cancellationToken);

        // Data is the array itself here, not wrapped in { Invoices }.
        return Summaries(outcome, data, root => root);
    }

    public async Task<EasyInvoiceCallResult<byte[]>> GetPdfAsync(
        EasyInvoiceSettings settings, string ikey, CancellationToken cancellationToken = default)
    {
        var watch = Stopwatch.StartNew();

        try
        {
            using var response = await PostAsync(settings, GetPdfPath, new { Ikey = ikey }, cancellationToken);
            var status = (int)response.StatusCode;
            var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            var mediaType = response.Content.Headers.ContentType?.MediaType ?? string.Empty;

            if (response.IsSuccessStatusCode && IsPdf(bytes, mediaType))
            {
                return new EasyInvoiceCallResult<byte[]>(GetPdfPath, status, true, watch.ElapsedMilliseconds, null, null, bytes);
            }

            // A refusal comes back as the JSON envelope instead of a file.
            var body = Encoding.UTF8.GetString(bytes);
            var refusal = ReadEnvelope(body);
            return new EasyInvoiceCallResult<byte[]>(
                GetPdfPath, status, false, watch.ElapsedMilliseconds,
                refusal?.Message ?? $"HTTP {status}: {Clip(body)}", refusal?.ErrorCode, null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return new EasyInvoiceCallResult<byte[]>(GetPdfPath, null, false, watch.ElapsedMilliseconds, ex.Message, null, null);
        }
    }

    private async Task<EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>> ImportAsync(
        string path, EasyInvoiceSettings settings, string xmlData, CancellationToken cancellationToken)
    {
        var payload = new { XmlData = xmlData, Pattern = settings.Pattern, Serial = settings.Serial ?? string.Empty };
        var (outcome, data) = await SendJsonAsync(settings, path, payload, cancellationToken);

        return Summaries(outcome, data, root =>
            root.TryGetProperty("Invoices", out var invoices) ? invoices : default);
    }

    private async Task<(EasyInvoiceCallResult<JsonElement?> Outcome, JsonDocument? Data)> SendJsonAsync(
        EasyInvoiceSettings settings, string path, object payload, CancellationToken cancellationToken)
    {
        var watch = Stopwatch.StartNew();

        try
        {
            using var response = await PostAsync(settings, path, payload, cancellationToken);
            var status = (int)response.StatusCode;
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            var envelope = ReadEnvelope(body);

            if (envelope == null)
            {
                return (new EasyInvoiceCallResult<JsonElement?>(
                    path, status, false, watch.ElapsedMilliseconds, $"HTTP {status}: {Clip(body)}", null, null), null);
            }

            if (!response.IsSuccessStatusCode || envelope.Status != SuccessStatus)
            {
                return (new EasyInvoiceCallResult<JsonElement?>(
                    path, status, false, watch.ElapsedMilliseconds,
                    envelope.Message ?? $"HTTP {status}", envelope.ErrorCode, null), null);
            }

            return (new EasyInvoiceCallResult<JsonElement?>(path, status, true, watch.ElapsedMilliseconds, null, null, null),
                envelope.Data);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // TaskCanceledException without our token cancelled is the client timeout.
            return (new EasyInvoiceCallResult<JsonElement?>(path, null, false, watch.ElapsedMilliseconds, ex.Message, null, null), null);
        }
    }

    private async Task<HttpResponseMessage> PostAsync(
        EasyInvoiceSettings settings, string path, object payload, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient(ClientName);
        var json = JsonSerializer.Serialize(payload);

        using var request = new HttpRequestMessage(HttpMethod.Post, settings.BaseUrl.TrimEnd('/') + path)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.TryAddWithoutValidation(EasyInvoiceAuthentication.AgentHeaderName, EasyInvoiceAuthentication.AgentHeaderValue);
        request.Headers.TryAddWithoutValidation(
            EasyInvoiceAuthentication.HeaderName,
            EasyInvoiceAuthentication.BuildHeader(
                settings.Username, settings.Password, settings.TaxCode, DateTimeOffset.UtcNow, Guid.NewGuid()));

        return await client.SendAsync(request, cancellationToken);
    }

    private static EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>> Summaries(
        EasyInvoiceCallResult<JsonElement?> outcome, JsonDocument? data, Func<JsonElement, JsonElement> pick)
    {
        using var _ = data;
        var carried = new EasyInvoiceCallResult<IReadOnlyList<ProviderInvoiceSummary>>(
            outcome.RequestPath, outcome.StatusCode, outcome.Succeeded, outcome.DurationMs,
            outcome.Error, outcome.ErrorCode, null);

        if (!outcome.Succeeded || data == null)
        {
            return carried;
        }

        var list = pick(data.RootElement);
        if (list.ValueKind != JsonValueKind.Array)
        {
            return carried with { Data = Array.Empty<ProviderInvoiceSummary>() };
        }

        return carried with
        {
            Data = list.EnumerateArray()
                .Where(e => e.ValueKind == JsonValueKind.Object)
                .Select(ReadSummary)
                .Where(s => s.Ikey.Length > 0)
                .ToList()
        };
    }

    private static ProviderInvoiceSummary ReadSummary(JsonElement element) => new(
        Text(element, "Ikey") ?? string.Empty,
        Number(element, "InvoiceStatus") is { } status ? (int)status : 0,
        Text(element, "Pattern"),
        Text(element, "Serial"),
        Text(element, "No"),
        Text(element, "LookupCode"),
        Text(element, "LinkView"),
        Number(element, "Total") ?? 0m,
        Number(element, "TaxAmount") ?? 0m,
        Number(element, "Amount") ?? 0m,
        Text(element, "CustomerName") ?? Text(element, "Buyer"));

    /// <summary>The envelope, or null when the body is not one.</summary>
    private static Envelope? ReadEnvelope(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return null;
        }

        try
        {
            var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object || Number(root, "Status") is not { } status)
            {
                document.Dispose();
                return null;
            }

            var message = Text(root, "Message");
            var errorCode = Number(root, "ErrorCode");

            // Per-invoice refusals ride inside Data.KeyInvoiceMsg; surface them
            // so the cashier reads "102: thiếu trường…" rather than "lỗi dữ liệu".
            if (root.TryGetProperty("Data", out var data) && data.ValueKind == JsonValueKind.Object
                && data.TryGetProperty("KeyInvoiceMsg", out var detail) && detail.ValueKind != JsonValueKind.Null)
            {
                message = $"{message} {Clip(detail.GetRawText())}".Trim();
            }

            return new Envelope((int)status, message, errorCode is { } code ? (int)code : null, document);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? Text(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null
        };
    }

    private static decimal? Number(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.Number when value.TryGetDecimal(out var number) => number,
            JsonValueKind.String when decimal.TryParse(
                value.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => null
        };
    }

    private static bool IsPdf(byte[] bytes, string mediaType) =>
        mediaType.Contains("pdf", StringComparison.OrdinalIgnoreCase)
        || (bytes.Length > 4 && bytes[0] == (byte)'%' && bytes[1] == (byte)'P' && bytes[2] == (byte)'D' && bytes[3] == (byte)'F');

    private static string Clip(string body) =>
        body.Length <= MaxErrorBody ? body : body[..MaxErrorBody];

    private sealed record Envelope(int Status, string? Message, int? ErrorCode, JsonDocument Document)
    {
        public JsonDocument? Data =>
            Document.RootElement.TryGetProperty("Data", out var data) && data.ValueKind != JsonValueKind.Null
                ? JsonDocument.Parse(data.GetRawText())
                : null;
    }
}
