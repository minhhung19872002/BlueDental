using System;
using System.Linq;
using BlueDental.Catalogs;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Catalogs;

/// <summary>
/// A combo of the dịch vụ catalog (review P0510): several single services
/// sold at one price, and that price is always the sum of its rows'
/// "Thành tiền × số lượng" — never a figure typed beside them.
/// </summary>
public class CatalogComboTests
{
    private static Guid NewId() => Guid.NewGuid();

    private static CatalogEntry Combo() =>
        CatalogEntry.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "care_service",
            "Combo tẩy trắng toàn diện", isCombo: true);

    [Fact]
    public void Its_price_is_the_sum_of_its_rows()
    {
        var combo = Combo();
        var cleaning = Guid.NewGuid();
        var gel = Guid.NewGuid();

        combo.ReplaceComboItems(
            [new CatalogComboRow(cleaning, 1, 256_000m), new CatalogComboRow(gel, 2, 299_000m)],
            NewId);

        Assert.Equal(854_000m, combo.Price);
        Assert.Equal(new[] { cleaning, gel }, combo.ComboItems.OrderBy(x => x.SortOrder).Select(x => x.ComponentEntryId));
        Assert.All(combo.ComboItems, item => Assert.Equal(combo.Id, item.CatalogEntryId));
    }

    [Fact]
    public void Saving_the_table_again_replaces_the_rows_and_reprices()
    {
        var combo = Combo();
        combo.ReplaceComboItems([new CatalogComboRow(Guid.NewGuid(), 1, 100_000m)], NewId);

        var only = Guid.NewGuid();
        combo.ReplaceComboItems([new CatalogComboRow(only, 3, 50_000m)], NewId);

        Assert.Equal(only, Assert.Single(combo.ComboItems).ComponentEntryId);
        Assert.Equal(150_000m, combo.Price);
    }

    [Fact]
    public void A_typed_price_does_not_override_the_rows()
    {
        var combo = Combo();
        combo.ReplaceComboItems([new CatalogComboRow(Guid.NewGuid(), 1, 100_000m)], NewId);

        combo.ChangePrice(999_000m);

        Assert.Equal(100_000m, combo.Price);
    }

    [Fact]
    public void A_combo_needs_at_least_one_row()
    {
        var error = Assert.Throws<BusinessException>(() => Combo().ReplaceComboItems([], NewId));
        Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.ComboNeedsItems, error.Code);
    }

    [Fact]
    public void A_combo_cannot_hold_itself()
    {
        var combo = Combo();
        var error = Assert.Throws<BusinessException>(() =>
            combo.ReplaceComboItems([new CatalogComboRow(combo.Id, 1, 0m)], NewId));
        Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.ComboComponentNotAllowed, error.Code);
    }

    [Fact]
    public void A_service_appears_once_and_raises_its_quantity_instead()
    {
        var twice = Guid.NewGuid();
        var error = Assert.Throws<BusinessException>(() =>
            Combo().ReplaceComboItems([new CatalogComboRow(twice, 1, 0m), new CatalogComboRow(twice, 1, 0m)], NewId));
        Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.InvalidComboItem, error.Code);
    }

    [Theory]
    [InlineData(0, 100)]
    [InlineData(1, -1)]
    public void A_row_needs_a_unit_and_a_price_not_below_zero(int quantity, int unitPrice)
    {
        var error = Assert.Throws<BusinessException>(() =>
            Combo().ReplaceComboItems([new CatalogComboRow(Guid.NewGuid(), quantity, unitPrice)], NewId));
        Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.InvalidComboItem, error.Code);
    }

    [Fact]
    public void A_single_service_has_no_combo_rows()
    {
        var single = CatalogEntry.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "care_service", "Cạo vôi");

        var error = Assert.Throws<BusinessException>(() =>
            single.ReplaceComboItems([new CatalogComboRow(Guid.NewGuid(), 1, 0m)], NewId));
        Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.ComboNotSupported, error.Code);
    }

    [Fact]
    public void Only_the_service_catalog_has_combos()
    {
        var error = Assert.Throws<BusinessException>(() =>
            CatalogEntry.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "diagnosis", "Sâu răng", isCombo: true));
        Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.ComboNotSupported, error.Code);
    }
}
