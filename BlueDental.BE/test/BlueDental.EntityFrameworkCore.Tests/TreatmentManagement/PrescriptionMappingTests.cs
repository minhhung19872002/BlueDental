using BlueDental.EntityFrameworkCore;
using BlueDental.TreatmentManagement;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.TreatmentManagement;

public class PrescriptionMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void Prescription_Should_Map_To_bd_prescriptions_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(Prescription))!
            .GetTableName().ShouldBe("bd_prescriptions");
    }

    [Fact]
    public void Prescription_Should_Be_Branch_Scoped()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(Prescription))!
            .FindProperty(nameof(Prescription.ClinicBranchId)).ShouldNotBeNull();
    }

    [Fact]
    public void Prescription_Should_Store_TreatmentType_And_No_Status()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(Prescription))!;

        entity.FindProperty(nameof(Prescription.TreatmentType)).ShouldNotBeNull();
        entity.FindProperty("Status").ShouldBeNull();
        entity.FindProperty("PatientDiagnosisId").ShouldBeNull();
    }

    [Fact]
    public void Prescription_Should_Own_Items_Through_Backing_Field()
    {
        using var ctx = CreateContext();
        var navigation = ctx.Model.FindEntityType(typeof(Prescription))!
            .FindNavigation(nameof(Prescription.Items));

        navigation.ShouldNotBeNull();
        navigation.IsCollection.ShouldBeTrue();
        navigation.GetPropertyAccessMode().ShouldBe(PropertyAccessMode.Field);
        navigation.ForeignKey.DeleteBehavior.ShouldBe(DeleteBehavior.Cascade);
    }

    [Fact]
    public void PrescriptionItem_Should_Map_To_bd_prescription_items_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(PrescriptionItem))!
            .GetTableName().ShouldBe("bd_prescription_items");
    }

    [Fact]
    public void PrescriptionItem_Should_Store_Template_Style_Dosing()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(PrescriptionItem))!;

        entity.FindProperty(nameof(PrescriptionItem.TimesPerDay)).ShouldNotBeNull();
        entity.FindProperty(nameof(PrescriptionItem.AmountPerTime))!.GetColumnType().ShouldBe("numeric(18,2)");
        entity.FindProperty(nameof(PrescriptionItem.Days)).ShouldNotBeNull();
        entity.FindProperty(nameof(PrescriptionItem.Usage)).ShouldNotBeNull();
        entity.FindProperty(nameof(PrescriptionItem.OtherUsage))!.GetMaxLength().ShouldBe(200);
        entity.FindProperty(nameof(PrescriptionItem.SortOrder)).ShouldNotBeNull();
        entity.FindProperty(nameof(PrescriptionItem.MedicationName))!.GetMaxLength().ShouldBe(300);
    }

    [Fact]
    public void PrescriptionItem_Quantity_Should_Not_Be_Stored()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(PrescriptionItem))!
            .FindProperty(nameof(PrescriptionItem.Quantity)).ShouldBeNull();
    }

    [Fact]
    public void PrescriptionItem_Should_Drop_Free_Text_Dosing()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(PrescriptionItem))!;

        entity.FindProperty("Dosage").ShouldBeNull();
        entity.FindProperty("Frequency").ShouldBeNull();
        entity.FindProperty("Instructions").ShouldBeNull();
    }
}
