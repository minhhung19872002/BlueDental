using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Promotions;

public class Voucher : FullAuditedAggregateRoot<Guid>
{
    public Guid? ClinicBranchId { get; private set; }
    public string? Prefix { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    public DiscountType DiscountType { get; private set; }
    public decimal DiscountValue { get; private set; }
    public decimal? MaxDiscountAmount { get; private set; }
    public decimal? MinOrderValue { get; private set; }

    public VoucherScopeTarget ScopeTarget { get; private set; }

    private List<Guid> _targetIds = [];
    public IReadOnlyList<Guid> TargetIds => _targetIds;

    public DateOnly ValidFrom { get; private set; }
    public DateOnly ValidTo { get; private set; }

    public int? UsageLimit { get; private set; }
    public int UsedCount { get; private set; }

    public VoucherStatus Status { get; private set; }

    public bool IsPublished { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public bool IsExclusive { get; private set; }

    private List<string> _customerTargets = ["new", "returning"];
    public IReadOnlyList<string> CustomerTargets => _customerTargets;

    public int? PerCustomerLimit { get; private set; }
    public bool IsDaysOfWeekLimited { get; private set; }

    private List<int> _daysOfWeek = [];
    public IReadOnlyList<int> DaysOfWeek => _daysOfWeek;

    public bool DisplayOnNfcDental { get; private set; }

    public int? RemainingUses => UsageLimit.HasValue ? UsageLimit.Value - UsedCount : null;
    public bool IsExhausted => UsageLimit.HasValue && UsedCount >= UsageLimit.Value;

    protected Voucher() { }

    public static Voucher Issue(
        Guid id,
        string code,
        string name,
        DiscountType discountType,
        decimal discountValue,
        DateOnly validFrom,
        DateOnly validTo,
        VoucherScopeTarget scopeTarget,
        Guid? clinicBranchId = null,
        string? prefix = null,
        List<Guid>? targetIds = null,
        decimal? maxDiscountAmount = null,
        decimal? minOrderValue = null,
        bool isExclusive = false,
        List<string>? customerTargets = null,
        int? usageLimit = null,
        int? perCustomerLimit = null,
        bool isDaysOfWeekLimited = false,
        List<int>? daysOfWeek = null,
        bool displayOnNfcDental = true,
        string? description = null)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));
        Check.NotNullOrWhiteSpace(name, nameof(name));

