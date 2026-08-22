using BlueDental.EntityFrameworkCore;
using BlueDental.PatientManagement;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.PatientManagement;

public class PatientMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void Patient_Should_Map_To_Patients_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(Patient))!
            .GetTableName().ShouldBe("bd_patients");
    }

    [Fact]
    public void Patient_Should_Have_BranchId_Property()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(Patient))!;
        entity.FindProperty(nameof(Patient.BranchId)).ShouldNotBeNull();
    }

    [Fact]
    public void Patient_Should_Have_PatientCode_Property()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(Patient))!;
        entity.FindProperty(nameof(Patient.PatientCode)).ShouldNotBeNull();
    }

    [Fact]
    public void Patient_Should_Have_Unique_Index_On_PatientCode()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(Patient))!;
        entity.GetIndexes().ShouldContain(ix =>
            ix.IsUnique && ix.Properties.Any(p => p.Name == nameof(Patient.PatientCode)));
    }

    [Fact]
    public void Patient_Should_Have_Status_Property()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(Patient))!;
        entity.FindProperty(nameof(Patient.Status)).ShouldNotBeNull();
    }
}
