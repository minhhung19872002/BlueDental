using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.PrepaidCards;

/// <summary>
/// "Khởi tạo thẻ" — a kind of Thẻ trả trước the clinic sells (function list
/// cụm 3 mục 1). BlueDental-local; decisions in docs/clone/pages/prepaid-card.md.
///
/// It is the template a card is sold from: giá bán vs giá trị sử dụng, how many
/// times a card may be spent, the seller's hoa hồng, whether family members may
/// spend it, and which services / service groups it pays for. A card copies
/// these when it is sold, so editing a type never changes a card already sold.
/// </summary>
public class PrepaidCardType : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Giá bán — what the customer pays for the card (VNĐ).</summary>
    public decimal SalePrice { get; private set; }

    /// <summary>Giá trị sử dụng — what the card is loaded with when sold (VNĐ).</summary>
    public decimal UsageValue { get; private set; }

    /// <summary>Số lần sử dụng tối đa; null means no limit.</summary>
    public int? MaxUses { get; private set; }

    public PrepaidCardCommissionType CommissionType { get; private set; }

    /// <summary>% of the sale price, or VNĐ per card — see <see cref="CommissionType"/>.</summary>
    public decimal CommissionValue { get; private set; }

    /// <summary>"Áp dụng cho thành viên trong gia đình".</summary>
    public bool AllowFamily { get; private set; }

    private List<Guid> _serviceIds = [];

    /// <summary>Catalog services the card pays for.</summary>
    public IReadOnlyList<Guid> ServiceIds => _serviceIds;

    private List<Guid> _serviceGroupIds = [];

    /// <summary>
    /// Service groups the card pays for — every service of the group, including
    /// ones added to it later. With no service and no group the card pays for
    /// any service.
    /// </summary>
    public IReadOnlyList<Guid> ServiceGroupIds => _serviceGroupIds;

    /// <summary>"Thời hạn sử dụng" in months from the day a card is sold; null means it never expires.</summary>
    public int? ValidityMonths { get; private set; }

    /// <summary>"Đang bán" — a type taken off sale keeps its sold cards working.</summary>
    public bool IsOnSale { get; private set; }

    public string? Note { get; private set; }

    protected PrepaidCardType() { }

    public PrepaidCardType(
        Guid id,
        Guid clinicBranchId,
        string name,
        decimal salePrice,
        decimal usageValue,
        int? maxUses,
        PrepaidCardCommissionType commissionType,
        decimal commissionValue,
        bool allowFamily,
        IEnumerable<Guid>? serviceIds,
        IEnumerable<Guid>? serviceGroupIds,
        string? note = null,
        int? validityMonths = null) : base(id)
    {
        ClinicBranchId = clinicBranchId;
        IsOnSale = true;
        Update(name, salePrice, usageValue, maxUses, commissionType, commissionValue, allowFamily,
            serviceIds, serviceGroupIds, note, validityMonths);
    }

    public PrepaidCardType Update(
        string name,
        decimal salePrice,
        decimal usageValue,
        int? maxUses,
        PrepaidCardCommissionType commissionType,
        decimal commissionValue,
        bool allowFamily,
        IEnumerable<Guid>? serviceIds,
        IEnumerable<Guid>? serviceGroupIds,
        string? note,
        int? validityMonths = null)
    {
        if (usageValue <= 0m || salePrice < 0m)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.InvalidValue);
        }

        if (maxUses is < 1)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.InvalidMaxUses);
        }

        if (validityMonths is < 1 or > PrepaidCardConsts.MaxValidityMonths)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.InvalidValidity)
                .WithData("Max", PrepaidCardConsts.MaxValidityMonths);
        }

        var commissionValid = commissionType switch
        {
            PrepaidCardCommissionType.Percent => commissionValue is >= 0m and <= 100m,
            PrepaidCardCommissionType.Amount => commissionValue >= 0m && commissionValue <= salePrice,
            _ => false,
        };
        if (!commissionValid)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.InvalidCommission);
        }

        Name = Check.NotNullOrWhiteSpace(name, nameof(name), PrepaidCardConsts.MaxNameLength).Trim();
        SalePrice = salePrice;
        UsageValue = usageValue;
        MaxUses = maxUses;
        ValidityMonths = validityMonths;
        CommissionType = commissionType;
        CommissionValue = commissionValue;
        AllowFamily = allowFamily;
        _serviceIds = Distinct(serviceIds);
        _serviceGroupIds = Distinct(serviceGroupIds);
        Note = string.IsNullOrWhiteSpace(note)
            ? null
            : Check.Length(note.Trim(), nameof(note), PrepaidCardConsts.MaxNoteLength);
        return this;
    }

    public PrepaidCardType SetOnSale(bool onSale)
    {
        IsOnSale = onSale;
        return this;
    }

    /// <summary>The seller's hoa hồng on a card sold at <paramref name="soldFor"/>, rounded to the đồng.</summary>
    public decimal CommissionFor(decimal soldFor) =>
        CommissionType == PrepaidCardCommissionType.Percent
            ? Math.Round(soldFor * CommissionValue / 100m, 0, MidpointRounding.AwayFromZero)
            : CommissionValue;

    private static List<Guid> Distinct(IEnumerable<Guid>? ids) =>
        (ids ?? []).Where(id => id != Guid.Empty).Distinct().ToList();
}
