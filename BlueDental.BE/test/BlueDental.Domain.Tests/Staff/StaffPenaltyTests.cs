using System;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Staff;

/// <summary>
/// Chế tài nhân viên: Nháp → Đã duyệt / Đã huỷ, the lock on an approved record,
/// and the rule that only Phạt tiền carries an amount.
/// </summary>
public class StaffPenaltyTests
{
    private static readonly DateOnly Today = new(2026, 10, 6);
    private static readonly DateTime Now = new(2026, 10, 6, 9, 0, 0, DateTimeKind.Utc);
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _staffId = Guid.NewGuid();

    private StaffPenalty Draft(StaffPenaltyAction action = StaffPenaltyAction.Fine, decimal amount = 200_000m) =>
        StaffPenalty.Create(
            Guid.NewGuid(), _branchId, _staffId, violationTypeId: null,
            Today.AddDays(-1), action, amount, "  Đi trễ 30 phút  ", Today);

    [Fact]
    public void A_New_Record_Is_A_Draft_With_Its_Values()
    {
        var penalty = Draft();

        penalty.Status.ShouldBe(StaffPenaltyStatus.Draft);
        penalty.StaffId.ShouldBe(_staffId);
        penalty.FineAmount.ShouldBe(200_000m);
        penalty.Description.ShouldBe("Đi trễ 30 phút");
    }

    [Theory]
    [InlineData(StaffPenaltyAction.Reminder)]
    [InlineData(StaffPenaltyAction.Warning)]
    [InlineData(StaffPenaltyAction.Other)]
    public void Only_A_Fine_Keeps_An_Amount(StaffPenaltyAction action)
    {
        Draft(action, 150_000m).FineAmount.ShouldBe(0m);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void A_Fine_Without_A_Positive_Amount_Is_Refused(decimal amount)
    {
        Should.Throw<BusinessException>(() => Draft(StaffPenaltyAction.Fine, amount))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.StaffPenalty.FineAmountRequired);
    }

    [Fact]
    public void A_Violation_Dated_After_Today_Is_Refused()
    {
        Should.Throw<BusinessException>(() => StaffPenalty.Create(
                Guid.NewGuid(), _branchId, _staffId, null,
                Today.AddDays(1), StaffPenaltyAction.Warning, 0m, null, Today))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.StaffPenalty.ViolationDateInFuture);
    }

    [Fact]
    public void A_Draft_Can_Be_Edited_And_Deleted()
    {
        var penalty = Draft();

        penalty.Update(_staffId, null, Today, StaffPenaltyAction.Warning, 0m, null, Today);

        penalty.Action.ShouldBe(StaffPenaltyAction.Warning);
        penalty.Description.ShouldBeNull();
        Should.NotThrow(penalty.EnsureDeletable);
    }

    [Fact]
    public void Approving_Locks_The_Record()
    {
        var approver = Guid.NewGuid();
        var penalty = Draft().Approve(approver, Now);

        penalty.Status.ShouldBe(StaffPenaltyStatus.Approved);
        penalty.ApproverId.ShouldBe(approver);
        penalty.ApprovedAt.ShouldBe(Now);

        Should.Throw<BusinessException>(() =>
                penalty.Update(_staffId, null, Today, StaffPenaltyAction.Fine, 1m, null, Today))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.StaffPenalty.NotDraft);
        Should.Throw<BusinessException>(penalty.EnsureDeletable)
            .Code.ShouldBe(BlueDentalDomainErrorCodes.StaffPenalty.NotDraft);
        Should.Throw<BusinessException>(() => penalty.Approve(approver, Now))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.StaffPenalty.NotDraft);
    }

    [Fact]
    public void An_Approved_Record_Can_Still_Be_Cancelled_With_A_Reason()
    {
        var penalty = Draft().Approve(Guid.NewGuid(), Now);

        Should.Throw<ArgumentException>(() => penalty.Cancel("   ", Now));
        penalty.Status.ShouldBe(StaffPenaltyStatus.Approved);

        penalty.Cancel(" Nhầm người ", Now);

        penalty.Status.ShouldBe(StaffPenaltyStatus.Cancelled);
        penalty.CancelReason.ShouldBe("Nhầm người");
        penalty.CancelledAt.ShouldBe(Now);
    }

    [Fact]
    public void A_Cancelled_Record_Is_Final()
    {
        var penalty = Draft().Cancel("Trùng phiếu", Now);

        Should.Throw<BusinessException>(() => penalty.Cancel("Lần nữa", Now))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.StaffPenalty.AlreadyCancelled);
        Should.Throw<BusinessException>(() => penalty.Approve(Guid.NewGuid(), Now))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.StaffPenalty.NotDraft);
        Should.Throw<BusinessException>(penalty.EnsureDeletable);
    }

    [Fact]
    public void A_Violation_Type_Refuses_A_Negative_Default_Fine()
    {
        var type = StaffViolationType.Create(Guid.NewGuid(), _branchId, " Đi trễ ", 50_000m);
        type.Name.ShouldBe("Đi trễ");

        Should.Throw<BusinessException>(() => type.SetDetails("Đi trễ", -1m))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.StaffPenalty.InvalidAmount);
    }
}
