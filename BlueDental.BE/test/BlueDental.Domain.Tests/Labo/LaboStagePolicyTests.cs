using System;
using BlueDental.TreatmentManagement;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Labo;

/// <summary>
/// What a line's labo orders do to its công đoạn (P2910_03, owner decision 9):
/// the Hoàn thành lock, the chip and the Kích hoạt bảo hành offer.
/// </summary>
public class LaboStagePolicyTests
{
    private static readonly TimeSpan Clinic = TimeSpan.FromHours(7);
    private static readonly DateTimeOffset SentAt = new(2026, 10, 1, 9, 0, 0, Clinic);
    private static readonly DateTimeOffset CheckedAt = new(2026, 10, 8, 11, 0, 0, Clinic);

    private readonly LaboStagePolicy _policy = new();
    private readonly Guid _line = Guid.NewGuid();

    private TreatmentStage Stage(int sequence, int day, int hour = 9)
    {
        var stage = TreatmentStage.Add(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), _line, Guid.NewGuid(),
            sequence, "Bọc sứ", Guid.NewGuid(), treatmentDate: new DateOnly(2026, 10, day));
        // Auditing fills CreationTime on save; the tests say which công đoạn was written first.
        ObjectHelper.TrySetProperty(stage, x => x.CreationTime, () => new DateTime(2026, 10, day, hour, 0, 0, DateTimeKind.Utc));
        return stage;
    }

    private LaboOrder Order(TreatmentStage? raisedOn, params int[] teeth) =>
        new(Guid.NewGuid(), "LABO-202610010291", Guid.NewGuid(), Guid.NewGuid(), new LaboOrderDetails
        {
            DentistId = Guid.NewGuid(),
            LabProviderName = "Labo A",
            SupplierId = Guid.NewGuid(),
            MaterialId = Guid.NewGuid(),
            Teeth = teeth.Length == 0 ? [11] : teeth,
            ToothShade = "A2",
            SentAt = SentAt,
            DueAt = SentAt.AddDays(7),
            TreatmentServiceId = _line,
            TreatmentStageId = raisedOn?.Id
        });

    private static LaboOrder Passed(LaboOrder order) =>
        order.Submit(1).Receive(Guid.NewGuid(), CheckedAt, 1, null)
            .ConfirmPassed([.. order.Teeth.Select(t => new LaboRoundToothResult(t.ToothNumber, LaboToothCheckResult.Passed))], CheckedAt);

    private static LaboOrder WrittenOn(LaboOrder order, int day)
    {
        ObjectHelper.TrySetProperty(order, x => x.CreationTime, () => new DateTime(2026, 10, day, 2, 0, 0, DateTimeKind.Utc));
        return order;
    }

    [Fact]
    public void Unfinished_Order_Should_Lock_The_Raising_And_Later_Stages()
    {
        var before = Stage(1, 20);
        var raised = Stage(2, 22);
        var sameDayLater = Stage(3, 22, hour: 10);
        var after = Stage(4, 25);
        TreatmentStage[] stages = [before, raised, sameDayLater, after];
        LaboOrder[] orders = [Order(raised).Submit(1)];

        _policy.LocksCompletion(before, stages, orders).ShouldBeFalse();
        _policy.LocksCompletion(raised, stages, orders).ShouldBeTrue();
        _policy.LocksCompletion(sameDayLater, stages, orders).ShouldBeTrue();
        _policy.LocksCompletion(after, stages, orders).ShouldBeTrue();
    }

    [Fact]
    public void Draft_Should_Lock_But_Cancelled_Should_Not()
    {
        var raised = Stage(1, 20);
        var after = Stage(2, 25);
        TreatmentStage[] stages = [raised, after];

        _policy.LocksCompletion(after, stages, [Order(raised)]).ShouldBeTrue();
        _policy.LocksCompletion(after, stages, [Order(raised).Cancel()]).ShouldBeFalse();
    }

    [Fact]
    public void Quality_Passed_Order_Should_Unlock()
    {
        var raised = Stage(1, 20);
        var after = Stage(2, 25);
        var passed = Passed(Order(raised));

        _policy.LocksCompletion(after, [raised, after], [passed]).ShouldBeFalse();
        _policy.LocksCompletion(
                after, [raised, after],
                [passed.ActivateWarranty([new(11, new DateOnly(2026, 10, 8), 12)], CheckedAt, null)])
            .ShouldBeFalse();
    }

    [Fact]
    public void Order_From_The_Labo_Tab_Should_Lock_Stages_From_Its_Day()
    {
        var earlier = Stage(1, 20);
        var sameDay = Stage(2, 22);
        var later = Stage(3, 25);
        TreatmentStage[] stages = [earlier, sameDay, later];
        LaboOrder[] orders = [WrittenOn(Order(raisedOn: null), 22)];

        _policy.LocksCompletion(earlier, stages, orders).ShouldBeFalse();
        _policy.LocksCompletion(sameDay, stages, orders).ShouldBeTrue();
        _policy.LocksCompletion(later, stages, orders).ShouldBeTrue();
    }

    [Fact]
    public void Chip_Should_Name_The_Live_Order_Over_A_Cancelled_One()
    {
        var raised = Stage(1, 20);
        var cancelled = WrittenOn(Order(raised).Cancel(), 20);
        var live = WrittenOn(Order(raised), 21);

        _policy.OrderRaisedOn(raised, [live, cancelled]).ShouldBe(live);
        _policy.OrderRaisedOn(raised, [cancelled]).ShouldBe(cancelled);
        _policy.OrderRaisedOn(Stage(2, 25), [live]).ShouldBeNull();
    }

    [Fact]
    public void Warranty_Should_Be_Offered_On_The_Latest_Stage_Only()
    {
        var raised = Stage(1, 20);
        var latest = Stage(2, 25);
        TreatmentStage[] stages = [raised, latest];
        var passed = Passed(Order(raised, 11, 21));

        _policy.OrderAwaitingWarranty(latest, stages, [passed]).ShouldBe(passed);
        _policy.OrderAwaitingWarranty(raised, stages, [passed]).ShouldBeNull();
    }

    [Fact]
    public void Warranty_Offer_Should_Stay_Until_Every_Passed_Tooth_Has_A_Card()
    {
        var latest = Stage(1, 20);
        var order = Passed(Order(latest, 11, 21));

        order.ActivateWarranty([new(11, new DateOnly(2026, 10, 8), 12)], CheckedAt, null);
        _policy.OrderAwaitingWarranty(latest, [latest], [order]).ShouldBe(order);

        order.ActivateWarranty([new(21, new DateOnly(2026, 10, 8), 12)], CheckedAt, null);
        _policy.OrderAwaitingWarranty(latest, [latest], [order]).ShouldBeNull();
    }

    [Fact]
    public void Warranty_Should_Not_Be_Offered_Before_Quality_Passes()
    {
        var latest = Stage(1, 20);

        _policy.OrderAwaitingWarranty(latest, [latest], [Order(latest).Submit(1)]).ShouldBeNull();
    }
}
