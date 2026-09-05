using BlueDental.Appointments;
using BlueDental.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.Appointments;

public class AppointmentChangeLogMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void ChangeLog_Should_Map_To_bd_appointment_change_logs_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(AppointmentChangeLog))!
            .GetTableName().ShouldBe("bd_appointment_change_logs");
    }

    [Fact]
    public void ChangeLog_Should_Keep_Both_Snapshots_And_The_Diff_In_One_Column()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(AppointmentChangeLog))!;
        entity.FindProperty(nameof(AppointmentChangeLog.ChangesJson))!.IsNullable.ShouldBeFalse();
        entity.FindProperty(nameof(AppointmentChangeLog.ChangedFields))!.GetMaxLength().ShouldBe(500);
    }

    [Fact]
    public void ChangeLog_Enums_Should_Be_Stored_As_Short()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(AppointmentChangeLog))!;
        foreach (var name in new[]
                 {
                     nameof(AppointmentChangeLog.Action),
                     nameof(AppointmentChangeLog.Source),
                     nameof(AppointmentChangeLog.StatusBefore),
                     nameof(AppointmentChangeLog.StatusAfter),
                 })
        {
            entity.FindProperty(name)!.GetProviderClrType().ShouldBe(typeof(short), name);
        }
    }

    [Fact]
    public void ChangeLog_Should_Be_Indexed_For_The_Patient_History_Read()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(AppointmentChangeLog))!;
        entity.GetIndexes().ShouldContain(ix =>
            ix.Properties.Any(p => p.Name == nameof(AppointmentChangeLog.PatientId)) &&
            ix.Properties.Any(p => p.Name == nameof(AppointmentChangeLog.OccurredAt)));
        entity.GetIndexes().ShouldContain(ix =>
            ix.Properties.Any(p => p.Name == nameof(AppointmentChangeLog.BranchId)) &&
            ix.Properties.Any(p => p.Name == nameof(AppointmentChangeLog.OccurredAt)));
        entity.GetIndexes().ShouldContain(ix =>
            ix.Properties.Count == 1 && ix.Properties[0].Name == nameof(AppointmentChangeLog.AppointmentId));
    }

    [Fact]
    public void ChangeLog_Is_Not_Audited_But_Dates_Itself()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(AppointmentChangeLog))!;
        entity.FindProperty(nameof(AppointmentChangeLog.OccurredAt)).ShouldNotBeNull();
        entity.FindProperty("CreationTime").ShouldBeNull();
        entity.FindProperty("IsDeleted").ShouldBeNull();
    }
}
