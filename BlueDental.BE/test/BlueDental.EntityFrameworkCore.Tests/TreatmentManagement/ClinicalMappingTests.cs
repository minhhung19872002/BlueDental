using BlueDental.EntityFrameworkCore;
using BlueDental.TreatmentManagement;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.TreatmentManagement;

public class ClinicalMappingTests
{
    private static BlueDentalDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BlueDentalDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new BlueDentalDbContext(options);
    }

    [Fact]
    public void PatientDiagnosis_Should_Map_To_bd_patient_diagnoses_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(PatientDiagnosis))!
            .GetTableName().ShouldBe("bd_patient_diagnoses");
    }

    [Fact]
    public void PatientDiagnosis_Should_Be_Branch_Scoped()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(PatientDiagnosis))!
            .FindProperty(nameof(PatientDiagnosis.ClinicBranchId)).ShouldNotBeNull();
    }

    [Fact]
    public void PatientDiagnosis_Should_Own_Teeth_Collection()
    {
        using var ctx = CreateContext();
        var navigation = ctx.Model.FindEntityType(typeof(PatientDiagnosis))!
            .FindNavigation(nameof(PatientDiagnosis.Teeth));

        navigation.ShouldNotBeNull();
        navigation!.TargetEntityType.IsOwned().ShouldBeTrue();
    }

    [Fact]
    public void PatientAdvise_Should_Map_To_bd_patient_advises_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(PatientAdvise))!
            .GetTableName().ShouldBe("bd_patient_advises");
    }

    [Fact]
    public void PatientAdvise_Should_Persist_Pricing_Fields()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(PatientAdvise))!;

        entity.FindProperty(nameof(PatientAdvise.Price)).ShouldNotBeNull();
        entity.FindProperty(nameof(PatientAdvise.OriginalPrice)).ShouldNotBeNull();
        entity.FindProperty(nameof(PatientAdvise.Quantity)).ShouldNotBeNull();
        entity.FindProperty(nameof(PatientAdvise.DiscountType)).ShouldNotBeNull();
        entity.FindProperty(nameof(PatientAdvise.DiscountValue)).ShouldNotBeNull();
        entity.FindProperty(nameof(PatientAdvise.VoucherDiscountAmount)).ShouldNotBeNull();
    }

    [Fact]
    public void PatientAdvise_Should_Not_Persist_Derived_Amounts()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(PatientAdvise))!;

        entity.FindProperty(nameof(PatientAdvise.GrossAmount)).ShouldBeNull();
        entity.FindProperty(nameof(PatientAdvise.DiscountAmount)).ShouldBeNull();
        entity.FindProperty(nameof(PatientAdvise.EffectiveAmount)).ShouldBeNull();
    }

    [Fact]
    public void PatientAdvise_Should_Link_Diagnosis_And_Treatment_Plan()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(PatientAdvise))!;

        entity.FindProperty(nameof(PatientAdvise.PatientDiagnosisId)).ShouldNotBeNull();
        entity.FindProperty(nameof(PatientAdvise.TreatmentPlanId)).ShouldNotBeNull();
        entity.FindProperty(nameof(PatientAdvise.AdviseGroupId)).ShouldNotBeNull();
    }

    [Fact]
    public void PatientAdvise_Should_Store_ImageIds_As_Primitive_Collection()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(PatientAdvise))!
            .FindProperty(nameof(PatientAdvise.ImageIds)).ShouldNotBeNull();
    }

    [Fact]
    public void TreatmentStage_Should_Persist_Its_Chain_And_Warranty_Root()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(TreatmentStage))!;

        entity.FindProperty(nameof(TreatmentStage.IsSuperseded)).ShouldNotBeNull();
        entity.FindProperty(nameof(TreatmentStage.ContinuedFromId)).ShouldNotBeNull();
        entity.FindProperty(nameof(TreatmentStage.WarrantyRootStageId)).ShouldNotBeNull();
    }

    [Fact]
    public void AdviseGroup_Should_Map_To_bd_advise_groups_Table()
    {
        using var ctx = CreateContext();
        ctx.Model.FindEntityType(typeof(AdviseGroup))!
            .GetTableName().ShouldBe("bd_advise_groups");
    }

    [Fact]
    public void TreatmentPlanVoucher_Should_Map_To_bd_treatment_plan_vouchers_Table()
    {
        using var ctx = CreateContext();
        var entity = ctx.Model.FindEntityType(typeof(TreatmentPlanVoucher))!;

        entity.GetTableName().ShouldBe("bd_treatment_plan_vouchers");
        entity.FindProperty(nameof(TreatmentPlanVoucher.VoucherId)).ShouldNotBeNull();
        entity.FindProperty(nameof(TreatmentPlanVoucher.DiscountAmount)).ShouldNotBeNull();
    }

    [Fact]
    public void TreatmentPlan_Should_Own_Its_AppliedVouchers_Through_The_Backing_Field()
    {
        using var ctx = CreateContext();
        var navigation = ctx.Model.FindEntityType(typeof(TreatmentPlan))!
            .FindNavigation(nameof(TreatmentPlan.AppliedVouchers));

        navigation.ShouldNotBeNull();
        navigation.GetPropertyAccessMode().ShouldBe(PropertyAccessMode.Field);
        navigation.ForeignKey.DeleteBehavior.ShouldBe(DeleteBehavior.Cascade);
    }
}
