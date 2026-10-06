using System;

namespace BlueDental.Catalogs;

/// <summary>
/// One "Thành phần combo" row as the combo dialog sends it to
/// <see cref="CatalogEntry.ReplaceComboItems"/>.
/// </summary>
public readonly record struct CatalogComboRow(
    Guid ComponentEntryId,
    int Quantity,
    decimal UnitPrice);
