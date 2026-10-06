using System;
using System.Collections.Generic;
using System.Linq;
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

    /// <summary>The "BE:Field:BeforeTax" / "BE:Field:AfterTax" switch over the price that was typed.</summary>
    public bool PriceIncludesTax { get; private set; }

    /// <summary>The "%" / "BE:Common:VND" switch over the discount.</summary>
    public bool DiscountIsPercent { get; private set; }

    public decimal DiscountValue { get; private set; }

    // ── tab "BE:Perm:Settings" ────────────────────────────────────────────────────────
    public bool RequireImage { get; private set; }
    public bool DeductDoctorOnWarranty { get; private set; }
    public bool SeparateRevenue { get; private set; }
    public bool ShowToothOnInvoice { get; private set; }

    // ── tab "BE:Common:Stage" ──────────────────────────────────────────────────────
    public bool RevenueByStage { get; private set; }
    public bool RequireStageSequence { get; private set; }

    // ── tab "BE:Common:Warranty" ───────────────────────────────────────────────────────
    /// <summary>0 means "BE:Warranty:None"; otherwise the number of days.</summary>
    public int WarrantyDays { get; private set; }

    // ── tab "Labo" ──────────────────────────────────────────────────────────
    private List<Guid> _laboSupplierIds = [];

    /// <summary>
    /// The reference's <c>laboIds</c> — the labo suppliers a labo slip for this
    /// service may pick from. Empty means every supplier of the branch.
    /// </summary>
    public IReadOnlyCollection<Guid> LaboSupplierIds => _laboSupplierIds.AsReadOnly();

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

    /// <summary>Replaces the Labo tab's picks, in the order given and without repeats.</summary>
    public void ReplaceLaboSuppliers(IEnumerable<Guid> supplierIds)
    {
        _laboSupplierIds = supplierIds.Where(id => id != Guid.Empty).Distinct().ToList();
    }

    /// <summary>
    /// "BE:Field:PriceAfterDiscount" — the listed price with the discount taken
    /// off, quoted without VAT. Measured on the reference (staging, 2026-09-24):
    /// with "BE:Field:AfterTax" the typed price already carries VAT, so the box
    /// backs it out (net ÷ (1 + rate)); with "BE:Field:BeforeTax" it is the net
    /// itself. Two decimals, as the reference's API returns them; the dialog
    /// shows whole đồng.
    /// </summary>
    public decimal PriceAfterDiscount(decimal price)
    {
        var net = NetOfDiscount(price);

        return Round(PriceIncludesTax ? net / TaxFactor : net);
    }

    /// <summary>
    /// "BE:Field:AmountCollected" — what the customer pays, VAT included:
    /// the net with VAT added under "BE:Field:BeforeTax", the net itself under
    /// "BE:Field:AfterTax". Same measurement as <see cref="PriceAfterDiscount"/>.
    /// </summary>
    public decimal AmountCollected(decimal price)
    {
        var net = NetOfDiscount(price);

        return Round(PriceIncludesTax ? net : net * TaxFactor);
    }

    /// <summary>The price with the discount taken off, never below zero.</summary>
    private decimal NetOfDiscount(decimal price)
    {
        var discounted = DiscountIsPercent
            ? price * (1m - DiscountValue / 100m)
            : price - DiscountValue;

        return discounted < 0m ? 0m : discounted;
    }

    private decimal TaxFactor => 1m + TaxRate.Percent() / 100m;

    private static decimal Round(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
