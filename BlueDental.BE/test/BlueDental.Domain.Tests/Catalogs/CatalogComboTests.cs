using System;
using System.Linq;
using BlueDental.Catalogs;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Catalogs;

/// <summary>
/// "Loại: Combo" on a Danh mục service (BA request 2026-10-06): the combo's
/// price starts as the sum of its own rows and the user may type over it, it
/// never writes to the services it bundles, and its tax boxes follow the BA's
/// formulas.
/// </summary>
public class CatalogComboTests
{
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();

    private CatalogEntry Single(string name, decimal price, Guid? branchId = null)
    {
        var entry = CatalogEntry.Create(
            Guid.NewGuid(), branchId ?? _branchId, _groupId, TaxonomyGroups.CareService, name, price: price);
        entry.EnsureServiceConfig(Guid.NewGuid());
        return entry;
    }

    private CatalogEntry Combo(ServiceTaxRate taxRate = ServiceTaxRate.NotTaxable, bool priceIncludesTax = false)
    {
        var entry = CatalogEntry.Create(Guid.NewGuid(), _branchId, _groupId, TaxonomyGroups.CareService, "Combo");
        entry.EnsureServiceConfig(Guid.NewGuid(), ServiceKind.Combo)
            .Update(taxRate, priceIncludesTax, false, 50_000m, false, false, false, false, false, false, 0);
        return entry;
    }

    [Fact]
    public void Without_a_typed_price_the_combo_costs_unit_amount_times_quantity_and_the_services_keep_theirs()
    {
        var scaling = Single("Cạo vôi", 300_000m);
        var filling = Single("Trám răng", 500_000m);
        var combo = Combo();

        combo.ConfigureCombo(
            new[] { new ComboComponent(scaling, 2, 250_000m), new ComboComponent(filling, 1, 500_000m) },
            Guid.NewGuid, null);

        Assert.Equal(1_000_000m, combo.Price);
        Assert.Equal(new[] { 0, 1 }, combo.ComboItems.Select(item => item.SortOrder));
        Assert.Equal(300_000m, scaling.Price);
        Assert.Equal(500_000m, filling.Price);
    }

    [Fact]
    public void A_typed_combo_price_is_kept_even_when_it_differs_from_the_rows()
    {
        var scaling = Single("Cạo vôi", 300_000m);
        var combo = Combo();

        combo.ConfigureCombo(new[] { new ComboComponent(scaling, 2, 250_000m) }, Guid.NewGuid, 450_000m);
        Assert.Equal(450_000m, combo.Price);

        // Saving again without new rows keeps the rows and takes the new price.
        combo.PriceCombo(480_000m);
        Assert.Equal(480_000m, combo.Price);
        Assert.Equal(250_000m, Assert.Single(combo.ComboItems).UnitAmount);

        combo.PriceCombo(null);
        Assert.Equal(500_000m, combo.Price);
    }

    [Fact]
    public void A_combo_price_cannot_be_negative_and_only_a_combo_is_priced_this_way()
    {
        var scaling = Single("Cạo vôi", 300_000m);

        var negative = Assert.Throws<BusinessException>(() => Combo().ConfigureCombo(
            new[] { new ComboComponent(scaling, 1, 300_000m) }, Guid.NewGuid, -1m));
        Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.InvalidCatalogPrice, negative.Code);

