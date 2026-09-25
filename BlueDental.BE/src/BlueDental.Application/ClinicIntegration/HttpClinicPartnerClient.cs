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

            return response.IsSuccessStatusCode
                ? (new PartnerCallOutcome(path, status, true, watch.ElapsedMilliseconds, null), body)
                : (new PartnerCallOutcome(path, status, false, watch.ElapsedMilliseconds,
                    $"HTTP {status}: {Clip(body)}"), null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // TaskCanceledException without our token cancelled is the client timeout.
            return (new PartnerCallOutcome(path, null, false, watch.ElapsedMilliseconds, ex.Message), null);
        }
    }

    private static PartnerBatchOutcome Batch(PartnerCallOutcome call, IReadOnlyList<PartnerServiceResult> results) =>
        new(call.RequestPath, call.StatusCode, call.Succeeded, call.DurationMs, call.Error, results);

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
