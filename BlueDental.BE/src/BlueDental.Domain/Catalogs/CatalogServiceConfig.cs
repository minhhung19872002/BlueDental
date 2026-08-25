using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Catalogs;

/// <summary>
/// "Cấu hình giá &amp; thuế" and the three setting tabs of a service — the part
/// of <see cref="CatalogEntry"/> only the dịch vụ catalog carries.
///
/// A child of the entry, not an aggregate of its own: it has no life without
/// the service it configures.
/// </summary>
public class CatalogServiceConfig : Entity<Guid>
{
    public Guid CatalogEntryId { get; private set; }

    public ServiceTaxRate TaxRate { get; private set; }

    /// <summary>The "Trước thuế" / "Sau thuế" switch over the price that was typed.</summary>
    public bool PriceIncludesTax { get; private set; }

    /// <summary>The "%" / "VNĐ" switch over the discount.</summary>
    public bool DiscountIsPercent { get; private set; }

    public decimal DiscountValue { get; private set; }

    // ── tab "Cài đặt" ────────────────────────────────────────────────────────
    public bool RequireImage { get; private set; }
    public bool DeductDoctorOnWarranty { get; private set; }
    public bool SeparateRevenue { get; private set; }
    public bool ShowToothOnInvoice { get; private set; }

    // ── tab "Công đoạn" ──────────────────────────────────────────────────────
    public bool RevenueByStage { get; private set; }
    public bool RequireStageSequence { get; private set; }

    // ── tab "Bảo hành" ───────────────────────────────────────────────────────
    /// <summary>0 means "Không bảo hành"; otherwise the number of days.</summary>
    public int WarrantyDays { get; private set; }

    protected CatalogServiceConfig() { }

    public CatalogServiceConfig(Guid id, Guid catalogEntryId) : base(id)
    {
        CatalogEntryId = catalogEntryId;
    }

    public void Update(
        ServiceTaxRate taxRate,
        bool priceIncludesTax,
        bool discountIsPercent,
        decimal discountValue,
        bool requireImage,
        bool deductDoctorOnWarranty,
        bool separateRevenue,
        bool showToothOnInvoice,
        bool revenueByStage,
        bool requireStageSequence,
        int warrantyDays)
    {
        if (discountValue < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidServiceDiscount,
                "A discount cannot be negative.");
        }

        if (discountIsPercent && discountValue > 100m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidServiceDiscount,
                "A percentage discount cannot be more than 100.");
        }

        if (warrantyDays < 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidWarrantyPeriod,
                "A warranty cannot run for a negative number of days.");
        }

        TaxRate = taxRate;
        PriceIncludesTax = priceIncludesTax;
        DiscountIsPercent = discountIsPercent;
        DiscountValue = discountValue;
        RequireImage = requireImage;
        DeductDoctorOnWarranty = deductDoctorOnWarranty;
        SeparateRevenue = separateRevenue;
        ShowToothOnInvoice = showToothOnInvoice;
        RevenueByStage = revenueByStage;
        RequireStageSequence = requireStageSequence;
        WarrantyDays = warrantyDays;
    }

    /// <summary>
    /// "Giá sau giảm" — the listed price with the discount taken off.
    /// </summary>
    public decimal PriceAfterDiscount(decimal price)
    {
        var discounted = DiscountIsPercent
            ? price * (1m - DiscountValue / 100m)
            : price - DiscountValue;

        return discounted < 0m ? 0m : decimal.Round(discounted, 2);
    }

    /// <summary>
    /// "Thực thu từ khách (Đã gồm VAT)".
    ///
    /// UNKNOWN_REFERENCE_BEHAVIOR: the reference computes both of these boxes on
    /// the fly and the formula could only have been confirmed by typing into its
    /// form. This is BlueDental's reading — the price already carries VAT when
    /// "Sau thuế" is selected, and has it added when "Trước thuế" is.
    /// </summary>
    public decimal AmountCollected(decimal price)
    {
        var net = PriceAfterDiscount(price);

        return PriceIncludesTax
            ? net
            : decimal.Round(net * (1m + TaxRate.Percent() / 100m), 2);
    }
}
