using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace BlueDental.ClinicIntegration;

/// <summary>
/// The partner system the branch is linked to. The reference sends its service
/// catalog to a partner it calls "System", but what goes over that wire could
/// not be observed (it is a POST). The contract below is BlueDental's own —
/// docs/clone/api.md § Clinic integration, UNKNOWN_REFERENCE_BEHAVIOR.
/// </summary>
public interface IClinicPartnerClient
{
    Task<PartnerCallOutcome> HandshakeAsync(PartnerEndpoint endpoint, Guid clinicBranchId, CancellationToken cancellationToken = default);

    Task<PartnerBatchOutcome> UpsertServicesAsync(
        PartnerEndpoint endpoint,
        Guid clinicBranchId,
        IReadOnlyList<PartnerServiceItem> items,
        CancellationToken cancellationToken = default);
}

public sealed record PartnerEndpoint(string BaseUrl, string ApiKey);

/// <summary>How one HTTP call went, for the call log and the caller.</summary>
public record PartnerCallOutcome(
    string RequestPath,
    int? StatusCode,
    bool Succeeded,
    long DurationMs,
    string? Error);

public sealed record PartnerBatchOutcome(
    string RequestPath,
    int? StatusCode,
    bool Succeeded,
    long DurationMs,
    string? Error,
    IReadOnlyList<PartnerServiceResult> Results)
    : PartnerCallOutcome(RequestPath, StatusCode, Succeeded, DurationMs, Error);

/// <summary>One service as the partner receives it. <c>ExternalId</c> is BlueDental's id.</summary>
public sealed record PartnerServiceItem(
    string ExternalId,
    string Code,
    string Name,
    string? DetailName,
    string? GroupName,
    string? Unit,
    decimal Price,
    string TaxRate,
    bool PriceIncludesTax,
    bool DiscountIsPercent,
    decimal DiscountValue,
    decimal PriceAfterDiscount,
    decimal AmountCollected,
    bool IsActive,
    bool IsDeleted);

public sealed record PartnerServiceResult(
    string ExternalId,
    PartnerServiceStatus Status,
    string? SystemId,
    string? SystemName,
    string? Reason,
    bool Relinked);