        if (discountType == DiscountType.None)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidDiscount);

        if (discountValue <= 0m)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidDiscount);

        if (discountType == DiscountType.Percentage && discountValue > 100m)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidDiscount);

        if (validTo < validFrom)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidValidityWindow);

        if (usageLimit is <= 0)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidUsageLimit);

        ValidateCustomerTargets(customerTargets);
        ValidateDaysOfWeek(daysOfWeek);

        return new Voucher
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Prefix = prefix?.Trim(),
            Code = code.Trim().ToUpperInvariant(),
            Name = name,
            Description = description,
            DiscountType = discountType,
            DiscountValue = discountValue,
            MaxDiscountAmount = maxDiscountAmount,
            MinOrderValue = minOrderValue,
            ScopeTarget = scopeTarget,
            _targetIds = targetIds ?? [],
            ValidFrom = validFrom,
            ValidTo = validTo,
            UsageLimit = usageLimit,
            UsedCount = 0,
            Status = VoucherStatus.Active,
            IsPublished = false,
            IsExclusive = isExclusive,
            _customerTargets = customerTargets ?? ["new", "returning"],
            PerCustomerLimit = perCustomerLimit,
            IsDaysOfWeekLimited = isDaysOfWeekLimited,
            _daysOfWeek = daysOfWeek ?? [],
            DisplayOnNfcDental = displayOnNfcDental
        };
    }

    public Voucher Publish()
    {
        if (Status == VoucherStatus.Expired)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.VoucherExpired);
        if (Status == VoucherStatus.OutOfUses)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidVoucherTransition);

        IsPublished = true;
        PublishedAt = DateTime.UtcNow;
        return this;
    }

    public Voucher Unpublish()
    {
        IsPublished = false;
        PublishedAt = null;
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
        VoucherScopeTarget scopeTarget,
        List<Guid>? targetIds,
        decimal? minOrderValue,
        decimal? maxDiscountAmount,
        bool isExclusive,
        List<string>? customerTargets,
        int? perCustomerLimit,
        bool isDaysOfWeekLimited,
        List<int>? daysOfWeek,
        bool displayOnNfcDental)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));
        ValidateCustomerTargets(customerTargets);
        ValidateDaysOfWeek(daysOfWeek);

        Name = name;
        Description = description;
        ScopeTarget = scopeTarget;
        _targetIds = targetIds ?? [];
        MinOrderValue = minOrderValue;
        MaxDiscountAmount = maxDiscountAmount;
        IsExclusive = isExclusive;
        _customerTargets = customerTargets ?? ["new", "returning"];
        PerCustomerLimit = perCustomerLimit;
        IsDaysOfWeekLimited = isDaysOfWeekLimited;
        _daysOfWeek = daysOfWeek ?? [];
        DisplayOnNfcDental = displayOnNfcDental;
        return this;
    }

    public Voucher ChangeCode(string code)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));
        Code = code.Trim().ToUpperInvariant();
        return this;
    }

    public Voucher ChangePrefix(string? prefix)
    {
        Prefix = prefix?.Trim();
        return this;
    }

    public Voucher ChangeDiscount(DiscountType discountType, decimal discountValue)
    {
        if (discountType == DiscountType.None)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidDiscount);

        if (discountValue <= 0m)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidDiscount);

        if (discountType == DiscountType.Percentage && discountValue > 100m)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidDiscount);

        DiscountType = discountType;
        DiscountValue = discountValue;
        return this;
    }

    public Voucher Reschedule(DateOnly validFrom, DateOnly validTo)
    {
        if (validTo < validFrom)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidValidityWindow);

        ValidFrom = validFrom;
        ValidTo = validTo;

        if (Status == VoucherStatus.Expired && validTo >= DateOnly.FromDateTime(DateTime.UtcNow))
            Status = VoucherStatus.Active;

        return this;
    }

    public Voucher UpdateUsageLimit(int? usageLimit)
    {
        if (usageLimit is <= 0)
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidUsageLimit);

        UsageLimit = usageLimit;

        if (Status == VoucherStatus.OutOfUses && !IsExhausted)
            Status = VoucherStatus.Active;

        return this;
    }

    public bool IsAvailableFor(DateOnly onDate, decimal orderAmount)
    {
        if (Status != VoucherStatus.Active) return false;
        if (!IsPublished) return false;
        if (onDate < ValidFrom || onDate > ValidTo) return false;
        if (IsExhausted) return false;
        if (MinOrderValue.HasValue && orderAmount < MinOrderValue.Value) return false;
        return true;
    }

    public decimal CalculateDiscount(decimal orderAmount)
    {
        if (orderAmount <= 0m) return 0m;

        var discount = DiscountType switch
        {
            DiscountType.Money => DiscountValue,
            DiscountType.Percentage => orderAmount * DiscountValue / 100m,
            _ => 0m
        };

        if (MaxDiscountAmount.HasValue && discount > MaxDiscountAmount.Value)
            discount = MaxDiscountAmount.Value;

        return discount > orderAmount ? orderAmount : discount;
    }

    public decimal Redeem(DateOnly onDate, decimal orderAmount)
    {
        if (!IsAvailableFor(onDate, orderAmount))
            throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable);

        UsedCount++;

        if (IsExhausted)
            Status = VoucherStatus.OutOfUses;

        return CalculateDiscount(orderAmount);
    }

    private static readonly HashSet<string> ValidCustomerTargetValues = ["new", "returning"];

    private static void ValidateCustomerTargets(List<string>? targets)
    {
        if (targets == null) return;
        foreach (var t in targets)
        {
            if (!ValidCustomerTargetValues.Contains(t))
                throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidVoucherTransition,
                    $"Invalid customer target: {t}");
        }
    }

    private static void ValidateDaysOfWeek(List<int>? days)
    {
        if (days == null) return;
        foreach (var d in days)
        {
            if (d < 1 || d > 7)
                throw new BusinessException(BlueDentalDomainErrorCodes.Promotions.InvalidVoucherTransition,
                    $"Day of week must be 1-7, got: {d}");
        }
    }
}
