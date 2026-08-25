using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Catalogs;

/// <summary>
/// The fields only the "Loại thuốc" catalog carries. The entry's own
/// <c>Price</c> is the selling price the rest of the system quotes from;
/// the buying price lives here because nothing outside this catalog needs it.
/// </summary>
public class CatalogMedicine : Entity<Guid>
{
    public Guid CatalogEntryId { get; private set; }

    /// <summary>Hoạt chất.</summary>
    public string? ActiveIngredient { get; private set; }

    /// <summary>Cách dùng.</summary>
    public string? Usage { get; private set; }

    /// <summary>Giá mua.</summary>
    public decimal PurchasePrice { get; private set; }

    /// <summary>Mã toa thuốc.</summary>
    public string? PrescriptionCode { get; private set; }

    /// <summary>Lưu ý sử dụng.</summary>
    public string? UsageNote { get; private set; }

    protected CatalogMedicine() { }

    public CatalogMedicine(Guid id, Guid catalogEntryId) : base(id)
    {
        CatalogEntryId = catalogEntryId;
    }

    public void Update(
        string? activeIngredient,
        string? usage,
        decimal purchasePrice,
        string? prescriptionCode,
        string? usageNote)
    {
        if (purchasePrice < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidCatalogPrice,
                "A purchase price cannot be negative.");
        }

        ActiveIngredient = activeIngredient;
        Usage = usage;
        PurchasePrice = purchasePrice;
        PrescriptionCode = prescriptionCode;
        UsageNote = usageNote;
    }
}
