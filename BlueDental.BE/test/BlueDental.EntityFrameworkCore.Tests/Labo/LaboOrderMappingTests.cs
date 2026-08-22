using BlueDental.EntityFrameworkCore;
using BlueDental.Labo;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.Labo;

public class LaboOrderMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void LaboOrder_Should_Map_To_bd_labo_orders_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(LaboOrder))!
            .GetTableName().ShouldBe("bd_labo_orders");
    }

    [Fact]
    public void LaboOrder_Should_Have_PatientId_And_BranchId()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(LaboOrder))!;
        entity.FindProperty(nameof(LaboOrder.PatientId)).ShouldNotBeNull();
        entity.FindProperty(nameof(LaboOrder.BranchId)).ShouldNotBeNull();
    }

    [Fact]
    public void LaboOrder_Should_Have_Status_Property()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(LaboOrder))!
            .FindProperty(nameof(LaboOrder.Status)).ShouldNotBeNull();
    }

    [Fact]
    public void LaboOrder_Should_Have_Unique_Index_On_OrderCode()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(LaboOrder))!;
        entity.GetIndexes().ShouldContain(ix =>
            ix.IsUnique && ix.Properties.Any(p => p.Name == nameof(LaboOrder.OrderCode)));
    }
}
