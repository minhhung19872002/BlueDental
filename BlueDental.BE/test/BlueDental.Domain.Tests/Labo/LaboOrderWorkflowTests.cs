using System;
using System.Linq;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Labo;

/// <summary>
/// The P2910_03 state machine of a Labo order: Nháp → Đã gửi Labo → Chờ kiểm
/// tra → Trả hàng / Hoàn thành → Bảo hành, with Đã hủy off the first three.
/// </summary>
public class LaboOrderWorkflowTests
{
    private static readonly TimeSpan Clinic = TimeSpan.FromHours(7);
    private static readonly DateTimeOffset SentAt = new(2026, 10, 1, 9, 0, 0, Clinic);
    private static readonly DateTimeOffset DueAt = new(2026, 10, 8, 9, 0, 0, Clinic);
    private static readonly DateTimeOffset ReceivedAt = new(2026, 10, 8, 10, 0, 0, Clinic);
    private static readonly DateTimeOffset CheckedAt = new(2026, 10, 8, 11, 0, 0, Clinic);

    private static LaboOrderDetails Complete(params int[] teeth) => new()
    {
        DentistId = Guid.NewGuid(),
        LabProviderName = "Labo A",
        SupplierId = Guid.NewGuid(),
        MaterialId = Guid.NewGuid(),
        Teeth = teeth,
        ToothShade = "A2",
        Quantity = 2,
        SentAt = SentAt,
        DueAt = DueAt,
        TreatmentServiceId = Guid.NewGuid()
    };

    private static LaboOrder Draft(params int[] teeth) =>
        new(Guid.NewGuid(), "LABO-202610010291", Guid.NewGuid(), Guid.NewGuid(), Complete(teeth));

    private static LaboOrder Received(params int[] teeth) =>
        Draft(teeth).Submit(1).Receive(Guid.NewGuid(), ReceivedAt, 1, null);

    private static LaboRoundToothResult Pass(int tooth) => new(tooth, LaboToothCheckResult.Passed);

    private static LaboRoundToothResult Fail(int tooth) => new(tooth, LaboToothCheckResult.Failed, "Hở bờ");

    private static LaboReturnRequest Return(bool all) => new(
        all, "Làm lại sứ", CheckedAt, new DateTimeOffset(2026, 10, 15, 9, 0, 0, Clinic), 1);

    private static void ShouldFail(Action action, string code) =>
        Should.Throw<BusinessException>(action).Code.ShouldBe(code);

    [Fact]
    public void New_Order_Should_Be_A_Draft_Even_When_Empty()
    {
        var order = new LaboOrder(Guid.NewGuid(), "LABO-1", Guid.NewGuid(), Guid.NewGuid(), new LaboOrderDetails());

        order.Status.ShouldBe(LaboStatus.Draft);
        order.Kind.ShouldBe(LaboOrderKind.New);
        order.Teeth.ShouldBeEmpty();
        order.ToothNumbers.ShouldBeNull();
    }

    [Fact]
    public void Draft_Teeth_Should_Follow_The_Picked_List()
    {
        var order = Draft(11, 21);

        order.UpdateDraft(Complete(21, 22));

        order.Teeth.Select(t => t.ToothNumber).OrderBy(n => n).ShouldBe([21, 22]);
        order.ToothNumbers.ShouldBe("21, 22");
    }

    [Theory]
    [InlineData(19)]
    [InlineData(56)]
    [InlineData(91)]
    public void Draft_Should_Refuse_A_Tooth_Outside_FDI(int tooth)
    {
        ShouldFail(() => Draft(tooth), BlueDentalDomainErrorCodes.TreatmentManagement.InvalidToothCode);
    }

    [Fact]
    public void Draft_Should_Refuse_A_Due_Stamp_Not_After_Sent()
    {
        ShouldFail(
            () => new LaboOrder(Guid.NewGuid(), "LABO-1", Guid.NewGuid(), Guid.NewGuid(),
                Complete(11) with { DueAt = SentAt }),
            BlueDentalDomainErrorCodes.Labo.DueBeforeSent);
    }

    [Fact]
    public void Submit_Should_Move_A_Complete_Draft_To_Sent()
    {
        Draft(11).Submit(1).Status.ShouldBe(LaboStatus.Sent);
    }

