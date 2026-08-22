using BlueDental.Appointments;
using BlueDental.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.Appointments;

public class AppointmentMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void Appointment_Should_Map_To_bd_appointments_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(Appointment))!
            .GetTableName().ShouldBe("bd_appointments");
    }

    [Fact]
    public void Appointment_Should_Have_BranchId_Property()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(Appointment))!
            .FindProperty(nameof(Appointment.BranchId)).ShouldNotBeNull();
    }

    [Fact]
    public void Appointment_Should_Have_PatientId_And_DentistId()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(Appointment))!;
        entity.FindProperty(nameof(Appointment.PatientId)).ShouldNotBeNull();
        entity.FindProperty(nameof(Appointment.DentistId)).ShouldNotBeNull();
    }

    [Fact]
    public void Appointment_Should_Have_Status_Property()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(Appointment))!
            .FindProperty(nameof(Appointment.Status)).ShouldNotBeNull();
    }

    [Fact]
    public void Appointment_Should_Have_Composite_Index_On_PatientId_Status()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(Appointment))!;
        entity.GetIndexes().ShouldContain(ix =>
            ix.Properties.Any(p => p.Name == nameof(Appointment.PatientId)) &&
            ix.Properties.Any(p => p.Name == nameof(Appointment.Status)));
    }
}
