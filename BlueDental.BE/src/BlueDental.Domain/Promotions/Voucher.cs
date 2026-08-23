using System;
using BlueDental.TreatmentManagement;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Promotions;

/// <summary>
/// A promotional voucher applied to consulting lines and treatment plans
/// (Voucher khuyến mãi).
///
/// Reference: <c>/voucher</c> screen plus <c>/api/v1/voucher/available</c>, which
/// the patient screen calls to offer applicable vouchers. Applied vouchers show
/// up on advises as <c>appliedCoupons</c> / <c>voucherDiscountAmount</c>.
/// </summary>
public class Voucher : FullAuditedAggregateRoot<Guid>
{
    public Guid? ClinicBranchId { get; private set; }

    /// <summary>Mã voucher — unique, upper case.</summary>
    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    public DiscountType DiscountType { get; private set; }
    public decimal DiscountValue { get; private set; }

    /// <summary>Caps a percentage discount; ignored for money discounts.</summary>
    public decimal? MaxDiscountAmount { get; private set; }

    /// <summary>Điều kiện áp dụng — minimum order value.</summary>
    public decimal? MinOrderAmount { get; private set; }

    public VoucherCustomerTarget CustomerTarget { get; private set; }

    public DateOnly ValidFrom { get; private set; }
    public DateOnly ValidTo { get; private set; }

    /// <summary>Total redemptions allowed; null means unlimited.</summary>
    public int? UsageLimit { get; private set; }

    /// <summary>Lượt dùng.</summary>
    public int UsedCount { get; private set; }

    public VoucherStatus Status { get; private set; }

    protected Voucher() { }

    public static Voucher Issue(
        Guid id,
        string code,
        string name,
        DiscountType discountType,
        decimal discountValue,
        DateOnly validFrom,
        DateOnly validTo,
        Guid? clinicBranchId = null,
        decimal? maxDiscountAmount = null,
        decimal? minOrderAmount = null,
        VoucherCustomerTarget customerTarget = VoucherCustomerTarget.All,
        int? usageLimit = null,
        string? description = null)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));
        Check.NotNullOrWhiteSpace(name, nameof(name));

        if (discountType == DiscountType.None)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.InvalidDiscount,
                "A voucher must define a discount type.");
        }

        if (discountValue <= 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.InvalidDiscount,
                "A voucher discount must be greater than zero.");
        }

        if (discountType == DiscountType.Percentage && discountValue > 100m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.InvalidDiscount,
                "A percentage discount must not exceed 100.");
        }

        if (validTo < validFrom)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.InvalidValidityWindow,
                "A voucher must expire on or after the day it becomes valid.");
        }

        if (usageLimit is <= 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.InvalidUsageLimit,
                "The usage limit must be greater than zero when set.");
        }

        return new Voucher
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Code = code.Trim().ToUpperInvariant(),
            Name = name,
            Description = description,
            DiscountType = discountType,
            DiscountValue = discountValue,
            MaxDiscountAmount = maxDiscountAmount,
            MinOrderAmount = minOrderAmount,
            CustomerTarget = customerTarget,
            ValidFrom = validFrom,
            ValidTo = validTo,
            UsageLimit = usageLimit,
            UsedCount = 0,
            Status = VoucherStatus.Draft
        };
    }

    public Voucher Activate()
    {
        if (Status == VoucherStatus.Expired)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.VoucherExpired,
                "An expired voucher cannot be activated.");
        }

        Status = VoucherStatus.Active;
        return this;
    }

    public Voucher Pause()
    {
        if (Status != VoucherStatus.Active)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.InvalidVoucherTransition,
                $"Only an active voucher can be paused (current: {Status}).");
        }

        Status = VoucherStatus.Paused;
        return this;
    }

    public Voucher Expire()
    {
        Status = VoucherStatus.Expired;
        return this;
    }

    public Voucher UpdateDetails(
        string name,
        string? description,
        decimal? minOrderAmount,
        decimal? maxDiscountAmount,
        VoucherCustomerTarget customerTarget)
    {
        GuardNotRedeemed();
        Check.NotNullOrWhiteSpace(name, nameof(name));

        Name = name;
        Description = description;
        MinOrderAmount = minOrderAmount;
        MaxDiscountAmount = maxDiscountAmount;
        CustomerTarget = customerTarget;
        return this;
    }

    public Voucher Reschedule(DateOnly validFrom, DateOnly validTo)
    {
        if (validTo < validFrom)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.InvalidValidityWindow,
                "A voucher must expire on or after the day it becomes valid.");
        }

        ValidFrom = validFrom;
        ValidTo = validTo;
        return this;
    }

    /// <summary>Lượt dùng còn lại; null when the voucher is unlimited.</summary>
    public int? RemainingUses => UsageLimit.HasValue ? UsageLimit.Value - UsedCount : null;

    public bool IsExhausted => UsageLimit.HasValue && UsedCount >= UsageLimit.Value;

    /// <summary>Can this voucher be applied to the given order right now?</summary>
    public bool IsAvailableFor(DateOnly onDate, decimal orderAmount, VoucherCustomerTarget customerTarget)
    {
        if (Status != VoucherStatus.Active) return false;
        if (onDate < ValidFrom || onDate > ValidTo) return false;
        if (IsExhausted) return false;
        if (MinOrderAmount.HasValue && orderAmount < MinOrderAmount.Value) return false;

        return CustomerTarget == VoucherCustomerTarget.All ||
               CustomerTarget == customerTarget;
    }

    /// <summary>Discount this voucher grants on the given amount, capped so it never exceeds it.</summary>
    public decimal CalculateDiscount(decimal orderAmount)
    {
        if (orderAmount <= 0m)
        {
            return 0m;
        }

        var discount = DiscountType switch
        {
            DiscountType.Money => DiscountValue,
            DiscountType.Percentage => orderAmount * DiscountValue / 100m,
            _ => 0m
        };

        if (MaxDiscountAmount.HasValue && discount > MaxDiscountAmount.Value)
        {
            discount = MaxDiscountAmount.Value;
        }

        return discount > orderAmount ? orderAmount : discount;
    }

    /// <summary>Consumes one redemption and returns the granted discount.</summary>
    public decimal Redeem(DateOnly onDate, decimal orderAmount, VoucherCustomerTarget customerTarget)
    {
        if (!IsAvailableFor(onDate, orderAmount, customerTarget))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable,
                $"Voucher {Code} cannot be applied to this order.");
        }

        UsedCount++;

        if (IsExhausted)
        {
            Status = VoucherStatus.Expired;
        }

        return CalculateDiscount(orderAmount);
    }

    private void GuardNotRedeemed()
    {
        if (UsedCount > 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.VoucherLocked,
                "A voucher that has already been redeemed can no longer be edited.");
        }
    }
}