    [Fact]
    public void Submit_Should_Refuse_A_Draft_Missing_A_Required_Field()
    {
        var order = new LaboOrder(Guid.NewGuid(), "LABO-1", Guid.NewGuid(), Guid.NewGuid(),
            Complete(11) with { ToothShade = " " });

        ShouldFail(() => order.Submit(1), BlueDentalDomainErrorCodes.Labo.OrderIncomplete);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public void Submit_Should_Need_One_To_Five_Pictures(int images)
    {
        ShouldFail(() => Draft(11).Submit(images), BlueDentalDomainErrorCodes.Labo.ImageCountInvalid);
    }

    [Fact]
    public void Sent_Order_Should_No_Longer_Be_Editable()
    {
        var order = Draft(11).Submit(1);

        ShouldFail(() => order.UpdateDraft(Complete(11)), BlueDentalDomainErrorCodes.Labo.InvalidTransition);
    }

    [Fact]
    public void Receive_Should_Open_Round_One_And_Await_The_Check()
    {
        var order = Received(11, 21);

        order.Status.ShouldBe(LaboStatus.AwaitingCheck);
        order.ReceivedAt.ShouldBe(ReceivedAt);
        order.LatestRound!.RoundNo.ShouldBe(1);
        order.LatestRound.Outcome.ShouldBe(LaboRoundOutcome.Pending);
    }

    [Fact]
    public void Receive_Again_Before_The_Check_Should_Amend_The_Open_Round()
    {
        var order = Received(11);
        var later = ReceivedAt.AddHours(2);

        order.Receive(Guid.NewGuid(), later, 2, null);

        order.Rounds.Count.ShouldBe(1);
        order.LatestRound!.ReceivedAt.ShouldBe(later);
        order.LatestRound.ReceivedQuantity.ShouldBe(2);
    }

    [Fact]
    public void Receive_Should_Refuse_A_Quantity_Above_The_Order()
    {
        var order = Draft(11).Submit(1);

        ShouldFail(() => order.Receive(Guid.NewGuid(), ReceivedAt, 3, null),
            BlueDentalDomainErrorCodes.Labo.ReceivedQuantityInvalid);
    }

    [Fact]
    public void Receive_Should_Refuse_A_Day_Before_Sent()
    {
        var order = Draft(11).Submit(1);

        ShouldFail(() => order.Receive(Guid.NewGuid(), SentAt.AddDays(-1), 1, null),
            BlueDentalDomainErrorCodes.Labo.ReceivedBeforeSent);
    }

    [Fact]
    public void Receive_Should_Refuse_A_Draft()
    {
        ShouldFail(() => Draft(11).Receive(Guid.NewGuid(), ReceivedAt, 1, null),
            BlueDentalDomainErrorCodes.Labo.InvalidTransition);
    }

    [Fact]
    public void All_Teeth_Passed_Should_Complete_The_Order()
    {
        var order = Received(11, 21);

        order.ConfirmPassed([Pass(11), Pass(21)], CheckedAt);

        order.Status.ShouldBe(LaboStatus.Completed);
        order.Teeth.ShouldAllBe(t => t.CheckResult == LaboToothCheckResult.Passed && t.PassedAt == CheckedAt);
        order.LatestRound!.Outcome.ShouldBe(LaboRoundOutcome.Passed);
        order.IsUnfinished.ShouldBeFalse();
    }

    [Fact]
    public void Confirm_Should_Refuse_A_Failed_Tooth()
    {
        ShouldFail(() => Received(11, 21).ConfirmPassed([Pass(11), Fail(21)], CheckedAt),
            BlueDentalDomainErrorCodes.Labo.NotAllPassed);
    }

    [Fact]
    public void Check_Should_Need_A_Result_For_Every_Tooth()
    {
        ShouldFail(() => Received(11, 21).ConfirmPassed([Pass(11)], CheckedAt),
            BlueDentalDomainErrorCodes.Labo.ToothResultsIncomplete);
    }

    [Fact]
    public void Check_Should_Refuse_A_Tooth_Not_On_The_Order()
    {
        ShouldFail(() => Received(11).ConfirmPassed([Pass(11), Pass(12)], CheckedAt),
            BlueDentalDomainErrorCodes.Labo.ToothNotOnOrder);
    }

    [Fact]
    public void Check_Should_Refuse_An_Order_Not_Awaiting_It()
    {
        ShouldFail(() => Draft(11).Submit(1).ConfirmPassed([Pass(11)], CheckedAt),
            BlueDentalDomainErrorCodes.Labo.InvalidTransition);
    }

    [Fact]
    public void Return_Defective_Should_Keep_Passed_Teeth_And_Move_The_Due_Stamp()
    {
        var order = Received(11, 21);
        var request = Return(all: false);

        order.ReturnToLab([Pass(11), Fail(21)], request, CheckedAt);

        order.Status.ShouldBe(LaboStatus.Returned);
        order.DueAt.ShouldBe(request.RedeliveryDueAt);
        order.ReturnCount.ShouldBe(1);
        order.LatestRound!.Outcome.ShouldBe(LaboRoundOutcome.ReturnedDefective);
        order.Teeth.Single(t => t.ToothNumber == 11).CheckResult.ShouldBe(LaboToothCheckResult.Passed);
        order.Teeth.Single(t => t.ToothNumber == 21).CheckResult.ShouldBe(LaboToothCheckResult.Failed);
        order.Teeth.Single(t => t.ToothNumber == 21).DefectNote.ShouldBe("Hở bờ");
    }

    [Fact]
    public void Next_Round_After_Return_Defective_Should_Check_Only_The_Failed_Teeth()
    {
        var order = Received(11, 21);
        order.ReturnToLab([Pass(11), Fail(21)], Return(all: false), CheckedAt);

        order.Receive(Guid.NewGuid(), ReceivedAt.AddDays(7), 1, null);
        ShouldFail(() => order.ConfirmPassed([Pass(11), Pass(21)], CheckedAt.AddDays(7)),
            BlueDentalDomainErrorCodes.Labo.ToothNotOnOrder);
        order.ConfirmPassed([Pass(21)], CheckedAt.AddDays(7));

        order.Status.ShouldBe(LaboStatus.Completed);
        order.LatestRound!.RoundNo.ShouldBe(2);
        order.Teeth.Single(t => t.ToothNumber == 11).PassedAt.ShouldBe(CheckedAt);
    }

    [Fact]
    public void Return_All_Should_Send_Every_Tooth_Back_For_The_Next_Check()
    {
        var order = Received(11, 21);
        order.ReturnToLab([Pass(11), Fail(21)], Return(all: true), CheckedAt);

        order.LatestRound!.Outcome.ShouldBe(LaboRoundOutcome.ReturnedAll);
        order.Teeth.ShouldAllBe(t => t.CheckResult != LaboToothCheckResult.Passed);

        order.Receive(Guid.NewGuid(), ReceivedAt.AddDays(7), 1, null);
        ShouldFail(() => order.ConfirmPassed([Pass(21)], CheckedAt.AddDays(7)),
            BlueDentalDomainErrorCodes.Labo.ToothResultsIncomplete);
    }

    [Fact]
    public void Return_Should_Need_A_Defect()
    {
        ShouldFail(() => Received(11).ReturnToLab([Pass(11)], Return(all: true), CheckedAt),
            BlueDentalDomainErrorCodes.Labo.ReturnNeedsDefect);
    }

    [Fact]
    public void Return_Should_Need_A_Description_And_Both_Dates()
    {
        ShouldFail(() => Received(11).ReturnToLab([Fail(11)], Return(all: false) with { Description = " " }, CheckedAt),
            BlueDentalDomainErrorCodes.Labo.ReturnDetailsRequired);
        ShouldFail(() => Received(11).ReturnToLab([Fail(11)], Return(all: false) with { RedeliveryDueAt = null }, CheckedAt),
            BlueDentalDomainErrorCodes.Labo.ReturnDetailsRequired);
    }

    [Fact]
    public void Return_Should_Need_Redelivery_After_The_Return()
    {
        ShouldFail(
            () => Received(11).ReturnToLab([Fail(11)], Return(all: false) with { RedeliveryDueAt = CheckedAt }, CheckedAt),
            BlueDentalDomainErrorCodes.Labo.RedeliveryBeforeReturn);
    }

    [Fact]
    public void Return_Should_Need_A_Check_Picture()
    {
        ShouldFail(
            () => Received(11).ReturnToLab([Fail(11)], Return(all: false) with { CheckImageCount = 0 }, CheckedAt),
            BlueDentalDomainErrorCodes.Labo.CheckImagesRequired);
    }

    [Fact]
    public void Warranty_Should_Wait_Until_The_Order_Is_Completed()
    {
        var order = Received(11, 21);
        order.ReturnToLab([Pass(11), Fail(21)], Return(all: false), CheckedAt);

        ShouldFail(() => order.ActivateWarranty([new(11, DateOnly.FromDateTime(CheckedAt.Date), 12)], CheckedAt, null),
            BlueDentalDomainErrorCodes.Labo.WarrantyNotAvailable);
    }

    [Fact]
    public void First_Activated_Tooth_Should_Move_The_Order_To_Warranty()
    {
        var order = Received(11, 21).ConfirmPassed([Pass(11), Pass(21)], CheckedAt);
        var activatedAt = new DateTimeOffset(2026, 11, 2, 9, 0, 0, Clinic);

        order.ActivateWarranty(
            [new(21, new DateOnly(2026, 11, 2), 24, " SN-1 ", " ")], activatedAt, null);

        order.Status.ShouldBe(LaboStatus.Warranty);
        var tooth = order.Teeth.Single(t => t.ToothNumber == 21);
        tooth.WarrantyCardCode.ShouldBe("BH-2611-0291-21");
        tooth.WarrantyEndDate.ShouldBe(new DateOnly(2028, 11, 2));
        tooth.ManufacturerSerial.ShouldBe("SN-1");
        tooth.WarrantyConditions.ShouldBeNull();
        order.Teeth.Single(t => t.ToothNumber == 11).IsWarrantyActivated.ShouldBeFalse();
    }

    [Fact]
    public void Warranty_Should_Refuse_A_Tooth_Already_Activated()
    {
        var order = Received(11).ConfirmPassed([Pass(11)], CheckedAt);
        order.ActivateWarranty([new(11, new DateOnly(2026, 10, 8), 12)], CheckedAt, null);

        ShouldFail(() => order.ActivateWarranty([new(11, new DateOnly(2026, 10, 8), 12)], CheckedAt, null),
            BlueDentalDomainErrorCodes.Labo.ToothNotWarrantable);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(601)]
    public void Warranty_Should_Refuse_Months_Out_Of_Range(int months)
    {
        var order = Received(11).ConfirmPassed([Pass(11)], CheckedAt);

        ShouldFail(() => order.ActivateWarranty([new(11, new DateOnly(2026, 10, 8), months)], CheckedAt, null),
            BlueDentalDomainErrorCodes.Labo.WarrantyMonthsInvalid);
    }

    [Fact]
    public void Warranty_Should_Refuse_A_Start_Before_The_Pass()
    {
        var order = Received(11).ConfirmPassed([Pass(11)], CheckedAt);

        ShouldFail(() => order.ActivateWarranty([new(11, new DateOnly(2026, 10, 7), 12)], CheckedAt, null),
            BlueDentalDomainErrorCodes.Labo.WarrantyStartBeforePass);
    }

    [Fact]
    public void Warranty_Should_Expire_The_Day_After_Every_Card_Ends()
    {
        var order = Received(11, 21).ConfirmPassed([Pass(11), Pass(21)], CheckedAt);
        order.ActivateWarranty(
            [new(11, new DateOnly(2026, 10, 8), 1), new(21, new DateOnly(2026, 10, 8), 2)], CheckedAt, null);
        var expired = LaboOrder.WarrantyExpiredOn(new DateOnly(2026, 12, 9)).Compile();

        order.IsWarrantyExpiredOn(new DateOnly(2026, 12, 8)).ShouldBeFalse();
        order.IsWarrantyExpiredOn(new DateOnly(2026, 12, 9)).ShouldBeTrue();
        expired(order).ShouldBeTrue();
    }

    [Theory]
    [InlineData(LaboStatus.Draft)]
    [InlineData(LaboStatus.Sent)]
    [InlineData(LaboStatus.AwaitingCheck)]
    public void Cancel_Should_Be_Allowed_Before_Goods_Are_Checked(LaboStatus status)
    {
        var order = InStatus(status);

        order.Cancel().Status.ShouldBe(LaboStatus.Cancelled);
        order.IsUnfinished.ShouldBeFalse();
    }

    [Theory]
    [InlineData(LaboStatus.Returned)]
    [InlineData(LaboStatus.Completed)]
    [InlineData(LaboStatus.Warranty)]
    public void Cancel_Should_Refuse_Later_Statuses(LaboStatus status)
    {
        ShouldFail(() => InStatus(status).Cancel(), BlueDentalDomainErrorCodes.Labo.InvalidTransition);
    }

    [Fact]
    public void Only_A_Draft_Should_Be_Deletable()
    {
        Should.NotThrow(() => Draft(11).EnsureDeletable());
        ShouldFail(() => Draft(11).Submit(1).EnsureDeletable(), BlueDentalDomainErrorCodes.Labo.DeleteOnlyDraft);
    }

    [Fact]
    public void Service_Change_Should_Cancel_Only_What_The_Lab_Still_Owes()
    {
        InStatus(LaboStatus.Returned).CancelForServiceChange().Status.ShouldBe(LaboStatus.Cancelled);
        InStatus(LaboStatus.Completed).CancelForServiceChange().Status.ShouldBe(LaboStatus.Completed);
    }

    private static LaboOrder InStatus(LaboStatus status) => status switch
    {
        LaboStatus.Draft => Draft(11),
        LaboStatus.Sent => Draft(11).Submit(1),
        LaboStatus.AwaitingCheck => Received(11),
        LaboStatus.Returned => Received(11).ReturnToLab([Fail(11)], Return(all: false), CheckedAt),
        LaboStatus.Completed => Received(11).ConfirmPassed([Pass(11)], CheckedAt),
        LaboStatus.Warranty => Received(11).ConfirmPassed([Pass(11)], CheckedAt)
            .ActivateWarranty([new(11, new DateOnly(2026, 10, 8), 12)], CheckedAt, null),
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };
}
