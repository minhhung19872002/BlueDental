using System;
using System.Security.Cryptography;
using System.Text;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Billing;

/// <summary>
/// An iPad paired with a branch to show receipts for signing (P2610, "Kết nối
/// iPad"). The iPad holds a random token, handed out once as a link; only its
/// SHA-256 is stored, so a leaked database cannot pose as the iPad. Revoking
/// the device ends the token.
/// </summary>
public class SigningDevice : CreationAuditedAggregateRoot<Guid>
{
    public const int MaxNameLength = 100;
    public const int TokenLength = 43;

    public Guid ClinicBranchId { get; private set; }
    public string Name { get; private set; } = string.Empty;

    /// <summary>Lowercase hex SHA-256 of the token.</summary>
    public string TokenHash { get; private set; } = string.Empty;

    public DateTimeOffset? RevokedAt { get; private set; }

    /// <summary>The last time the iPad asked for its screen.</summary>
    public DateTimeOffset? LastSeenAt { get; private set; }

    public bool IsActive => RevokedAt == null;

    protected SigningDevice() { }

    /// <summary>Pairs a device; the token is returned once and never again.</summary>
    public static (SigningDevice Device, string Token) Pair(Guid id, Guid clinicBranchId, string name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.SigningDeviceNameRequired);
        }

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var device = new SigningDevice
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Name = trimmed.Length > MaxNameLength ? trimmed[..MaxNameLength] : trimmed,
            TokenHash = HashToken(token)
        };
        return (device, token);
    }

    public static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    public void Revoke(DateTimeOffset now) => RevokedAt ??= now;

    public void MarkSeen(DateTimeOffset now) => LastSeenAt = now;
}
