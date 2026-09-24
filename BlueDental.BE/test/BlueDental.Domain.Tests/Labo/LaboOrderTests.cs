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

    private static readonly DateTimeOffset Sent = new(2026, 9, 24, 8, 0, 0, TimeSpan.Zero);

    private LaboOrder Stamped(DateTimeOffset? dueAt) => new(
        Guid.NewGuid(), "LABO-202609240", _patientId, _branchId, "Labo A", 0m,
        sentAt: Sent, dueAt: dueAt);

    [Fact]
    public void Due_Stamp_Keeps_Its_Hour()
    {
        var due = Sent.AddDays(3).AddHours(6).AddMinutes(30);

        Stamped(due).DueAt.ShouldBe(due);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-60)]
    public void Due_Stamp_Must_Follow_The_Sent_Stamp(int minutesAfterSent)
    {
        var ex = Should.Throw<BusinessException>(() => Stamped(Sent.AddMinutes(minutesAfterSent)));

        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Labo.DueBeforeSent);
    }

    [Fact]
    public void Update_Should_Refuse_A_Due_Stamp_Before_The_Sent_Stamp()
    {
        var order = Stamped(Sent.AddDays(1));

        var ex = Should.Throw<BusinessException>(() =>
            order.Update("Labo A", null, null, null, Sent.AddHours(-1), 0m));

        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Labo.DueBeforeSent);
    }

    [Theory]
    [InlineData(LaboStatus.Sent)]
    [InlineData(LaboStatus.InProgress)]
    [InlineData(LaboStatus.Completed)]
    public void Detail_Status_Should_Refuse_Workflow_Values(LaboStatus next)
    {
        var ex = Should.Throw<BusinessException>(() => Parent(_materialId).ChangeStatus(next));

        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Labo.InvalidTransition);
    }

    [Fact]
    public void Detail_Status_Should_Cancel_Only_A_New_Order()
    {
        var order = Parent(_materialId).ChangeStatus(LaboStatus.Received);
        order.ReceivedAt.ShouldNotBeNull();

        var ex = Should.Throw<BusinessException>(() => order.ChangeStatus(LaboStatus.Rejected));

        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Labo.CancelOnlyNew);
    }

    [Fact]
    public void Detail_Status_Should_Take_Any_Of_The_Dialog_Values_From_New()
    {
        Parent(_materialId).ChangeStatus(LaboStatus.LateDelivery).Status.ShouldBe(LaboStatus.LateDelivery);
        Parent(_materialId).ChangeStatus(LaboStatus.Replaced).Status.ShouldBe(LaboStatus.Replaced);
        Parent(_materialId).ChangeStatus(LaboStatus.Rejected).Status.ShouldBe(LaboStatus.Rejected);
    }

    /// <summary>
    /// The reference's statusClinic (2026-09-24): an order is "unfinished" — and
    /// blocks cancelling / converting its service line — until the labo has
    /// delivered it or the clinic has closed it.
    /// </summary>
    [Theory]
    [InlineData(LaboStatus.Draft, true)]
    [InlineData(LaboStatus.LateDelivery, true)]
    [InlineData(LaboStatus.Received, false)]
    [InlineData(LaboStatus.Rejected, false)]
    [InlineData(LaboStatus.Replaced, false)]
    public void Unfinished_Should_Follow_The_Detail_Status(LaboStatus status, bool unfinished)
    {
        var order = Parent(_materialId);
        if (status != LaboStatus.Draft)
            order.ChangeStatus(status);

        order.IsUnfinished.ShouldBe(unfinished);
    }

    [Fact]
    public void Unfinished_Should_Cover_A_Sent_Order()
    {
        var order = Parent(_materialId);
        order.Send();

        order.IsUnfinished.ShouldBeTrue();
    }

    /// <summary>
    /// "Hủy phiếu Labo" from the Chuyển đổi dialog closes both dimensions at
    /// once — even on an order already sent, which the detail dialog refuses.
    /// </summary>
    [Fact]
    public void Cancel_For_Service_Change_Should_Close_Both_Dimensions()
    {
        var order = Parent(_materialId);
        order.Send();

        order.CancelForServiceChange();

        order.Kind.ShouldBe(LaboOrderKind.Canceled);
        order.Status.ShouldBe(LaboStatus.Rejected);
        order.IsUnfinished.ShouldBeFalse();
    }
}
