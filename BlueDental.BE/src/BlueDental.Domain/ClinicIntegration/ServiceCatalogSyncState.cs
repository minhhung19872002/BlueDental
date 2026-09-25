using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.ClinicIntegration;

/// <summary>
/// What the partner last accepted for one catalog service. The fingerprint is
/// of the payload that was sent, so an unchanged service is not sent again and
/// a service edited since shows as no longer synced.
/// </summary>
public class ServiceCatalogSyncState : Entity<Guid>
{
    public const int FingerprintLength = 64;
    public const int MaxPartnerIdLength = 200;

    public Guid ClinicBranchId { get; private set; }

    public Guid CatalogEntryId { get; private set; }

    public string Fingerprint { get; private set; } = string.Empty;

    /// <summary>The partner's own id for the service, when it returns one.</summary>
    public string? PartnerServiceId { get; private set; }

    public DateTime LastSyncedTime { get; private set; }

    protected ServiceCatalogSyncState() { }

    public ServiceCatalogSyncState(Guid id, Guid clinicBranchId, Guid catalogEntryId)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        CatalogEntryId = catalogEntryId;
    }

    public bool IsCurrent(string fingerprint) =>
        string.Equals(Fingerprint, fingerprint, StringComparison.Ordinal);

    public void MarkSynced(string fingerprint, string? partnerServiceId, DateTime at)
    {
        Fingerprint = Check.NotNullOrWhiteSpace(fingerprint, nameof(fingerprint), FingerprintLength);
        PartnerServiceId = Check.Length(partnerServiceId, nameof(partnerServiceId), MaxPartnerIdLength)
            ?? PartnerServiceId;
        LastSyncedTime = at;
    }
}
