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
        FinishLineId = Guid.NewGuid(),
        Quantity = 2,
        SentAt = SentAt,
        DueAt = DueAt,
        TreatmentServiceId = Guid.NewGuid()
    };

    private static LaboOrder Draft(params int[] teeth) =>
        new(Guid.NewGuid(), "LABO-202610010291", Guid.NewGuid(), Guid.NewGuid(), Complete(teeth));

    private static LaboOrder Received(params int[] teeth) =>
        Draft(teeth).Submit().Receive(Guid.NewGuid(), ReceivedAt, 1, null);

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
        Draft(11).Submit().Status.ShouldBe(LaboStatus.Sent);
    }

    [Fact]
    public void Submit_Should_Refuse_A_Draft_Missing_A_Required_Field()
    {
        var order = new LaboOrder(Guid.NewGuid(), "LABO-1", Guid.NewGuid(), Guid.NewGuid(),
            Complete(11) with { MaterialId = null });

        ShouldFail(() => order.Submit(), BlueDentalDomainErrorCodes.Labo.OrderIncomplete);
    }

    [Fact]
    public void Submit_Should_Name_The_Tooth_Missing_Its_Finish_Line()
    {
        var finish = Guid.NewGuid();
        var order = new LaboOrder(Guid.NewGuid(), "LABO-1", Guid.NewGuid(), Guid.NewGuid(),
            Complete(11, 12, 13) with
            {
                ToothSpecs =
                [
                    new LaboToothSpec(11, "A1", finish, null, null, null),
                    new LaboToothSpec(12, "A1/A2", finish, null, null, null),
                    new LaboToothSpec(13, "A2", null, null, null, null)
                ]
            });

        var error = Should.Throw<BusinessException>(() => order.Submit());
        error.Code.ShouldBe(BlueDentalDomainErrorCodes.Labo.ToothSpecIncomplete);
        error.Data["tooth"].ShouldBe(13);
    }

    [Fact]
    public void Each_Tooth_Should_Keep_Its_Own_Spec_And_The_Order_Mirror_The_First()
    {
        var (a, b) = (Guid.NewGuid(), Guid.NewGuid());
        var order = new LaboOrder(Guid.NewGuid(), "LABO-1", Guid.NewGuid(), Guid.NewGuid(),
            Complete(21, 11) with
            {
                ToothSpecs =
                [
                    new LaboToothSpec(11, "B1", b, null, null, " cạnh cắn "),
                    new LaboToothSpec(21, "A1/A2", a, null, null, null)
                ]
            }).Submit();

        var tooth11 = order.Teeth.Single(t => t.ToothNumber == 11);
        tooth11.Shade.ShouldBe("B1");
        tooth11.FinishLineId.ShouldBe(b);
        tooth11.LabNote.ShouldBe("cạnh cắn");
        order.ToothShade.ShouldBe("A1/A2");
        order.FinishLineId.ShouldBe(a);
    }

    [Fact]
    public void A_Caller_Without_Tooth_Rows_Should_Give_Every_Tooth_The_Order_Values()
    {
        var order = Draft(11, 12);

        order.Teeth.ShouldAllBe(t => t.Shade == "A2" && t.FinishLineId == order.FinishLineId);
    }

    [Fact]
    public void Submit_Should_Go_Without_Pictures()
    {
        Draft(11).Submit().Status.ShouldBe(LaboStatus.Sent);
    }

    [Fact]
    public void A_Set_Of_Pictures_Should_Hold_At_Most_Five()
    {
        LaboOrder.EnsureImageCount(5);
        ShouldFail(() => LaboOrder.EnsureImageCount(6), BlueDentalDomainErrorCodes.Labo.ImageCountInvalid);
    }

    [Fact]
    public void Sent_And_Due_Should_Be_Kept_As_Clinic_Days()
    {
        var order = Draft(11);

        order.SentAt.ShouldBe(new DateTimeOffset(2026, 10, 1, 0, 0, 0, Clinic));
        order.DueAt.ShouldBe(new DateTimeOffset(2026, 10, 8, 0, 0, 0, Clinic));
    }

    [Fact]
    public void Draft_Should_Refuse_A_Due_Day_Equal_To_The_Sent_Day()
    {
        ShouldFail(
            () => new LaboOrder(Guid.NewGuid(), "LABO-1", Guid.NewGuid(), Guid.NewGuid(),
                Complete(11) with { DueAt = SentAt.AddHours(5) }),
            BlueDentalDomainErrorCodes.Labo.DueBeforeSent);
    }

    [Fact]
    public void Sent_Order_Should_No_Longer_Be_Editable()
    {
        var order = Draft(11).Submit();

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
        var order = Draft(11).Submit();

        ShouldFail(() => order.Receive(Guid.NewGuid(), ReceivedAt, 3, null),
            BlueDentalDomainErrorCodes.Labo.ReceivedQuantityInvalid);
    }

    [Fact]
    public void Receive_Should_Refuse_A_Day_Before_Sent()
    {
        var order = Draft(11).Submit();

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
        ShouldFail(() => Draft(11).Submit().ConfirmPassed([Pass(11)], CheckedAt),
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
    public void Return_Should_Need_Each_Defective_Tooth_Described_And_Both_Dates()
    {
        var undescribed = Should.Throw<BusinessException>(() => Received(11, 21).ReturnToLab(
            [Fail(11), new(21, LaboToothCheckResult.Failed, " ")], Return(all: false), CheckedAt));
        undescribed.Code.ShouldBe(BlueDentalDomainErrorCodes.Labo.DefectDescriptionRequired);
        undescribed.Data["tooth"].ShouldBe(21);
        ShouldFail(() => Received(11).ReturnToLab([Fail(11)], Return(all: false) with { RedeliveryDueAt = null }, CheckedAt),
            BlueDentalDomainErrorCodes.Labo.ReturnDetailsRequired);
    }

    [Fact]
    public void Return_Without_A_Description_Should_Keep_The_Teeth_Descriptions_Joined()
    {
        var order = Received(11, 21);
        order.ReturnToLab(
            [new(11, LaboToothCheckResult.Failed, "Lệch màu"), new(21, LaboToothCheckResult.Failed, "Hở bờ")],
            Return(all: true) with { Description = null }, CheckedAt);

        order.LatestRound!.ReturnDescription.ShouldBe("R11: Lệch màu; R21: Hở bờ");
        order.LatestRound.ToothResults.Select(r => r.Note).ShouldBe(["Lệch màu", "Hở bờ"]);
    }

    [Fact]
    public void Tooth_Return_Count_Should_Count_Only_The_Returns_It_Failed()
    {
        // R11 Đạt rides along on a Trả toàn bộ uncounted; R21 fails twice.
        var order = Received(11, 21);
        order.ReturnToLab([Pass(11), Fail(21)], Return(all: true), CheckedAt);
        order.Receive(Guid.NewGuid(), ReceivedAt.AddDays(7), 1, null);
        order.ReturnToLab([Pass(11), Fail(21)], Return(all: false) with
        {
            ReturnedAt = CheckedAt.AddDays(7),
            RedeliveryDueAt = CheckedAt.AddDays(10)
        }, CheckedAt.AddDays(7));

        order.ReturnCount.ShouldBe(2);
        order.ToothReturnCount(11).ShouldBe(0);
        order.ToothReturnCount(21).ShouldBe(2);
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
        ShouldFail(() => Draft(11).Submit().EnsureDeletable(), BlueDentalDomainErrorCodes.Labo.DeleteOnlyDraft);
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
        LaboStatus.Sent => Draft(11).Submit(),
        LaboStatus.AwaitingCheck => Received(11),
        LaboStatus.Returned => Received(11).ReturnToLab([Fail(11)], Return(all: false), CheckedAt),
        LaboStatus.Completed => Received(11).ConfirmPassed([Pass(11)], CheckedAt),
        LaboStatus.Warranty => Received(11).ConfirmPassed([Pass(11)], CheckedAt)
            .ActivateWarranty([new(11, new DateOnly(2026, 10, 8), 12)], CheckedAt, null),
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };
}
