using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Zalo;

/// <summary>
/// A branch's link to one Zalo Official Account: the tokens the OA admin
/// granted (encrypted at rest, never returned to a client) and what Zalo told
/// us about the OA. One live link per branch — the reference's
/// <c>/zalo-oa/status</c> resource.
/// </summary>
public class ZaloOaConnection : FullAuditedAggregateRoot<Guid>
{
    public const int MaxOaIdLength = 50;
    public const int MaxNameLength = 200;
    public const int MaxUrlLength = 500;
    public const int MaxCipherLength = 4000;
    public const int MaxErrorLength = 1000;

    /// <summary>How long before the access token lapses a refresh is due.</summary>
    public static readonly TimeSpan RefreshLeeway = TimeSpan.FromHours(2);

    public Guid ClinicBranchId { get; private set; }

    public string OaId { get; private set; } = string.Empty;

    public string OaName { get; private set; } = string.Empty;

    public string? AvatarUrl { get; private set; }

    /// <summary>What Zalo calls the OA's package (tier); ZNS needs a paid one.</summary>
    public string? PackageName { get; private set; }

    public string AccessTokenCipher { get; private set; } = string.Empty;

    public string RefreshTokenCipher { get; private set; } = string.Empty;

    public DateTime AccessTokenExpiresAt { get; private set; }

    public DateTime RefreshTokenExpiresAt { get; private set; }

    public DateTime ConnectedAt { get; private set; }

    public DateTime? LastRefreshedAt { get; private set; }

    public ZaloOaConnectionStatus Status { get; private set; }

    /// <summary>Why the last token refresh or OA lookup failed; cleared by success.</summary>
    public string? LastError { get; private set; }

    /// <summary>The reference's "kích hoạt": whether messages may go out.</summary>
    public bool IsEnabled { get; private set; }

    protected ZaloOaConnection() { }

    public ZaloOaConnection(
        Guid id,
        Guid clinicBranchId,
        string oaId,
        string oaName,
        ZaloTokenSet tokens,
        DateTime now)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        SetOaInfo(oaId, oaName, null, null);
        ReplaceTokens(tokens, now);
        ConnectedAt = now;
        IsEnabled = true;
    }

    /// <summary>Connected means the tokens can still be used or renewed.</summary>
    public bool IsConnected => Status == ZaloOaConnectionStatus.Active;

    public bool CanSend => IsConnected && IsEnabled;

    public bool IsRefreshDue(DateTime now) => AccessTokenExpiresAt - RefreshLeeway <= now;

    public bool IsRefreshTokenExpired(DateTime now) => RefreshTokenExpiresAt <= now;

    public void SetOaInfo(string oaId, string oaName, string? avatarUrl, string? packageName)
    {
        OaId = Check.NotNullOrWhiteSpace(oaId, nameof(oaId), MaxOaIdLength);
        OaName = Clip(string.IsNullOrWhiteSpace(oaName) ? oaId : oaName, MaxNameLength)!;
        AvatarUrl = Clip(avatarUrl, MaxUrlLength);
        PackageName = Clip(packageName, MaxNameLength);
    }

    /// <summary>
    /// A fresh pair from Zalo. The refresh token Zalo hands back is single-use,
    /// so the old one is gone the moment this is called.
    /// </summary>
    public void ReplaceTokens(ZaloTokenSet tokens, DateTime now)
    {
        AccessTokenCipher = Check.NotNullOrWhiteSpace(tokens.AccessTokenCipher, nameof(tokens.AccessTokenCipher), MaxCipherLength);
        RefreshTokenCipher = Check.NotNullOrWhiteSpace(tokens.RefreshTokenCipher, nameof(tokens.RefreshTokenCipher), MaxCipherLength);
        AccessTokenExpiresAt = tokens.AccessTokenExpiresAt;
        RefreshTokenExpiresAt = tokens.RefreshTokenExpiresAt;
        LastRefreshedAt = now;
        Status = ZaloOaConnectionStatus.Active;
        LastError = null;
    }

    /// <summary>
    /// A refresh that Zalo refused. An expired refresh token cannot be renewed
    /// without the OA admin granting again, so that is a distinct state.
    /// </summary>
    public void RecordRefreshFailure(string? error, DateTime now)
    {
        LastError = Clip(string.IsNullOrWhiteSpace(error) ? "Token refresh failed." : error, MaxErrorLength);
        Status = IsRefreshTokenExpired(now)
            ? ZaloOaConnectionStatus.Expired
            : ZaloOaConnectionStatus.Failed;
    }

    public void SetEnabled(bool enabled)
    {
        if (enabled && !IsConnected)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Tools.ZaloNotConnected,
                "The Zalo OA link is not active; connect it again first.");
        }

        IsEnabled = enabled;
    }

    public void EnsureCanSend()
    {
        if (!IsConnected)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Tools.ZaloNotConnected,
                "The Zalo OA link is not active.");
        }

        if (!IsEnabled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Tools.ZaloNotEnabled,
                "Zalo OA messaging is switched off for this branch.");
        }
    }

    private static string? Clip(string? value, int max) =>
        value == null || value.Length <= max ? value : value[..max];
}

public enum ZaloOaConnectionStatus
{
    /// <summary>Tokens are usable or renewable.</summary>
    Active = 1,

    /// <summary>The last refresh failed but the refresh token is still within its life.</summary>
    Failed = 2,

    /// <summary>The refresh token itself lapsed; only a new OAuth grant recovers.</summary>
    Expired = 3,
}

/// <summary>An encrypted token pair with the instants each one lapses.</summary>
public sealed record ZaloTokenSet(
    string AccessTokenCipher,
    string RefreshTokenCipher,
    DateTime AccessTokenExpiresAt,
    DateTime RefreshTokenExpiresAt);
