using BlueDental.Catalogs;
using BlueDental.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.Catalogs;

public class CatalogComboMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void CatalogComboItem_Should_Map_To_bd_catalog_combo_items_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(CatalogComboItem))!
            .GetTableName().ShouldBe("bd_catalog_combo_items");
    }

    [Fact]
    public void CatalogEntry_Should_Own_Combo_Items_Through_Backing_Field()
    {
        using var ctx = CreateContext();
        var navigation = ctx.Model.FindEntityType(typeof(CatalogEntry))!
            .FindNavigation(nameof(CatalogEntry.ComboItems));

        navigation.ShouldNotBeNull();
        navigation.IsCollection.ShouldBeTrue();
        navigation.GetPropertyAccessMode().ShouldBe(PropertyAccessMode.Field);
        navigation.ForeignKey.DeleteBehavior.ShouldBe(DeleteBehavior.Cascade);
    }

    [Fact]
    public void CatalogComboItem_Should_Store_Price_And_Not_Its_Derived_Total()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(CatalogComboItem))!;

        entity.FindProperty(nameof(CatalogComboItem.UnitPrice))!.GetColumnType().ShouldBe("numeric(18,2)");
        entity.FindProperty(nameof(CatalogComboItem.LineTotal)).ShouldBeNull();
        entity.FindProperty(nameof(CatalogComboItem.ComponentEntryId)).ShouldNotBeNull();
    }

    [Fact]
    public void CatalogEntry_Should_Store_IsCombo()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(CatalogEntry))!
            .FindProperty(nameof(CatalogEntry.IsCombo)).ShouldNotBeNull();
    }
}
