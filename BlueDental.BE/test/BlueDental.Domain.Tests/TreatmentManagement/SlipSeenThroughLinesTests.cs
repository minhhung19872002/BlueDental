using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Billing;
using BlueDental.Staff;
using BlueDental.TreatmentManagement;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>
/// BA bug 40 (2026-10-21): a slip received outside the viewer's scope shows on
/// their Kế hoạch điều trị tab when one of its lines is assigned to them — as
/// Bác sĩ điều trị or Bác sĩ tư vấn — with only those lines' money.
/// </summary>
public class SlipSeenThroughLinesTests
{
    private static readonly Guid Receiver = Guid.NewGuid();
    private static readonly Guid Viewer = Guid.NewGuid();
    private static readonly SlipScope ViewerScope = new(new HashSet<Guid> { Viewer });
    private readonly PatientMoneyCalculator _money = new();

    private static TreatmentPlan OpenPlan(
        Guid? consultant = null,
        DiscountType discountType = DiscountType.None,
        decimal discountValue = 0m) =>
        TreatmentPlan.Open(
            Guid.NewGuid(), Guid.NewGuid(), Receiver, Guid.NewGuid(), "DT01", "Kế hoạch điều trị",
            consultantStaffId: consultant, discountType: discountType, discountValue: discountValue);

