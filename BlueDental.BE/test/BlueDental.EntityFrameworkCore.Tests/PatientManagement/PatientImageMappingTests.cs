using BlueDental.EntityFrameworkCore;
using BlueDental.PatientManagement;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.PatientManagement;

public class PatientImageMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void PatientImage_Should_Map_To_Patient_Images_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(PatientImage))!
            .GetTableName().ShouldBe("bd_patient_images");
    }

    [Fact]
    public void PatientImage_Should_Store_Type_As_Short()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(PatientImage))!;
        var type = entity.FindProperty(nameof(PatientImage.Type)).ShouldNotBeNull();
        type.GetProviderClrType().ShouldBe(typeof(short));
    }

    [Fact]
    public void PatientImage_Should_Index_Patient_And_Ordering()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(PatientImage))!;
        entity.FindProperty(nameof(PatientImage.Ordering)).ShouldNotBeNull();
        entity.GetIndexes().ShouldContain(ix =>
            ix.Properties.Count == 2
            && ix.Properties[0].Name == nameof(PatientImage.PatientId)
            && ix.Properties[1].Name == nameof(PatientImage.Ordering));
    }
}
