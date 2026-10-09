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

    /// <summary>
    /// Tab "Labo" — the suppliers a labo slip for this service may pick from;
    /// empty means all of them. Every id must be a supplier of the entry's branch.
    /// </summary>
    public List<Guid> LaboSupplierIds { get; set; } = [];

    /// <summary>Read side only — "BE:Field:PriceAfterDiscount", computed by the domain.</summary>
    public decimal PriceAfterDiscount { get; set; }

    /// <summary>Read side only — "BE:Field:AmountCollected".</summary>
    public decimal AmountCollected { get; set; }
}

/// <summary>One row of the service dialog's "BE:Common:Stage" table.</summary>
public class ServiceStageDto
{
    public Guid Id { get; set; }

    [Required]
    [StringLength(400)]
    public string Name { get; set; } = string.Empty;

    public decimal Value { get; set; }

    /// <summary>The "%" / "VNĐ" switch; a new row on the reference starts as a percentage.</summary>
    public ServiceStageValueType ValueType { get; set; } = ServiceStageValueType.Percentage;

    /// <summary>The star — "Tính lương cho phòng MKT".</summary>
    public bool IsMarketingSalary { get; set; }
}

/// <summary>The fields only "BE:Common:MedicineType" carries.</summary>
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

/// <summary>One medicine line of a "BE:Common:RxTemplate".</summary>
public class PrescriptionTemplateLineDto
{
    public Guid Id { get; set; }
    public Guid MedicineEntryId { get; set; }
    /// <summary>Sáng / trưa / chiều / tối — the same session dosing as a prescription line.</summary>
    public decimal Morning { get; set; } = 1;
    public decimal Noon { get; set; }
    public decimal Afternoon { get; set; }
    public decimal Evening { get; set; }
    public int Days { get; set; } = 1;
    public PrescriptionUsage Usage { get; set; }

    /// <summary>What the user wrote for "BE:Common:Other"; required when that flag is set.</summary>
    public string? OtherUsage { get; set; }

    /// <summary>Read side only — the reference shows this box disabled.</summary>
    public decimal Quantity { get; set; }

    /// <summary>Read side only, for the table.</summary>
    public string? MedicineName { get; set; }
}

/// <summary>One "Thành phần combo" row of a combo (review P0510).</summary>
public class CatalogComboItemDto
{
    public Guid Id { get; set; }

    /// <summary>The single service the row puts in the combo.</summary>
    public Guid ComponentEntryId { get; set; }

    public int Quantity { get; set; } = 1;

    /// <summary>"Thành tiền" — one unit's price inside the combo.</summary>
    public decimal UnitPrice { get; set; }

    /// <summary>Read side only — the component's name.</summary>
    public string? ComponentName { get; set; }

    /// <summary>Read side only — the component's code.</summary>
    public string? ComponentCode { get; set; }

    /// <summary>Read side only — "Giá lẻ", the component's own catalogue price, read live.</summary>
    public decimal? ComponentPrice { get; set; }
}

/// <summary>
/// A live combo that holds a service — what the delete confirmation names,
/// since deleting the service takes it out of these combos.
/// </summary>
public class CatalogComboHolderDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }

    /// <summary>The service is the combo's only component, so the delete is refused.</summary>
    public bool IsLastComponent { get; set; }
}

/// <summary>How many entries the "Tất cả / Dịch vụ lẻ / Combo" filter of Danh mục holds.</summary>
public class CatalogEntryKindCountsDto
{
    public int Total { get; set; }
    public int Single { get; set; }
    public int Combo { get; set; }
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

    /// <summary>"BE:Field:DetailName" on a service.</summary>
    public string? DetailName { get; set; }

    /// <summary>"BE:Field:Note" on a diagnosis or a piece of consulting data.</summary>
    public string? Note { get; set; }

    /// <summary>"BE:Field:Unit" / "BE:Field:UnitOfMeasure".</summary>
    public string? Unit { get; set; }

