using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Zalo;

/// <summary>
/// Zalo over HTTP. Three hosts: OAuth v4 (<c>secret_key</c> header, form
/// body), the Open API and the Business API (both take the OA access token in
/// an <c>access_token</c> header). Zalo answers a refusal with HTTP 200 and a
/// non-zero <c>error</c>, so the envelope is what decides success, never the
/// status code alone. Tokens travel in headers and are never part of a logged
/// path.
/// </summary>
public class HttpZaloApiClient : IZaloApiClient, ITransientDependency
{
    public const string ClientName = "ZaloApi";

    public const string TokenPath = "/v4/oa/access_token";
    public const string OaInfoPath = "/v2.0/oa/getoa";
    public const string TemplateListPath = "/template/all";
    public const string TemplateInfoPath = "/template/info/v2";
    public const string SendTemplatePath = "/message/template";

    private const int MaxErrorBody = 300;

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<ZaloOptions> _options;

    public HttpZaloApiClient(IHttpClientFactory httpClientFactory, IOptions<ZaloOptions> options)
    {
        _httpClientFactory = httpClientFactory;
        _options = options;
    }

    private ZaloOptions Options => _options.Value;

    public Task<ZaloTokenOutcome> ExchangeCodeAsync(string code, CancellationToken cancellationToken = default) =>
        RequestTokenAsync(new Dictionary<string, string>
        {
            ["app_id"] = Options.AppId,
            ["code"] = code,
            ["grant_type"] = "authorization_code",
        }, cancellationToken);

