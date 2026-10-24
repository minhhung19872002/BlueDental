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

    /// <summary>
    /// <c>POST /v3.0/oa/message/cs</c> — a text "tin tư vấn" to a user who
    /// wrote to the OA in the last 48 hours.
    /// </summary>
    Task<ZaloChatSendOutcome> SendTextMessageAsync(
        string accessToken, string userId, string text, CancellationToken cancellationToken = default);

    /// <summary>
    /// R-1028: <c>POST /v3.0/oa/message/cs</c> with the <c>request_user_info</c>
    /// template — the card the customer taps to send the OA their phone, which
    /// comes back as the <c>user_submit_info</c> webhook. A "tin tư vấn" too.
    /// </summary>
    Task<ZaloChatSendOutcome> SendRequestUserInfoAsync(
        string accessToken, string userId, string title, string subtitle, string imageUrl,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// <c>GET /v2.0/oa/conversation</c> — the messages between the OA and one
    /// user, newest first (offset 0); Zalo serves at most 10 per call.
    /// </summary>
    Task<ZaloChatListOutcome> GetConversationAsync(
        string accessToken, string userId, int offset, int count, CancellationToken cancellationToken = default);

    /// <summary><c>GET /v2.0/oa/listrecentchat</c> — the latest message of each recent conversation, at most 10 per call.</summary>
    Task<ZaloChatListOutcome> GetRecentChatsAsync(
        string accessToken, int offset, int count, CancellationToken cancellationToken = default);

    /// <summary><c>GET /v3.0/oa/user/detail</c> — name, avatar and what the user shared (<c>shared_info</c>).</summary>
    Task<ZaloUserOutcome> GetUserDetailAsync(
        string accessToken, string userId, CancellationToken cancellationToken = default);
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

public sealed record ZaloChatSendOutcome(ZaloCallOutcome Call, string? MessageId);

/// <summary>
/// One message as the conversation and recent-chat APIs give it. <c>src</c> 0
/// is OA → user, 1 user → OA; <c>type</c> is text, photo, GIF, sticker, link,
/// links, voice, location…; the media sits in <c>url</c> / <c>thumb</c>.
/// </summary>
public sealed record ZaloChatItem(
    string MessageId,
    bool FromOa,
    long TimeMs,
    string? Type,
    string? Text,
    string? Url,
    string? FromId,
    string? ToId,
    string? FromDisplayName,
    string? FromAvatar,
    string? ToDisplayName,
    string? ToAvatar)
{
    /// <summary>The customer's side of the exchange, whichever way it went.</summary>
    public string? UserId => FromOa ? ToId : FromId;

    public string? UserDisplayName => FromOa ? ToDisplayName : FromDisplayName;

    public string? UserAvatar => FromOa ? ToAvatar : FromAvatar;
}

public sealed record ZaloChatListOutcome(ZaloCallOutcome Call, IReadOnlyList<ZaloChatItem> Items);

public sealed record ZaloUserProfile(string UserId, string? DisplayName, string? AvatarUrl, string? SharedPhone);

public sealed record ZaloUserOutcome(ZaloCallOutcome Call, ZaloUserProfile? User);
