using System;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Labo;

/// <summary>
/// The guards behind "Làm tiếp công đoạn" and "Bảo hành" on the patient's
/// Labo tab: a child order copies its parent and refuses what the reference
/// refuses.
/// </summary>
public class LaboOrderTests
{
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _materialId = Guid.NewGuid();
    private readonly Guid _serviceLineId = Guid.NewGuid();
    private readonly Guid _stageId = Guid.NewGuid();

    private LaboOrder Parent(Guid? materialId) => new(
        Guid.NewGuid(),
        "LABO-202609081",
        _patientId,
        _branchId,
        "Labo A",
        0m,
        dentistId: Guid.NewGuid(),
        workDescription: "Răng sứ",
        supplierId: Guid.NewGuid(),
        materialId: materialId,
        treatmentServiceId: _serviceLineId,
        treatmentStageId: _stageId);

    [Fact]
    public void Child_Should_Copy_Code_Line_Stage_And_Parent_Id()
    {
        var parent = Parent(_materialId);

        var child = LaboOrder.CreateChild(
            Guid.NewGuid(), parent, LaboOrderKind.Guarantee,
            _patientId, _branchId, "Labo B", materialId: null,
            toothNumbers: "11,12", quantity: 2);

        child.ParentOrderId.ShouldBe(parent.Id);
        child.OrderCode.ShouldBe(parent.OrderCode);
        child.Kind.ShouldBe(LaboOrderKind.Guarantee);
        child.TreatmentServiceId.ShouldBe(_serviceLineId);
        child.TreatmentStageId.ShouldBe(_stageId);
        child.MaterialId.ShouldBe(_materialId);
        child.SupplierId.ShouldBe(parent.SupplierId);
        child.DentistId.ShouldBe(parent.DentistId);
        child.LabProviderName.ShouldBe("Labo B");
        child.ToothNumbers.ShouldBe("11,12");
        child.Quantity.ShouldBe(2);
        child.Status.ShouldBe(LaboStatus.Draft);
    }

    [Fact]
    public void Child_Should_Take_The_New_Material_When_One_Is_Given()
    {
        var parent = Parent(_materialId);
        var newMaterial = Guid.NewGuid();

        var child = LaboOrder.CreateChild(
            Guid.NewGuid(), parent, LaboOrderKind.ContinueStage,
            _patientId, _branchId, "Labo A", materialId: newMaterial);

        child.MaterialId.ShouldBe(newMaterial);
        child.Kind.ShouldBe(LaboOrderKind.ContinueStage);
    }

    [Fact]
    public void Child_Should_Refuse_Kind_New()
    {
        var parent = Parent(_materialId);

        var ex = Should.Throw<BusinessException>(() => LaboOrder.CreateChild(
            Guid.NewGuid(), parent, LaboOrderKind.New,
            _patientId, _branchId, "Labo A", _materialId));

        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Labo.ParentRequired);
    }

    [Fact]
    public void Child_Should_Refuse_A_Parent_Of_Another_Patient()
    {
        var parent = Parent(_materialId);

        var ex = Should.Throw<BusinessException>(() => LaboOrder.CreateChild(
            Guid.NewGuid(), parent, LaboOrderKind.Guarantee,
            Guid.NewGuid(), _branchId, "Labo A", _materialId));

        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Labo.ParentMismatch);
    }

    [Fact]
    public void Child_Should_Refuse_A_Parent_Of_Another_Branch()
    {
        var parent = Parent(_materialId);

        var ex = Should.Throw<BusinessException>(() => LaboOrder.CreateChild(
            Guid.NewGuid(), parent, LaboOrderKind.Guarantee,
            _patientId, Guid.NewGuid(), "Labo A", _materialId));

        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Labo.ParentMismatch);
    }

    [Fact]
    public void Child_Should_Require_A_Material_When_The_Parent_Has_None()
    {
        var parent = Parent(materialId: null);

        var ex = Should.Throw<BusinessException>(() => LaboOrder.CreateChild(
            Guid.NewGuid(), parent, LaboOrderKind.Guarantee,
            _patientId, _branchId, "Labo A", materialId: null));

        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Labo.MaterialRequired);
    }

    [Fact]
    public void New_Order_Should_Have_No_Parent()
    {
        Parent(_materialId).ParentOrderId.ShouldBeNull();
    }
}
