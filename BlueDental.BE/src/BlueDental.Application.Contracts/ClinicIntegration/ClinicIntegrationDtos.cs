using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace BlueDental.ClinicIntegration;

/// <summary>
/// <c>GET …/sync/{branchId}/flags</c>. Field names follow the reference's
/// payload (<c>status</c>, <c>invoiceSyncEnabled</c>, <c>serviceCatalogSyncEnabled</c>).
/// A flag reads true only when the link is active and the flag is on, so the
/// screen can trust it on its own. <c>status</c> is <c>"none"</c> when the
/// branch has no connection.
/// </summary>
public class ClinicSyncFlagsDto
{
    public string Status { get; set; } = "none";
    public bool InvoiceSyncEnabled { get; set; }
    public bool ServiceCatalogSyncEnabled { get; set; }
}

/// <summary>One nhóm dịch vụ of the "Chọn danh mục dịch vụ cần đồng bộ" dialog.</summary>
public class ServiceCatalogGroupDto
{
    public Guid TaxonomyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TotalServices { get; set; }
    public int SyncedServices { get; set; }
    public List<ServiceCatalogSyncItemDto> Services { get; set; } = [];
}

public class ServiceCatalogSyncItemDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>Null means "Chưa có mã" — the service cannot be synced.</summary>
    public string? Code { get; set; }

    /// <summary>The partner holds this service exactly as it is now.</summary>
    public bool Synced { get; set; }

    public bool IsDeleted { get; set; }
}

/// <summary>
/// The dialog sends whole groups as <c>taxonomyIds</c> and the picks of a
/// partly-ticked group as <c>serviceIds</c> — the reference's payload.
/// </summary>
public class SyncServiceCatalogInput
{
    public List<Guid>? TaxonomyIds { get; set; }
    public List<Guid>? ServiceIds { get; set; }
}

public class ServiceCatalogSyncResultDto
{
    public ServiceCatalogSyncSummaryDto Summary { get; set; } = new();
    public List<ServiceCatalogSyncDuplicateDto> Duplicated { get; set; } = [];
    public List<ServiceCatalogSyncNoteDto> Warned { get; set; } = [];
    public List<ServiceCatalogSyncNoteDto> Skipped { get; set; } = [];
    public List<ServiceCatalogSyncUpdateDto> Updated { get; set; } = [];
    public List<ServiceCatalogSyncBatchErrorDto> BatchErrors { get; set; } = [];
}

public class ServiceCatalogSyncSummaryDto
{
    public int Total { get; set; }
    public int Sent { get; set; }
    public int Updated { get; set; }
    public int Failed { get; set; }
    public int Skipped { get; set; }
}

public class ServiceCatalogSyncDuplicateDto
{
    public string? Code { get; set; }
    public string DentalName { get; set; } = string.Empty;
    public string? SystemName { get; set; }
    public string ExternalId { get; set; } = string.Empty;
}

public class ServiceCatalogSyncNoteDto
{
    public string? Code { get; set; }
    public string? Reason { get; set; }
    public string ExternalId { get; set; } = string.Empty;
}

public class ServiceCatalogSyncUpdateDto
{
    public string? Code { get; set; }
    public string ExternalId { get; set; } = string.Empty;
    public bool Relinked { get; set; }
}

public class ServiceCatalogSyncBatchErrorDto
{
    public string Reason { get; set; } = string.Empty;
    public string? Message { get; set; }
}

/// <summary>A branch's link to the partner. The API key never comes back — only whether one is set.</summary>
public class ClinicConnectionDto
{
    public Guid Id { get; set; }
    public Guid ClinicBranchId { get; set; }
    public string BaseUrl { get; set; } = string.Empty;
    public bool HasApiKey { get; set; }

    /// <summary><c>pending</c>, <c>active</c> or <c>failed</c>.</summary>
    public string Status { get; set; } = string.Empty;

    public DateTime? LastHandshakeTime { get; set; }
    public string? LastError { get; set; }
    public bool InvoiceSyncEnabled { get; set; }
    public bool ServiceCatalogSyncEnabled { get; set; }
}

public class CreateClinicConnectionDto
{
    public Guid ClinicBranchId { get; set; }

    [Required]
    [StringLength(500)]
    public string BaseUrl { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string ApiKey { get; set; } = string.Empty;
}

public class UpdateClinicConnectionDto
{
    [Required]
    [StringLength(500)]
    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>Blank keeps the stored key.</summary>
    [StringLength(500)]
    public string? ApiKey { get; set; }
}

public class UpdateClinicSyncFlagsDto
{
    public bool? InvoiceSyncEnabled { get; set; }
    public bool? ServiceCatalogSyncEnabled { get; set; }
}
