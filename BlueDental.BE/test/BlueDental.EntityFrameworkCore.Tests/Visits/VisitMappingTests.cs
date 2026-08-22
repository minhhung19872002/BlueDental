using BlueDental.EntityFrameworkCore;
using BlueDental.Visits;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.Visits;

public class VisitMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void Visit_Should_Map_To_bd_visits_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(Visit))!
            .GetTableName().ShouldBe("bd_visits");
    }

    [Fact]
    public void Visit_Should_Have_PatientId_And_BranchId()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(Visit))!;
        entity.FindProperty(nameof(Visit.PatientId)).ShouldNotBeNull();
        entity.FindProperty(nameof(Visit.BranchId)).ShouldNotBeNull();
    }

    [Fact]
    public void Visit_Should_Have_Status_Property()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(Visit))!
            .FindProperty(nameof(Visit.Status)).ShouldNotBeNull();
    }

    [Fact]
    public void Visit_Should_Have_ScheduledAt_Property()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(Visit))!
            .FindProperty(nameof(Visit.ScheduledAt)).ShouldNotBeNull();
    }
}
