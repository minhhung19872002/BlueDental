using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Tools;

/// <summary>
/// A PBX provider connection — the rows of the "Cấu Hình" tab under
/// Công cụ → Gọi thoại.
/// </summary>
public class CallConfiguration : FullAuditedEntity<Guid>
{
    public Guid ClinicBranchId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public CallProvider Provider { get; private set; }

    /// <summary>"Mã khoá" — the provider API key.</summary>
    public string ApiKey { get; private set; } = string.Empty;

    /// <summary>"Mã bí mật" — a credential; never leaves the server.</summary>
    public string SecretKey { get; private set; } = string.Empty;

    public bool IsActive { get; private set; }

    private CallConfiguration() { }

    public CallConfiguration(
        Guid id, Guid clinicBranchId, string name, CallProvider provider,
        string apiKey, string secretKey, bool isActive)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        Name = Check.NotNullOrWhiteSpace(name, nameof(name), maxLength: 200);
        Provider = provider;
        ApiKey = Check.NotNullOrWhiteSpace(apiKey, nameof(apiKey), maxLength: 200);
        SecretKey = Check.NotNullOrWhiteSpace(secretKey, nameof(secretKey), maxLength: 200);
        IsActive = isActive;
    }

    public void Update(string name, CallProvider provider, string apiKey, string? secretKey, bool isActive)
    {
        Name = Check.NotNullOrWhiteSpace(name, nameof(name), maxLength: 200);
        Provider = provider;
        ApiKey = Check.NotNullOrWhiteSpace(apiKey, nameof(apiKey), maxLength: 200);

        // A blank secret means "keep the stored one" — the client is never
        // shown the secret, so an edit cannot echo it back.
        if (!string.IsNullOrWhiteSpace(secretKey))
        {
            SecretKey = Check.NotNullOrWhiteSpace(secretKey, nameof(secretKey), maxLength: 200);
        }

        IsActive = isActive;
    }
}

/// <summary>The providers the reference offers as selectable cards.</summary>
public enum CallProvider
{
    Voip24h = 0,
}
