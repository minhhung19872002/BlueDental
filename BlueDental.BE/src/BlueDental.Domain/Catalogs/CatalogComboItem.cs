using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Catalogs;

/// <summary>
/// One row of "Thành phần combo" — a single service of the same branch, how
/// many of it the combo holds, and what one of them costs inside the combo.
/// BA request 2026-10-06, not observed on the reference.
/// </summary>
public class CatalogComboItem : Entity<Guid>
{
    /// <summary>The combo this row belongs to.</summary>
    public Guid CatalogEntryId { get; private set; }

    /// <summary>The single service, itself an entry of the dịch vụ catalog.</summary>
    public Guid ComponentEntryId { get; private set; }

    /// <summary>Số lượng.</summary>
    public int Quantity { get; private set; }

    /// <summary>
    /// "Thành tiền" — the price of <b>one</b> unit inside the combo (the combo
    /// price is Σ unit amount × quantity). It starts as the service's own price
    /// and the user may overwrite it; it lives here, so editing it never touches
    /// the service in master data, and a later change of that price does not
    /// reach into the combo.
    /// </summary>
    public decimal UnitAmount { get; private set; }

    public int SortOrder { get; private set; }

    protected CatalogComboItem() { }

    internal CatalogComboItem(
        Guid id, Guid catalogEntryId, Guid componentEntryId, int quantity, decimal unitAmount, int sortOrder) : base(id)
    {
        if (quantity < 1)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidComboLine,
                "A combo row holds at least one of its service.");
        }

        if (unitAmount < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidComboLine,
                "A combo row cannot be worth less than nothing.");
        }

        CatalogEntryId = catalogEntryId;
        ComponentEntryId = componentEntryId;
        Quantity = quantity;
        UnitAmount = unitAmount;
        SortOrder = sortOrder;
    }

    /// <summary>Quantity × unit amount — this row's share of the combo price.</summary>
    public decimal LineTotal => Quantity * UnitAmount;
}

/// <summary>What the dialog sends for one combo row, with the service already loaded.</summary>
public sealed record ComboComponent(CatalogEntry Service, int Quantity, decimal UnitAmount);
