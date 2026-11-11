using System;
using System.Security.Cryptography;
using System.Text;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Imaging;

/// <summary>
/// A PC beside the X-ray machine running BlueDental.XrayAgent (F-95). It is
/// paired once from Cài đặt and from then on calls the station API with its
/// own token — no staff account sits at that PC. Only the token's SHA-256 is
/// stored, so a database copy cannot impersonate the agent; the branch of
/// everything it sends is this device's, never one the agent names.
/// </summary>
public class XrayDevice : CreationAuditedAggregateRoot<Guid>
{
    public const int MaxNameLength = 100;

    /// <summary>32 random bytes in base64url, unpadded.</summary>
    public const int TokenLength = 43;

    public Guid ClinicBranchId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string TokenHash { get; private set; } = string.Empty;

    public DateTimeOffset? RevokedAt { get; private set; }

    /// <summary>Lần cuối kết nối — touched at most once a minute.</summary>
    public DateTimeOffset? LastSeenAt { get; private set; }

    public bool IsActive => RevokedAt == null;

    protected XrayDevice() { }

    /// <summary>The token is returned once, to be pasted into the agent, and never again.</summary>
    public static (XrayDevice Device, string Token) Pair(Guid id, Guid clinicBranchId, string name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            throw new BusinessException(BlueDentalDomainErrorCodes.Imaging.DeviceNameRequired);

        if (trimmed.Length > MaxNameLength)
            trimmed = trimmed[..MaxNameLength];

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        var device = new XrayDevice
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Name = trimmed,
            TokenHash = HashToken(token),
        };
        return (device, token);
    }

    public static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    public void Revoke(DateTimeOffset now) => RevokedAt ??= now;

    /// <summary>Records a call; true when the row changed and needs saving.</summary>
    public bool Touch(DateTimeOffset now)
    {
        if (LastSeenAt is { } seen && now - seen < TimeSpan.FromMinutes(1))
            return false;

        LastSeenAt = now;
        return true;
    }
}
