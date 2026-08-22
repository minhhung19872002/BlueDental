using System;
using BlueDental.TreatmentManagement;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Promotions;

public class VoucherDto : FullAuditedEntityDto<Guid>
{
    public Guid? ClinicBranchId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public decimal? MinOrderAmount { get; set; }
    public VoucherCustomerTarget CustomerTarget { get; set; }
    public DateOnly ValidFrom { get; set; }
    public DateOnly ValidTo { get; set; }
    public int? UsageLimit { get; set; }
    public int UsedCount { get; set; }
    public int? RemainingUses { get; set; }
    public VoucherStatus Status { get; set; }
}

public class CreateVoucherDto
{
    public Guid? ClinicBranchId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public decimal? MinOrderAmount { get; set; }
    public VoucherCustomerTarget CustomerTarget { get; set; }
    public DateOnly ValidFrom { get; set; }
    public DateOnly ValidTo { get; set; }
    public int? UsageLimit { get; set; }
}

public class UpdateVoucherDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal? MinOrderAmount { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public VoucherCustomerTarget CustomerTarget { get; set; }
    public DateOnly ValidFrom { get; set; }
    public DateOnly ValidTo { get; set; }
}

public class GetVoucherListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public VoucherStatus? Status { get; set; }
    public VoucherCustomerTarget? CustomerTarget { get; set; }

    /// <summary>Matches code or name.</summary>
    public string? Filter { get; set; }
}

/// <summary>Stats bar of the voucher screen.</summary>
public class VoucherStatsDto
{
    /// <summary>Tổng voucher.</summary>
    public int Total { get; set; }

    /// <summary>Đang hoạt động.</summary>
    public int Active { get; set; }

    /// <summary>Đã phát hành — vouchers redeemed at least once.</summary>
    public int Issued { get; set; }

    /// <summary>Đã hết hạn.</summary>
    public int Expired { get; set; }

    public int TotalRedemptions { get; set; }
}

/// <summary>Query behind <c>/voucher/available</c>.</summary>
public class GetAvailableVouchersInput
{
    public Guid? ClinicBranchId { get; set; }
    public VoucherCustomerTarget CustomerTarget { get; set; } = VoucherCustomerTarget.All;
    public decimal OrderAmount { get; set; }
    public DateOnly? OnDate { get; set; }
}

public class RedeemVoucherInput
{
    public decimal OrderAmount { get; set; }
    public VoucherCustomerTarget CustomerTarget { get; set; } = VoucherCustomerTarget.All;
    public DateOnly? OnDate { get; set; }
}

public class VoucherRedemptionResultDto
{
    public Guid VoucherId { get; set; }
    public string Code { get; set; } = string.Empty;
    public decimal DiscountAmount { get; set; }
    public decimal AmountAfterDiscount { get; set; }
    public int UsedCount { get; set; }
    public int? RemainingUses { get; set; }
    public VoucherStatus Status { get; set; }
}
