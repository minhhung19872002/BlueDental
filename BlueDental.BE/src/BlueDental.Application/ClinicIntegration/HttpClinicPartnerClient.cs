using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Volo.Abp.DependencyInjection;

namespace BlueDental.ClinicIntegration;

/// <summary>
/// The partner over HTTP, with BlueDental's own contract (docs/clone/api.md §
/// Clinic integration — the reference's wire format is not observable):
///
/// <code>
/// POST {baseUrl}/handshake              { clinicBranchId }            → 2xx
/// POST {baseUrl}/service-catalog/batch  { clinicBranchId, items: [] } → { results: [] }
/// </code>
///
/// Both carry the key in <c>X-Api-Key</c>. A failure never throws: it comes
/// back as an outcome, so the caller can log it and report it per batch.
/// </summary>
public class HttpClinicPartnerClient : IClinicPartnerClient, ITransientDependency
{
    public const string ClientName = "ClinicPartner";
    public const string HandshakePath = "/handshake";
    public const string ServiceCatalogPath = "/service-catalog/batch";

    private const string ApiKeyHeader = "X-Api-Key";
    private const int MaxErrorBody = 300;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    private readonly IHttpClientFactory _httpClientFactory;

    public HttpClinicPartnerClient(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<PartnerCallOutcome> HandshakeAsync(
        PartnerEndpoint endpoint, Guid clinicBranchId, CancellationToken cancellationToken = default)
    {
        var (outcome, _) = await SendAsync(endpoint, HandshakePath, new { clinicBranchId }, cancellationToken);
        return outcome;
    }

    public async Task<PartnerBatchOutcome> UpsertServicesAsync(
        PartnerEndpoint endpoint,
        Guid clinicBranchId,
        IReadOnlyList<PartnerServiceItem> items,
        CancellationToken cancellationToken = default)
    {
        var (outcome, body) = await SendAsync(
            endpoint, ServiceCatalogPath, new { clinicBranchId, items }, cancellationToken);

        if (!outcome.Succeeded)
        {
            return Batch(outcome, []);
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<ResultsBody>(body ?? string.Empty, Json);

            // A 2xx that carries an error and no results is still a refusal.
            if (parsed?.Results == null && ReadPartnerError(body) is { } refusal)
            {
                return Batch(outcome with { Succeeded = false, ErrorCode = refusal.Code, Error = refusal.Message }, []);
            }

            var results = (parsed?.Results ?? [])
                .Where(r => !string.IsNullOrWhiteSpace(r.ExternalId))
                .Select(r => new PartnerServiceResult(
                    r.ExternalId!, r.Status, r.SystemId, r.SystemName, r.Reason, r.Relinked))
                .ToList();

            return Batch(outcome, results);
        }
        catch (JsonException ex)
        {
            return Batch(outcome with { Succeeded = false, Error = "Invalid response: " + ex.Message }, []);
        }
    }

    private async Task<(PartnerCallOutcome Outcome, string? Body)> SendAsync(
        PartnerEndpoint endpoint, string path, object payload, CancellationToken cancellationToken)
    {
        var watch = Stopwatch.StartNew();
        var client = _httpClientFactory.CreateClient(ClientName);

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint.BaseUrl + path)
        {
            Content = JsonContent.Create(payload, options: Json)
        };
        request.Headers.Add(ApiKeyHeader, endpoint.ApiKey);

        try
        {
            using var response = await client.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            var status = (int)response.StatusCode;

            if (response.IsSuccessStatusCode)
            {
                return (new PartnerCallOutcome(path, status, true, watch.ElapsedMilliseconds, null), body);
            }

            // The partner's own code and message when it sends them; the raw
            // status and body otherwise.
            var refusal = ReadPartnerError(body);
            return (new PartnerCallOutcome(path, status, false, watch.ElapsedMilliseconds,
                refusal?.Message ?? $"HTTP {status}: {Clip(body)}", refusal?.Code), null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // TaskCanceledException without our token cancelled is the client timeout.
            return (new PartnerCallOutcome(path, null, false, watch.ElapsedMilliseconds, ex.Message), null);
        }
    }

    private static PartnerBatchOutcome Batch(PartnerCallOutcome call, IReadOnlyList<PartnerServiceResult> results) =>
        new(call.RequestPath, call.StatusCode, call.Succeeded, call.DurationMs, call.Error, call.ErrorCode, results);

    /// <summary>
    /// A refusal body: <c>{ code, message }</c>, <c>{ errorCode, message }</c> or
    /// <c>{ error: { code, message } }</c>. Null when the body says neither.
    /// </summary>
    public static (string? Code, string? Message)? ReadPartnerError(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            if (root.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.Object)
            {
                root = error;
            }

            var code = Text(root, "code") ?? Text(root, "errorCode");
            var message = Text(root, "message");
            return code == null && message == null ? null : (code, message);
        }
        catch (JsonException)
        {
            return null;
        }

        static string? Text(JsonElement element, string name)
        {
            foreach (var property in element.EnumerateObject())
            {
                if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase)
                    && property.Value.ValueKind == JsonValueKind.String
                    && !string.IsNullOrWhiteSpace(property.Value.GetString()))
                {
                    return property.Value.GetString();
                }
            }

            return null;
        }
    }

    private static string Clip(string body) =>
        body.Length <= MaxErrorBody ? body : body[..MaxErrorBody];

    private sealed class ResultsBody
    {
        public List<ResultRow>? Results { get; set; }
    }

    private sealed class ResultRow
    {
        public string? ExternalId { get; set; }
        public PartnerServiceStatus Status { get; set; }
        public string? SystemId { get; set; }
        public string? SystemName { get; set; }
        public string? Reason { get; set; }
        public bool Relinked { get; set; }
    }
}