    private static TreatmentService AddLine(TreatmentPlan plan, decimal price) =>
        plan.AddService(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), price, 1, DiscountType.None, 0m);

    private static TreatmentService Assign(
        TreatmentService line,
        Guid? dentist = null,
        Guid? consultant = null,
        Guid? secondConsultant = null,
        Guid? diagnoser = null) =>
        line.SetDetails(null, dentist, null, diagnoser, null, consultant, secondConsultant);

    private static PatientPayment Receipt(
        TreatmentPlan plan,
        PatientPaymentKind kind,
        params (Guid LineId, decimal Amount)[] lines) =>
        PatientPayment.Record(
            Guid.NewGuid(), plan.PatientId, plan.BranchId, kind, PaymentMethodKind.Cash,
            lines.Sum(l => l.Amount), "PT26-0001", Guid.NewGuid(), DateTimeOffset.UtcNow,
            treatmentPlanId: plan.Id, lines: lines.Select(l => (l.LineId, l.Amount)));

    [Fact]
    public void A_line_is_assigned_to_its_dentist_and_its_consultants_not_its_diagnosers()
    {
        var plan = OpenPlan();
        var treating = Assign(AddLine(plan, 1_000_000m), dentist: Viewer);
        var consulting = Assign(AddLine(plan, 1_000_000m), consultant: Viewer);
        var secondConsulting = Assign(AddLine(plan, 1_000_000m), secondConsultant: Viewer);
        var diagnosing = Assign(AddLine(plan, 1_000_000m), diagnoser: Viewer);

        ViewerScope.OwnLinesOf(plan)!.ShouldBe(
            new HashSet<Guid> { treating.Id, consulting.Id, secondConsulting.Id }, ignoreOrder: true);
        diagnosing.Id.ShouldNotBeOneOf(ViewerScope.OwnLinesOf(plan)!.ToArray());
    }

    [Fact]
    public void A_line_naming_no_consultant_takes_the_slips()
    {
        var plan = OpenPlan(consultant: Viewer);
        var inherits = AddLine(plan, 1_000_000m);
        Assign(AddLine(plan, 1_000_000m), consultant: Guid.NewGuid());

        ViewerScope.Covers(plan).ShouldBeTrue();
        ViewerScope.OwnLinesOf(plan)!.ShouldBe(new HashSet<Guid> { inherits.Id });
    }

    [Fact]
    public void A_slip_with_no_line_assigned_inside_the_scope_stays_hidden()
    {
        var plan = OpenPlan();
        Assign(AddLine(plan, 1_000_000m), dentist: Guid.NewGuid(), diagnoser: Viewer);

        ViewerScope.Covers(plan).ShouldBeFalse();
    }

    [Fact]
    public void A_slip_received_inside_the_scope_or_with_no_scope_shows_whole()
    {
        var plan = OpenPlan();
        AddLine(plan, 1_000_000m);

        new SlipScope(new HashSet<Guid> { Receiver }).OwnLinesOf(plan).ShouldBeNull();
        ((SlipScope?)null).OwnLinesOf(plan).ShouldBeNull();
        new SlipScope(new HashSet<Guid> { Receiver }, ShowsLineMoney: false).MoneyLinesOf(plan).ShouldBeNull();
        ((SlipScope?)null).MoneyLinesOf(plan).ShouldBeNull();
    }

    [Fact]
    public void The_assigned_lines_money_shows_only_with_the_cost_permission()
    {
        var plan = OpenPlan();
        var mine = Assign(AddLine(plan, 1_000_000m), dentist: Viewer);
        AddLine(plan, 1_000_000m);

        ViewerScope.MoneyLinesOf(plan)!.ShouldBe(new HashSet<Guid> { mine.Id });

        // "Dc assign mà ko có quyền xem thì masking lại hết": still their line to act on, no money.
        var withoutCosts = new SlipScope(new HashSet<Guid> { Viewer }, ShowsLineMoney: false);
        withoutCosts.Covers(plan).ShouldBeTrue();
        withoutCosts.OwnLinesOf(plan)!.ShouldBe(new HashSet<Guid> { mine.Id });
        withoutCosts.MoneyLinesOf(plan)!.ShouldBeEmpty();
    }

    [Fact]
    public void No_line_shows_no_money()
    {
        var plan = OpenPlan(discountType: DiscountType.Money, discountValue: 1_000_000m);
        var line = AddLine(plan, 4_000_000m).Complete();
        var payments = new List<PatientPayment>
        {
            Receipt(plan, PatientPaymentKind.Payment, (line.Id, 2_000_000m))
        };
        var none = new HashSet<Guid>();

        var money = plan.MoneyOfLines(none);
        money.GrossTotal.ShouldBe(0m);
        money.PlanDiscount.ShouldBe(0m);
        money.Total.ShouldBe(0m);
        money.Payable.ShouldBe(0m);
        _money.ForLines(plan, none, payments).ShouldBe(_money.Sum([]));
    }

    [Fact]
    public void The_lines_money_adds_up_to_the_slip()
    {
        var plan = OpenPlan(discountType: DiscountType.Money, discountValue: 3_000_000m);
        var mine = Assign(AddLine(plan, 10_000_000m), dentist: Viewer);
        var theirs = AddLine(plan, 5_000_000m);

        var own = plan.MoneyOfLines(new HashSet<Guid> { mine.Id });
        var rest = plan.MoneyOfLines(new HashSet<Guid> { theirs.Id });

        own.GrossTotal.ShouldBe(10_000_000m);
        own.PlanDiscount.ShouldBe(2_000_000m);
        own.PlanOwnDiscount.ShouldBe(2_000_000m);
        own.Total.ShouldBe(8_000_000m);
        own.Payable.ShouldBe(8_000_000m);
        (own.Total + rest.Total).ShouldBe(plan.TotalAmount);
        (own.PlanDiscount + rest.PlanDiscount).ShouldBe(plan.PlanDiscountAmount);
        (own.TotalDiscount + rest.TotalDiscount).ShouldBe(plan.TotalDiscountAmount);
    }

    [Fact]
    public void Only_a_finished_line_counts_as_completed_work()
    {
        var plan = OpenPlan();
        var done = AddLine(plan, 4_000_000m).Complete();
        var open = AddLine(plan, 6_000_000m);

        plan.MoneyOfLines(new HashSet<Guid> { done.Id, open.Id }).Completed.ShouldBe(4_000_000m);
    }

    [Fact]
    public void Paid_on_the_lines_is_their_share_of_each_receipt_less_refunds()
    {
        var plan = OpenPlan();
        var mine = AddLine(plan, 10_000_000m).Complete();
        var theirs = AddLine(plan, 5_000_000m);
        var payments = new List<PatientPayment>
        {
            Receipt(plan, PatientPaymentKind.Payment, (mine.Id, 6_000_000m), (theirs.Id, 5_000_000m)),
            Receipt(plan, PatientPaymentKind.Refund, (mine.Id, 1_000_000m))
        };

        var summary = _money.ForLines(plan, new HashSet<Guid> { mine.Id }, payments);

        summary.TotalPrice.ShouldBe(10_000_000m);
        summary.TotalPaid.ShouldBe(6_000_000m);
        summary.TotalRefund.ShouldBe(1_000_000m);
        summary.CompletedValue.ShouldBe(10_000_000m);
        summary.Debt.ShouldBe(5_000_000m);
    }

    [Fact]
    public void Rollups_sum_as_one()
    {
        var plan = OpenPlan();
        var mine = AddLine(plan, 10_000_000m).Complete();
        var theirs = AddLine(plan, 5_000_000m).Complete();
        var payments = new List<PatientPayment>
        {
            Receipt(plan, PatientPaymentKind.Payment, (mine.Id, 4_000_000m), (theirs.Id, 5_000_000m))
        };

        var summed = _money.Sum(
        [
            _money.ForLines(plan, new HashSet<Guid> { mine.Id }, payments),
            _money.ForLines(plan, new HashSet<Guid> { theirs.Id }, payments)
        ]);

        summed.ShouldBe(_money.ForPlan(plan, payments));
    }
}