    public ServiceConfigDto? ServiceConfig { get; set; }
    public MedicineDto? Medicine { get; set; }
    public List<ServiceStageDto> Stages { get; set; } = [];
    public List<PrescriptionTemplateLineDto> PrescriptionLines { get; set; } = [];

    /// <summary>A combo of the dịch vụ catalog; its price is the sum of <see cref="ComboItems"/>.</summary>
    public bool IsCombo { get; set; }

    public List<CatalogComboItemDto> ComboItems { get; set; } = [];

    /// <summary>
    /// Read side, combos only — "Tổng giá lẻ": each component's catalogue price
    /// times its quantity, summed. Null on a single service.
    /// </summary>
    public decimal? RetailPrice { get; set; }

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

    /// <summary>"BE:Field:DetailName" — services only.</summary>
    [StringLength(400)]
    public string? DetailName { get; set; }

    /// <summary>"BE:Field:Note" — chẩn đoán and dữ liệu tư vấn.</summary>
    [StringLength(2000)]
    public string? Note { get; set; }

    /// <summary>"BE:Field:Unit" / "BE:Field:UnitOfMeasure".</summary>
    [StringLength(50)]
    public string? Unit { get; set; }

    /// <summary>Sent by the service dialog only.</summary>
    public ServiceConfigDto? ServiceConfig { get; set; }

    /// <summary>Sent by the medicine dialog only.</summary>
    public MedicineDto? Medicine { get; set; }

    /// <summary>The whole "BE:Common:Stage" table, as the dialog edits it.</summary>
    public List<ServiceStageDto>? Stages { get; set; }

    /// <summary>The whole medicine-line table of a prescription template.</summary>
    public List<PrescriptionTemplateLineDto>? PrescriptionLines { get; set; }

    /// <summary>Creates a combo rather than a single service — dịch vụ catalog only.</summary>
    public bool IsCombo { get; set; }

    /// <summary>The whole "Thành phần combo" table; required when <see cref="IsCombo"/>.</summary>
    public List<CatalogComboItemDto>? ComboItems { get; set; }
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

    /// <summary>"BE:Field:DetailName" — services only.</summary>
    [StringLength(400)]
    public string? DetailName { get; set; }

    /// <summary>"BE:Field:Note" — chẩn đoán and dữ liệu tư vấn.</summary>
    [StringLength(2000)]
    public string? Note { get; set; }

    /// <summary>"BE:Field:Unit" / "BE:Field:UnitOfMeasure".</summary>
    [StringLength(50)]
    public string? Unit { get; set; }

    /// <summary>Sent by the service dialog only.</summary>
    public ServiceConfigDto? ServiceConfig { get; set; }

    /// <summary>Sent by the medicine dialog only.</summary>
    public MedicineDto? Medicine { get; set; }

    /// <summary>The whole "BE:Common:Stage" table, as the dialog edits it.</summary>
    public List<ServiceStageDto>? Stages { get; set; }

    /// <summary>The whole medicine-line table of a prescription template.</summary>
    public List<PrescriptionTemplateLineDto>? PrescriptionLines { get; set; }

    /// <summary>The whole "Thành phần combo" table; null leaves a combo's rows as they are.</summary>
    public List<CatalogComboItemDto>? ComboItems { get; set; }
}

public class GetCatalogEntryListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public Guid? TaxonomyId { get; set; }
    public string? Group { get; set; }
    public bool? IsActive { get; set; }
    /// <summary>
    /// Narrows by the soft-delete state. Unset, a soft-deletable catalog lists
    /// its deleted rows too (the Danh mục table shows them); a picker that only
    /// offers live rows — "Chọn Dịch Vụ", after the reference's
    /// <c>isDeleted: false</c> — asks for <c>false</c>.
    /// </summary>
    public bool? IsDeleted { get; set; }

    /// <summary>
    /// Narrows the dịch vụ catalog to its combos (true) or its single services
    /// (false) — Danh mục's "Dịch vụ lẻ / Combo" filter, and "Chọn Dịch Vụ",
    /// whose Dịch vụ lẻ list must not offer a combo as a service.
    /// </summary>
    public bool? IsCombo { get; set; }

    public string? Filter { get; set; }
}
