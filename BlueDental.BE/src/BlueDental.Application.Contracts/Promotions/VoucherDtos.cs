using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Promotions;

public class VoucherDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Prefix { get; set; }
    public string? Description { get; set; }
    public string DiscountType { get; set; } = string.Empty;
    public decimal DiscountValue { get; set; }
    public decimal? MinOrderValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public string ScopeTarget { get; set; } = string.Empty;
    public List<string> TargetIds { get; set; } = [];
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int? UsageLimit { get; set; }
    public int UsedCount { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsPublished { get; set; }
    public DateTime? PublishedAt { get; set; }
    public bool IsExclusive { get; set; }
    public string[] CustomerTargets { get; set; } = [];
    public int? PerCustomerLimit { get; set; }
    public bool IsDaysOfWeekLimited { get; set; }
    public int[] DaysOfWeek { get; set; } = [];
    public bool DisplayOnNfcDental { get; set; }
    public Guid? ClinicBranchId { get; set; }
    public new bool IsDeleted { get; set; }
}

public class CreateVoucherDto
{
    [MaxLength(20)]
    public string? Prefix { get; set; }

    [MaxLength(32)]
    public string? Code { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    [Required]
    public string DiscountType { get; set; } = "percentage";

    [Range(0.01, (double)decimal.MaxValue)]
    public decimal DiscountValue { get; set; }

    public decimal? MaxDiscountAmount { get; set; }

    [Required]
    public string ScopeTarget { get; set; } = "service";

    public List<string> TargetIds { get; set; } = [];
    public decimal? MinOrderValue { get; set; }

    [Required]
    public DateTime StartDate { get; set; }

    [Required]
    public DateTime EndDate { get; set; }

    public int? UsageLimit { get; set; }
    public int? PerCustomerLimit { get; set; }
    public bool IsExclusive { get; set; }
    public string[] CustomerTargets { get; set; } = ["new", "returning"];
    public bool IsDaysOfWeekLimited { get; set; }
    public int[] DaysOfWeek { get; set; } = [];
    public bool DisplayOnNfcDental { get; set; } = true;
    public Guid? BranchId { get; set; }
}

/// <summary>
/// One voucher of a batch. Every override is nullable: a null falls back to
/// the batch-level value, so "Cấu hình tất cả" sends bare code+name items
/// while per-code configuration fills the overrides in.
/// </summary>
public class VoucherBatchItemDto
{
    [MaxLength(32)]
    public string? Code { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
    public string? DiscountType { get; set; }
    public decimal? DiscountValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public string? ScopeTarget { get; set; }
    public List<string>? TargetIds { get; set; }
    public decimal? MinOrderValue { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int? UsageLimit { get; set; }
    public int? PerCustomerLimit { get; set; }
    public bool? IsExclusive { get; set; }
    public string[]? CustomerTargets { get; set; }
    public bool? IsDaysOfWeekLimited { get; set; }
    public int[]? DaysOfWeek { get; set; }
    public bool? DisplayOnNfcDental { get; set; }
}

public class CreateVoucherBatchDto
{
    [MaxLength(20)]
    public string? Prefix { get; set; }

    [Range(1, 100)]
    public int Count { get; set; }

    public bool ConfigureAll { get; set; }

    public List<VoucherBatchItemDto> Items { get; set; } = [];

    [Required]
    public string DiscountType { get; set; } = "percentage";

    [Range(0.01, (double)decimal.MaxValue)]
    public decimal DiscountValue { get; set; }

    public decimal? MaxDiscountAmount { get; set; }

    [Required]
    public string ScopeTarget { get; set; } = "service";

    public List<string> TargetIds { get; set; } = [];
    public decimal? MinOrderValue { get; set; }

    [Required]
    public DateTime StartDate { get; set; }

    [Required]
    public DateTime EndDate { get; set; }

    public int? UsageLimit { get; set; }
    public int? PerCustomerLimit { get; set; }
    public bool IsExclusive { get; set; }
    public string[] CustomerTargets { get; set; } = ["new", "returning"];
    public bool IsDaysOfWeekLimited { get; set; }
    public int[] DaysOfWeek { get; set; } = [];
    public bool DisplayOnNfcDental { get; set; } = true;
    public Guid? BranchId { get; set; }
    public string? Description { get; set; }
}

public class UpdateVoucherDto
{
    /// <summary>Blank means "generate a fresh code", mirroring create.</summary>
    [MaxLength(50)]
    public string? Code { get; set; }

    /// <summary>
    /// Blank keeps the voucher's stored prefix; sending one adopts it — this
    /// is how pre-prefix vouchers get healed on their next edit.
    /// </summary>
    [MaxLength(20)]
    public string? Prefix { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    [Required]
    public string DiscountType { get; set; } = "percentage";

    [Required]
    public decimal DiscountValue { get; set; }

    [Required]
    public string ScopeTarget { get; set; } = "service";

    public List<string> TargetIds { get; set; } = [];
    public decimal? MinOrderValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public string[] CustomerTargets { get; set; } = ["new", "returning"];
    public bool IsExclusive { get; set; }
    public int? PerCustomerLimit { get; set; }
    public bool IsDaysOfWeekLimited { get; set; }
    public int[] DaysOfWeek { get; set; } = [];
    public bool DisplayOnNfcDental { get; set; } = true;

    [Required]
    public DateTime StartDate { get; set; }

    [Required]
    public DateTime EndDate { get; set; }

    public int? UsageLimit { get; set; }
}

public class GetVoucherListInput : PagedAndSortedResultRequestDto
{
    public Guid? BranchId { get; set; }
    public string? Status { get; set; }
    public string? Filter { get; set; }
}

public class GetAvailableVouchersInput
{
    public Guid? ClinicBranchId { get; set; }
    public decimal OrderAmount { get; set; }
    public DateOnly? OnDate { get; set; }
}

public class RedeemVoucherInput
{
    public decimal OrderAmount { get; set; }
    public DateOnly? OnDate { get; set; }
}

/// <summary>
/// The server-owned prefix the create dialog shows before every voucher code.
/// </summary>
public class VoucherCodePrefixDto
{
    public string Prefix { get; set; } = string.Empty;
}

public class VoucherRedemptionResultDto
{
    public Guid VoucherId { get; set; }
    public string Code { get; set; } = string.Empty;
    public decimal DiscountAmount { get; set; }
    public decimal AmountAfterDiscount { get; set; }
    public int UsedCount { get; set; }
    public int? RemainingUses { get; set; }
    public string Status { get; set; } = string.Empty;
}
