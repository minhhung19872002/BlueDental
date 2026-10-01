using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace BlueDental.Zalo;

/// <summary>
/// Zalo's OA OAuth v4, Open API and ZNS (Business) endpoints. Nothing here
/// throws for a refusal: every call comes back as an outcome that carries
/// Zalo's own error code and message, so the caller can log and show it.
/// </summary>
public interface IZaloApiClient
{
    /// <summary><c>POST /v4/oa/access_token</c> with <c>grant_type=authorization_code</c>.</summary>
    Task<ZaloTokenOutcome> ExchangeCodeAsync(string code, CancellationToken cancellationToken = default);

    /// <summary><c>POST /v4/oa/access_token</c> with <c>grant_type=refresh_token</c>. The token is single-use.</summary>
    Task<ZaloTokenOutcome> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);

    /// <summary><c>GET /v2.0/oa/getoa</c>.</summary>
    Task<ZaloOaInfoOutcome> GetOaInfoAsync(string accessToken, CancellationToken cancellationToken = default);

    /// <summary><c>GET /template/all</c>. <paramref name="status"/> 1 = enabled only.</summary>
    Task<ZaloTemplateListOutcome> GetTemplatesAsync(
        string accessToken, int offset, int limit, int? status, CancellationToken cancellationToken = default);

    /// <summary><c>GET /template/info/v2</c>.</summary>
    Task<ZaloTemplateDetailOutcome> GetTemplateDetailAsync(
        string accessToken, string templateId, CancellationToken cancellationToken = default);

    /// <summary><c>POST /message/template</c> — one ZNS to one phone.</summary>
    Task<ZaloSendOutcome> SendTemplateMessageAsync(
        string accessToken,
        string phone,
        string templateId,
        IReadOnlyDictionary<string, string> templateData,
        string trackingId,
        CancellationToken cancellationToken = default);
}

/// <summary>The shape of one call, for the integration call log.</summary>
public record ZaloCallOutcome(
    string RequestPath,
    int? StatusCode,
    bool Succeeded,
    long DurationMs,
    string? Error,
    string? ErrorCode);

public sealed record ZaloTokenOutcome(
    ZaloCallOutcome Call,
    string? AccessToken,
    string? RefreshToken,
    int? ExpiresInSeconds);

public sealed record ZaloOaInfo(
    string OaId,
    string Name,
    string? Description,
    string? AvatarUrl,
    bool IsVerified,
    string? PackageName,
    long? NumFollower);

public sealed record ZaloOaInfoOutcome(ZaloCallOutcome Call, ZaloOaInfo? Info);

/// <summary>One row of ZBS's template list. Status and quality are Zalo's own words (ENABLE, HIGH…).</summary>
public sealed record ZaloTemplateSummary(
    string TemplateId,
    string Name,
    string? Status,
    string? Quality,
    long? CreatedTimeMs);

public sealed record ZaloTemplateListOutcome(
    ZaloCallOutcome Call,
    IReadOnlyList<ZaloTemplateSummary> Items,
    int Total);

public sealed record ZaloTemplateParam(
    string Name,
    bool Required,
    string? Type,
    int? MaxLength,
    int? MinLength,
    bool AcceptNull);

public sealed record ZaloTemplateDetail(
    string TemplateId,
    string Name,
    string? Status,
    string? Quality,
    string? PreviewUrl,
    decimal? Price,
    int? TimeoutMs,
    IReadOnlyList<ZaloTemplateParam> Params);

public sealed record ZaloTemplateDetailOutcome(ZaloCallOutcome Call, ZaloTemplateDetail? Detail);

public sealed record ZaloSendOutcome(
    ZaloCallOutcome Call,
    string? MessageId,
    long? SentTimeMs,
    int? RemainingQuota);