        var single = Assert.Throws<BusinessException>(() => scaling.PriceCombo(100_000m));
        Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.InvalidComboComponent, single.Code);
        Assert.Equal(300_000m, scaling.Price);
    }

    [Fact]
    public void A_combo_is_saved_without_a_discount()
    {
        var combo = Combo();

        Assert.Equal(0m, combo.ServiceConfig!.DiscountValue);
        Assert.Equal(1_000_000m, combo.ServiceConfig.PriceAfterDiscount(1_000_000m));
    }

    [Theory]
    [InlineData(false, 80_000, 1_080_000)]
    [InlineData(true, 74_074.07, 925_925.93)]
    public void Tax_amount_and_amount_collected_follow_the_BA_formulas(
        bool priceIncludesTax, double taxAmount, double amountCollected)
    {
        var config = Combo(ServiceTaxRate.Eight, priceIncludesTax).ServiceConfig!;

        Assert.Equal((decimal)taxAmount, config.TaxAmount(1_000_000m));
        Assert.Equal((decimal)amountCollected, config.AmountCollected(1_000_000m));
    }

    [Theory]
    [InlineData(ServiceTaxRate.NotTaxable)]
    [InlineData(ServiceTaxRate.NotDeclared)]
    [InlineData(ServiceTaxRate.Zero)]
    public void No_rate_means_no_tax(ServiceTaxRate rate)
    {
        var config = Combo(rate, priceIncludesTax: true).ServiceConfig!;

        Assert.Equal(0m, config.TaxAmount(1_000_000m));
        Assert.Equal(1_000_000m, config.AmountCollected(1_000_000m));
    }

    [Fact]
    public void A_single_service_keeps_its_old_amount_collected()
    {
        var config = Single("Cạo vôi", 1_000_000m).ServiceConfig!;
        config.Update(ServiceTaxRate.Eight, true, true, 0m, false, false, false, false, false, false, 0);

        Assert.Equal(1_000_000m, config.AmountCollected(1_000_000m));
    }

    [Fact]
    public void The_kind_cannot_change()
    {
        var single = Single("Cạo vôi", 300_000m);

        var error = Assert.Throws<BusinessException>(() => single.EnsureServiceConfig(Guid.NewGuid(), ServiceKind.Combo));
        Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.ServiceKindCannotChange, error.Code);
    }

    [Fact]
    public void A_combo_needs_a_component()
    {
        var error = Assert.Throws<BusinessException>(
            () => Combo().ConfigureCombo(Array.Empty<ComboComponent>(), Guid.NewGuid, null));
        Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.ComboWithoutComponents, error.Code);
    }

    [Fact]
    public void Components_are_distinct_single_services_of_the_same_branch()
    {
        var scaling = Single("Cạo vôi", 300_000m);
        var combo = Combo();
        var otherCombo = Combo();
        var elsewhere = Single("Cạo vôi", 300_000m, Guid.NewGuid());

        foreach (var component in new[]
                 {
                     new[] { new ComboComponent(combo, 1, 0m) },
                     new[] { new ComboComponent(otherCombo, 1, 0m) },
                     new[] { new ComboComponent(elsewhere, 1, 0m) },
                     new[] { new ComboComponent(scaling, 1, 0m), new ComboComponent(scaling, 1, 0m) },
                 })
        {
            var error = Assert.Throws<BusinessException>(() => combo.ConfigureCombo(component, Guid.NewGuid, null));
            Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.InvalidComboComponent, error.Code);
        }
    }

    [Theory]
    [InlineData(0, 100)]
    [InlineData(1, -1)]
    public void A_row_needs_a_quantity_and_a_non_negative_amount(int quantity, double unitAmount)
    {
        var scaling = Single("Cạo vôi", 300_000m);

        var error = Assert.Throws<BusinessException>(() => Combo().ConfigureCombo(
            new[] { new ComboComponent(scaling, quantity, (decimal)unitAmount) }, Guid.NewGuid, null));
        Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.InvalidComboLine, error.Code);
    }

    [Fact]
    public void A_deleted_service_may_stay_but_cannot_be_added()
    {
        var scaling = Single("Cạo vôi", 300_000m);
        var filling = Single("Trám răng", 500_000m);
        var combo = Combo();
        combo.ConfigureCombo(new[] { new ComboComponent(scaling, 1, 300_000m) }, Guid.NewGuid, null);

        scaling.SetDeleted(true);
        filling.SetDeleted(true);

        combo.ConfigureCombo(new[] { new ComboComponent(scaling, 2, 300_000m) }, Guid.NewGuid, null);
        Assert.Equal(600_000m, combo.Price);

        var error = Assert.Throws<BusinessException>(() => combo.ConfigureCombo(
            new[] { new ComboComponent(scaling, 1, 300_000m), new ComboComponent(filling, 1, 500_000m) },
            Guid.NewGuid, null));
        Assert.Equal(BlueDentalDomainErrorCodes.Catalogs.ComboComponentDeleted, error.Code);
    }
}
