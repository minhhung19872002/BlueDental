using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Catalogs;

/// <summary>
/// One "Thành phần combo" row of a combo: a single service of the same
/// catalog, how many of it the combo holds, and what one of it costs inside
/// the combo. Specified in review P0510 ("Thêm dịch vụ" → Loại: Combo).
///
/// The unit price is the combo's own — "sửa tiền không được ảnh hưởng tới
/// master data" — so the component's catalogue price is never touched; the
/// list reads that price live as "Giá lẻ".
/// </summary>
public class CatalogComboItem : Entity<Guid>
{
    /// <summary>The combo this row belongs to.</summary>
    public Guid CatalogEntryId { get; private set; }

    /// <summary>The single service the row puts in the combo.</summary>
    public Guid ComponentEntryId { get; private set; }

    public int Quantity { get; private set; }

    /// <summary>"Thành tiền" of the row — the price of one unit inside the combo.</summary>
    public decimal UnitPrice { get; private set; }

    public int SortOrder { get; private set; }

    /// <summary>"Giá combo" of the row: one unit's combo price times the quantity.</summary>
    public decimal LineTotal => UnitPrice * Quantity;

    protected CatalogComboItem() { }

    public CatalogComboItem(
        Guid id,
        Guid catalogEntryId,
        Guid componentEntryId,
        int quantity,
        decimal unitPrice,
        int sortOrder)
        : base(id)
    {
        if (componentEntryId == Guid.Empty)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidComboItem,
                "A combo row has to name a service.");
        }

        if (quantity < 1)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidComboItem,
                "A combo row holds at least one unit.");
        }

        if (unitPrice < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidComboItem,
                "A combo row cannot be priced below zero.");
        }

        CatalogEntryId = catalogEntryId;
        ComponentEntryId = componentEntryId;
        Quantity = quantity;
        UnitPrice = unitPrice;
        SortOrder = sortOrder;
    }
}
