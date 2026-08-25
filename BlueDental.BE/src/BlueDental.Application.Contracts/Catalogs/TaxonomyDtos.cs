using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Catalogs;

public class TaxonomyDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Group { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Alias { get; set; }
    public string? Color { get; set; }
    public string? Description { get; set; }
    public string? SubGroup { get; set; }
    public bool IsSystem { get; set; }
    public int SortOrder { get; set; }
    public bool IsPriced { get; set; }
    public bool IsTemplated { get; set; }

    /// <summary>Reference field <c>itemCount</c> — populated when includeCount is set.</summary>
    public int ItemCount { get; set; }
}

public class CreateTaxonomyDto
{
    public Guid ClinicBranchId { get; set; }
    public string Group { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Alias { get; set; }
    public string? Color { get; set; }
    public string? Description { get; set; }
    public string? SubGroup { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateTaxonomyDto
{
    public string Name { get; set; } = string.Empty;
    public string? Alias { get; set; }
    public string? Color { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>One row and the position it should hold.</summary>
public class ReorderItemDto
{
    public Guid Id { get; set; }

    /// <summary>Zero-based position, named as the reference names it.</summary>
    public int Order { get; set; }
}

/// <summary>
/// Reordering is one call carrying the whole list, the way the reference does
/// it — writing a row at a time would leave the catalog half-sorted if any one
/// of the writes failed, and would put N requests on the wire for one drag.
/// </summary>
public class ReorderTaxonomyDto
{
    public Guid? ClinicBranchId { get; set; }

    /// <summary>The catalog whose groups are being ordered.</summary>
    public string Group { get; set; } = string.Empty;

    public List<ReorderItemDto> Items { get; set; } = [];
}

/// <summary>Same, for the entries inside one group.</summary>
public class ReorderCatalogEntryDto
{
    public Guid? ClinicBranchId { get; set; }
    public string Group { get; set; } = string.Empty;

    /// <summary>The group the entries belong to; null on the flat catalogs.</summary>
    public Guid? TaxonomyId { get; set; }

    public List<ReorderItemDto> Items { get; set; } = [];
}

public class GetTaxonomyListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public string? Group { get; set; }
    public string? Filter { get; set; }

    /// <summary>Mirrors the reference <c>includeCount=true</c> query flag.</summary>
    public bool IncludeCount { get; set; }
}

/// <summary>
/// "Cấu hình giá &amp; thuế" and the three setting tabs — sent only by the
/// service catalog, whose dialog is the only one that shows them.
/// </summary>
public class ServiceConfigDto
{
    public ServiceTaxRate TaxRate { get; set; }
    public bool PriceIncludesTax { get; set; }
    public bool DiscountIsPercent { get; set; } = true;
    public decimal DiscountValue { get; set; }
    public bool RequireImage { get; set; }
    public bool DeductDoctorOnWarranty { get; set; }
    public bool SeparateRevenue { get; set; }
    public bool ShowToothOnInvoice { get; set; }
    public bool RevenueByStage { get; set; }
    public bool RequireStageSequence { get; set; }
    public int WarrantyDays { get; set; }

    /// <summary>Read side only — "Giá sau giảm", computed by the domain.</summary>
    public decimal PriceAfterDiscount { get; set; }

    /// <summary>Read side only — "Thực thu từ khách (Đã gồm VAT)".</summary>
    public decimal AmountCollected { get; set; }
}

/// <summary>One row of the service dialog's "Công đoạn" table.</summary>
public class ServiceStageDto
{
    public Guid Id { get; set; }

    [Required]
    [StringLength(400)]
    public string Name { get; set; } = string.Empty;

    public decimal Value { get; set; }
}

/// <summary>The fields only "Loại thuốc" carries.</summary>
public class MedicineDto
{
    [StringLength(400)]
    public string? ActiveIngredient { get; set; }

    [StringLength(1000)]
    public string? Usage { get; set; }

    public decimal PurchasePrice { get; set; }

    [StringLength(100)]
    public string? PrescriptionCode { get; set; }

    [StringLength(1000)]
    public string? UsageNote { get; set; }
}

/// <summary>One medicine line of a "Đơn thuốc mẫu".</summary>
public class PrescriptionTemplateLineDto
{
    public Guid Id { get; set; }
    public Guid MedicineEntryId { get; set; }
    public int TimesPerDay { get; set; } = 1;
    public decimal AmountPerTime { get; set; } = 1;
    public int Days { get; set; } = 1;
    public PrescriptionUsage Usage { get; set; }

    /// <summary>Read side only — the reference shows this box disabled.</summary>
    public decimal Quantity { get; set; }

    /// <summary>Read side only, for the table.</summary>
    public string? MedicineName { get; set; }
}

public class CatalogEntryDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public Guid TaxonomyId { get; set; }
    public string Group { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public string? Content { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }

    /// <summary>"Tên chi tiết" on a service.</summary>
    public string? DetailName { get; set; }

    /// <summary>"Ghi chú" on a diagnosis or a piece of consulting data.</summary>
    public string? Note { get; set; }

    /// <summary>"Đơn vị" / "Đơn vị tính".</summary>
    public string? Unit { get; set; }

    public ServiceConfigDto? ServiceConfig { get; set; }
    public MedicineDto? Medicine { get; set; }
    public List<ServiceStageDto> Stages { get; set; } = [];
    public List<PrescriptionTemplateLineDto> PrescriptionLines { get; set; } = [];

    public string? TaxonomyName { get; set; }
}

public class CreateCatalogEntryDto
{
    public Guid ClinicBranchId { get; set; }
    public Guid TaxonomyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public decimal? Price { get; set; }
    public string? Content { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }

    /// <summary>"Tên chi tiết" — services only.</summary>
    [StringLength(400)]
    public string? DetailName { get; set; }

    /// <summary>"Ghi chú" — chẩn đoán and dữ liệu tư vấn.</summary>
    [StringLength(2000)]
    public string? Note { get; set; }

    /// <summary>"Đơn vị" / "Đơn vị tính".</summary>
    [StringLength(50)]
    public string? Unit { get; set; }

    /// <summary>Sent by the service dialog only.</summary>
    public ServiceConfigDto? ServiceConfig { get; set; }

    /// <summary>Sent by the medicine dialog only.</summary>
    public MedicineDto? Medicine { get; set; }

    /// <summary>The whole "Công đoạn" table, as the dialog edits it.</summary>
    public List<ServiceStageDto>? Stages { get; set; }

    /// <summary>The whole medicine-line table of a prescription template.</summary>
    public List<PrescriptionTemplateLineDto>? PrescriptionLines { get; set; }
}

public class UpdateCatalogEntryDto
{
    public Guid TaxonomyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public decimal? Price { get; set; }
    public string? Content { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }

    /// <summary>
    /// The other half of the dialog's one state: true parks this entry as
    /// deleted, false brings it back. Honoured only for the catalogs whose
    /// dialog shows the pair.
    /// </summary>
    public bool IsDeleted { get; set; }

    public int SortOrder { get; set; }

    /// <summary>"Tên chi tiết" — services only.</summary>
    [StringLength(400)]
    public string? DetailName { get; set; }

    /// <summary>"Ghi chú" — chẩn đoán and dữ liệu tư vấn.</summary>
    [StringLength(2000)]
    public string? Note { get; set; }

    /// <summary>"Đơn vị" / "Đơn vị tính".</summary>
    [StringLength(50)]
    public string? Unit { get; set; }

    /// <summary>Sent by the service dialog only.</summary>
    public ServiceConfigDto? ServiceConfig { get; set; }

    /// <summary>Sent by the medicine dialog only.</summary>
    public MedicineDto? Medicine { get; set; }

    /// <summary>The whole "Công đoạn" table, as the dialog edits it.</summary>
    public List<ServiceStageDto>? Stages { get; set; }

    /// <summary>The whole medicine-line table of a prescription template.</summary>
    public List<PrescriptionTemplateLineDto>? PrescriptionLines { get; set; }
}

public class GetCatalogEntryListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public Guid? TaxonomyId { get; set; }
    public string? Group { get; set; }
    public bool? IsActive { get; set; }
    public string? Filter { get; set; }
}
