using BlueDental.EntityFrameworkCore;
using BlueDental.Timekeeping;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.Timekeeping;

public class TimeKeepingMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void TimeKeepingRecord_Should_Map_To_bd_time_keeping_records_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(TimeKeepingRecord))!
            .GetTableName().ShouldBe("bd_time_keeping_records");
    }

    [Fact]
    public void TimeKeepingRecord_Should_Be_Branch_And_Day_Scoped()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(TimeKeepingRecord))!;

        entity.FindProperty(nameof(TimeKeepingRecord.ClinicBranchId)).ShouldNotBeNull();
        entity.FindProperty(nameof(TimeKeepingRecord.WorkDate)).ShouldNotBeNull();
        entity.FindProperty(nameof(TimeKeepingRecord.StaffId)).ShouldNotBeNull();
    }

    [Fact]
    public void TimeKeepingRecord_Should_Enforce_One_Record_Per_Staff_Per_Day()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(TimeKeepingRecord))!;

        var unique = entity.GetIndexes()
            .FirstOrDefault(i => i.IsUnique &&
                i.Properties.Select(p => p.Name).OrderBy(n => n)
                    .SequenceEqual(new[] { "ClinicBranchId", "StaffId", "WorkDate" }.OrderBy(n => n)));

        unique.ShouldNotBeNull();
    }

    [Fact]
    public void TimeKeepingRecord_Should_Own_Both_Shifts()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(TimeKeepingRecord))!;

        var morning = entity.FindNavigation(nameof(TimeKeepingRecord.MorningShift));
        var afternoon = entity.FindNavigation(nameof(TimeKeepingRecord.AfternoonShift));

        morning.ShouldNotBeNull();
        afternoon.ShouldNotBeNull();
        morning!.TargetEntityType.IsOwned().ShouldBeTrue();
        afternoon!.TargetEntityType.IsOwned().ShouldBeTrue();
    }

    [Fact]
    public void TimeKeepingRecord_Should_Not_Persist_Derived_Values()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(TimeKeepingRecord))!;

        entity.FindProperty(nameof(TimeKeepingRecord.HasOpenShift)).ShouldBeNull();
        entity.FindProperty(nameof(TimeKeepingRecord.HasAnyAttendance)).ShouldBeNull();
        entity.FindProperty(nameof(TimeKeepingRecord.TotalWorkedMinutes)).ShouldBeNull();
    }
}