    public Task<ZaloTokenOutcome> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default) =>
        RequestTokenAsync(new Dictionary<string, string>
        {
            ["app_id"] = Options.AppId,
            ["refresh_token"] = refreshToken,
            ["grant_type"] = "refresh_token",
        }, cancellationToken);

    private async Task<ZaloTokenOutcome> RequestTokenAsync(
        Dictionary<string, string> form, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Options.OAuthBaseUrl.TrimEnd('/') + TokenPath)
        {
            Content = new FormUrlEncodedContent(form),
        };
        request.Headers.Add("secret_key", Options.AppSecret);

        var (call, root) = await SendAsync(request, TokenPath, cancellationToken);
        if (!call.Succeeded || root == null)
        {
            return new ZaloTokenOutcome(call, null, null, null);
        }

        using (root)
        {
            var accessToken = Text(root.RootElement, "access_token");
            var refreshToken = Text(root.RootElement, "refresh_token");
            if (string.IsNullOrWhiteSpace(accessToken) || string.IsNullOrWhiteSpace(refreshToken))
            {
                return new ZaloTokenOutcome(
                    call with { Succeeded = false, Error = "Zalo returned no token pair." }, null, null, null);
            }

            return new ZaloTokenOutcome(call, accessToken, refreshToken, Int(root.RootElement, "expires_in"));
        }
    }

    public async Task<ZaloOaInfoOutcome> GetOaInfoAsync(string accessToken, CancellationToken cancellationToken = default)
    {
        using var request = Get(Options.OpenApiBaseUrl.TrimEnd('/') + OaInfoPath, accessToken);
        var (call, root) = await SendAsync(request, OaInfoPath, cancellationToken);
        if (!call.Succeeded || root == null)
        {
            return new ZaloOaInfoOutcome(call, null);
        }

        using (root)
        {
            if (!root.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
            {
                return new ZaloOaInfoOutcome(call with { Succeeded = false, Error = "Zalo returned no OA data." }, null);
            }

            // The table names it oa_id, the doc's own example oaid.
            var oaId = Text(data, "oa_id") ?? Text(data, "oaid");
            if (string.IsNullOrWhiteSpace(oaId))
            {
                return new ZaloOaInfoOutcome(call with { Succeeded = false, Error = "Zalo returned no OA id." }, null);
            }

            return new ZaloOaInfoOutcome(call, new ZaloOaInfo(
                oaId,
                Text(data, "name") ?? oaId,
                Text(data, "description"),
                Text(data, "avatar"),
                Bool(data, "is_verified"),
                Text(data, "package_name"),
                Long(data, "num_follower")));
        }
    }

    public async Task<ZaloTemplateListOutcome> GetTemplatesAsync(
        string accessToken, int offset, int limit, int? status, CancellationToken cancellationToken = default)
    {
        var query = $"?offset={offset}&limit={limit}" + (status.HasValue ? $"&status={status.Value}" : string.Empty);
        using var request = Get(Options.BusinessApiBaseUrl.TrimEnd('/') + TemplateListPath + query, accessToken);
        var (call, root) = await SendAsync(request, TemplateListPath, cancellationToken);
        if (!call.Succeeded || root == null)
        {
            return new ZaloTemplateListOutcome(call, [], 0);
        }

        using (root)
        {
            var items = new List<ZaloTemplateSummary>();
            if (root.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var row in data.EnumerateArray())
                {
                    var id = Text(row, "templateId");
                    if (string.IsNullOrWhiteSpace(id))
                    {
                        continue;
                    }

                    items.Add(new ZaloTemplateSummary(
                        id,
                        Text(row, "templateName") ?? id,
                        Text(row, "status"),
                        Quality(row),
                        Long(row, "createdTime")));
                }
            }

            var total = items.Count;
            if (root.RootElement.TryGetProperty("metadata", out var metadata) && metadata.ValueKind == JsonValueKind.Object)
            {
                total = Int(metadata, "total") ?? total;
            }

            return new ZaloTemplateListOutcome(call, items, total);
        }
    }

    public async Task<ZaloTemplateDetailOutcome> GetTemplateDetailAsync(
        string accessToken, string templateId, CancellationToken cancellationToken = default)
    {
        var url = Options.BusinessApiBaseUrl.TrimEnd('/') + TemplateInfoPath + "?template_id=" + Uri.EscapeDataString(templateId);
        using var request = Get(url, accessToken);
        var (call, root) = await SendAsync(request, TemplateInfoPath, cancellationToken);
        if (!call.Succeeded || root == null)
        {
            return new ZaloTemplateDetailOutcome(call, null);
        }

        using (root)
        {
            if (!root.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
            {
                return new ZaloTemplateDetailOutcome(call with { Succeeded = false, Error = "Zalo returned no template data." }, null);
            }

            var parameters = new List<ZaloTemplateParam>();
            if (data.TryGetProperty("listParams", out var list) && list.ValueKind == JsonValueKind.Array)
            {
                foreach (var row in list.EnumerateArray())
                {
                    var name = Text(row, "name");
                    if (string.IsNullOrWhiteSpace(name))
                    {
                        continue;
                    }

                    parameters.Add(new ZaloTemplateParam(
                        name,
                        Bool(row, "require"),
                        Text(row, "type"),
                        Int(row, "maxLength"),
                        Int(row, "minLength"),
                        Bool(row, "acceptNull")));
                }
            }

            var id = Text(data, "templateId") ?? templateId;
            return new ZaloTemplateDetailOutcome(call, new ZaloTemplateDetail(
                id,
                Text(data, "templateName") ?? id,
                Text(data, "status"),
                Quality(data),
                Text(data, "previewUrl"),
                // price is deprecated in favour of price_sdt (the per-phone price).
                Decimal(data, "price_sdt") ?? Decimal(data, "price"),
                Int(data, "timeout"),
                parameters));
        }
    }

    public async Task<ZaloSendOutcome> SendTemplateMessageAsync(
        string accessToken,
        string phone,
        string templateId,
        IReadOnlyDictionary<string, string> templateData,
        string trackingId,
        CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Options.BusinessApiBaseUrl.TrimEnd('/') + SendTemplatePath)
        {
            Content = JsonContent.Create(new
            {
                phone,
                template_id = templateId,
                template_data = templateData,
                tracking_id = trackingId,
            }),
        };
        request.Headers.Add("access_token", accessToken);

        var (call, root) = await SendAsync(request, SendTemplatePath, cancellationToken);
        if (!call.Succeeded || root == null)
        {
            return new ZaloSendOutcome(call, null, null, null);
        }

        using (root)
        {
            if (!root.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
            {
                return new ZaloSendOutcome(call, null, null, null);
            }

            int? remaining = null;
            if (data.TryGetProperty("quota", out var quota) && quota.ValueKind == JsonValueKind.Object)
            {
                remaining = Int(quota, "remainingQuota");
            }

            return new ZaloSendOutcome(call, Text(data, "msg_id"), Long(data, "sent_time"), remaining);
        }
    }

    private static HttpRequestMessage Get(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("access_token", accessToken);
        return request;
    }

    /// <summary>
    /// Sends and reads the envelope. Success needs a 2xx and an <c>error</c>
    /// that is absent or zero; the document is handed back only then.
    /// </summary>
    private async Task<(ZaloCallOutcome Call, JsonDocument? Body)> SendAsync(
        HttpRequestMessage request, string path, CancellationToken cancellationToken)
    {
        var watch = Stopwatch.StartNew();
        var client = _httpClientFactory.CreateClient(ClientName);

        try
        {
            using var response = await client.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            var status = (int)response.StatusCode;

            var (errorCode, errorMessage, document) = ReadEnvelope(body);

            if (!response.IsSuccessStatusCode)
            {
                document?.Dispose();
                return (new ZaloCallOutcome(path, status, false, watch.ElapsedMilliseconds,
                    errorMessage ?? $"HTTP {status}: {Clip(body)}", errorCode), null);
            }

            if (errorCode != null && errorCode != "0")
            {
                document?.Dispose();
                return (new ZaloCallOutcome(path, status, false, watch.ElapsedMilliseconds,
                    errorMessage ?? $"Zalo error {errorCode}", errorCode), null);
            }

            if (document == null)
            {
                return (new ZaloCallOutcome(path, status, false, watch.ElapsedMilliseconds,
                    "Invalid response: " + Clip(body), null), null);
            }

            return (new ZaloCallOutcome(path, status, true, watch.ElapsedMilliseconds, null, null), document);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // TaskCanceledException without our token cancelled is the client timeout.
            return (new ZaloCallOutcome(path, null, false, watch.ElapsedMilliseconds, ex.Message, null), null);
        }
    }

    /// <summary>
    /// Zalo's envelopes: <c>{ error, message, data }</c> on the Open and
    /// Business APIs; <c>{ error, error_name, error_reason, error_description }</c>
    /// on OAuth. A non-object or unparsable body yields no document.
    /// </summary>
    public static (string? ErrorCode, string? ErrorMessage, JsonDocument? Document) ReadEnvelope(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return (null, null, null);
        }

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(body);
        }
        catch (JsonException)
        {
            return (null, null, null);
        }

        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
        {
            document.Dispose();
            return (null, null, null);
        }

        var code = Text(root, "error");
        var message = Text(root, "error_description")
            ?? Text(root, "error_reason")
            ?? Text(root, "error_name")
            ?? Text(root, "message");

        if (code != null && code != "0")
        {
            message = string.IsNullOrWhiteSpace(message) ? $"Zalo error {code}" : $"{message} ({code})";
        }

        return (code, message, document);
    }

    private static string? Text(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.String => string.IsNullOrWhiteSpace(value.GetString()) ? null : value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => null,
        };
    }

    private static int? Int(JsonElement element, string name) =>
        int.TryParse(Text(element, name), NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : null;

    private static long? Long(JsonElement element, string name) =>
        long.TryParse(Text(element, name), NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : null;

    private static decimal? Decimal(JsonElement element, string name) =>
        decimal.TryParse(Text(element, name), NumberStyles.Number, CultureInfo.InvariantCulture, out var n) ? n : null;

    private static bool Bool(JsonElement element, string name) =>
        string.Equals(Text(element, name), "true", StringComparison.OrdinalIgnoreCase)
        || Text(element, name) == "1";

    /// <summary>Zalo sends the literal "Null" (and UNDEFINED) while a template has no quality rating yet.</summary>
    private static string? Quality(JsonElement element)
    {
        var quality = Text(element, "templateQuality");
        return quality is null
            || quality.Equals("Null", StringComparison.OrdinalIgnoreCase)
            || quality.Equals("UNDEFINED", StringComparison.OrdinalIgnoreCase)
            ? null
            : quality;
    }

    private static string Clip(string body) =>
        body.Length <= MaxErrorBody ? body : body[..MaxErrorBody];
}
