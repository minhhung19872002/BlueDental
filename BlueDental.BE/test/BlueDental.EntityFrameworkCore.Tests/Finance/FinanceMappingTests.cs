using BlueDental.EntityFrameworkCore;
using BlueDental.Finance;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.Finance;

public class FinanceMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void SalesEntry_Should_Map_To_bd_sales_entries_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(SalesEntry))!
            .GetTableName().ShouldBe("bd_sales_entries");
    }

    [Fact]
    public void SalesEntry_Should_Have_A_Unique_Code()
    {
        using var ctx = CreateContext();
        var index = ctx.Model.FindEntityType(typeof(SalesEntry))!
            .GetIndexes()
            .FirstOrDefault(i => i.Properties.Count == 1 &&
                                 i.Properties[0].Name == nameof(SalesEntry.Code));

        index.ShouldNotBeNull();
        index!.IsUnique.ShouldBeTrue();
    }

    [Fact]
    public void SalesEntry_Should_Persist_Approval_Fields()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(SalesEntry))!;

        entity.FindProperty(nameof(SalesEntry.ApprovalStatus)).ShouldNotBeNull();
        entity.FindProperty(nameof(SalesEntry.ApprovedByStaffId)).ShouldNotBeNull();
        entity.FindProperty(nameof(SalesEntry.ApprovedAt)).ShouldNotBeNull();
        entity.FindProperty(nameof(SalesEntry.RejectionReason)).ShouldNotBeNull();
    }

    [Fact]
    public void SalesEntry_Should_Not_Persist_Derived_Values()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(SalesEntry))!;

        entity.FindProperty(nameof(SalesEntry.SignedAmount)).ShouldBeNull();
        entity.FindProperty(nameof(SalesEntry.CountsTowardsCashflow)).ShouldBeNull();
    }

    [Fact]
    public void CashflowEntry_Should_Map_To_bd_cashflow_entries_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(CashflowEntry))!
            .GetTableName().ShouldBe("bd_cashflow_entries");
    }

    [Fact]
    public void CashflowEntry_Should_Persist_Both_Holdings()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(CashflowEntry))!;

        entity.FindProperty(nameof(CashflowEntry.FromHolding)).ShouldNotBeNull();
        entity.FindProperty(nameof(CashflowEntry.ToHolding)).ShouldNotBeNull();
        entity.FindProperty(nameof(CashflowEntry.TransactionType)).ShouldNotBeNull();
    }

    [Fact]
    public void CashflowCategory_Should_Map_To_bd_cashflow_categories_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(CashflowCategory))!
            .GetTableName().ShouldBe("bd_cashflow_categories");
    }
}
