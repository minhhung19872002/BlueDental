using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.PatientManagement;
using BlueDental.PatientManagement.Values;
using BlueDental.Staff;
using BlueDental.TreatmentManagement;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.PatientManagement;

/// <summary>
/// The patient list's Dịch vụ and Bác sĩ columns.
///
/// The reference names exactly one of each — measured 2026-09-07 over 40 of its
/// 54 patients, none carrying a second name, including one with two slips and
/// several lines. See docs/clone/pages/patient-list.md.
/// </summary>
public class PatientListRollupTests
{
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly PatientListRollupCalculator _rollup = new(new PatientMoneyCalculator());

    private Patient APatient() =>
        Patient.Register(
            Guid.NewGuid(),
            "BN2026900",
            "Mai",
            "Lý Thị",
            new DateOnly(1995, 5, 5),
            Gender.Female,
            new ContactInfo("0901234567", null, null),
            _branchId);

    private TreatmentPlan APlan(Guid dentistId, string code) =>
        TreatmentPlan.Open(Guid.NewGuid(), Guid.NewGuid(), dentistId, _branchId, code, "Kế hoạch");

    private static TreatmentService ALine(TreatmentPlan plan, Guid serviceId, DateTime createdAt)
    {
        var line = plan.AddService(
            Guid.NewGuid(), serviceId, Guid.NewGuid(), 1_000_000m, 1, DiscountType.None, 0m);
        // Auditing fills CreationTime on save, and its setter is protected, so a
        // unit test has to reach past it to say which line came last.
        ObjectHelper.TrySetProperty(line, x => x.CreationTime, () => createdAt);
        return line;
    }

    private PatientRollup Fold(Patient patient, params TreatmentPlan[] plans) =>
        _rollup.For(patient, plans, [], Array.Empty<Appointment>(), DateTimeOffset.UtcNow);

    [Fact]
    public void Only_the_newest_service_line_names_the_columns()
    {
        var dentist = Guid.NewGuid();
        var plan = APlan(dentist, "DT01");
        var older = Guid.NewGuid();
        var newer = Guid.NewGuid();
        ALine(plan, older, new DateTime(2026, 1, 1));
        ALine(plan, newer, new DateTime(2026, 6, 1));

        var rollup = Fold(APatient(), plan);

        rollup.ServiceCatalogIds.ShouldBe([newer]);
        rollup.DentistIds.ShouldBe([dentist]);
    }

    [Fact]
    public void The_newest_line_wins_across_several_slips()
    {
        // Two slips, two doctors: the row names the doctor of the slip the
        // newest line sits on, so service and doctor describe one piece of work.
        var oldDentist = Guid.NewGuid();
        var newDentist = Guid.NewGuid();
        var patient = APatient();

        var oldPlan = APlan(oldDentist, "DT01");
        var oldService = Guid.NewGuid();
        ALine(oldPlan, oldService, new DateTime(2026, 1, 1));

        var newPlan = APlan(newDentist, "DT02");
        var newService = Guid.NewGuid();
        ALine(newPlan, newService, new DateTime(2026, 6, 1));

        var rollup = Fold(patient, oldPlan, newPlan);

        rollup.ServiceCatalogIds.ShouldBe([newService]);
        rollup.DentistIds.ShouldBe([newDentist]);
    }

    [Fact]
    public void A_cancelled_line_never_names_the_columns()
    {
        var dentist = Guid.NewGuid();
        var plan = APlan(dentist, "DT01");
        var kept = Guid.NewGuid();
        ALine(plan, kept, new DateTime(2026, 1, 1));
        ALine(plan, Guid.NewGuid(), new DateTime(2026, 6, 1)).Cancel();

        var rollup = Fold(APatient(), plan);

        rollup.ServiceCatalogIds.ShouldBe([kept]);
    }

    [Fact]
    public void A_patient_with_no_live_line_names_neither_column()
    {
        // The reference leaves both cells as an em dash together — no row was
        // seen with a doctor but no service.
        var rollup = Fold(APatient(), APlan(Guid.NewGuid(), "DT01"));

        rollup.ServiceCatalogIds.ShouldBeEmpty();
        rollup.DentistIds.ShouldBeEmpty();
    }

    // ── BA bug 41: Số tiền / Thực thu / Công nợ count what the viewer sees ──

    private static readonly Guid Viewer = Guid.NewGuid();

    private static TreatmentService AFinishedLine(TreatmentPlan plan, decimal price, Guid? dentist = null)
    {
        var line = plan.AddService(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), price, 1, DiscountType.None, 0m);
        line.SetDetails(null, dentist, null, null, null, null, null);
        return line.Complete();
    }

    private static PatientPayment APayment(TreatmentPlan plan, params (Guid LineId, decimal Amount)[] lines) =>
        PatientPayment.Record(
            Guid.NewGuid(), plan.PatientId, plan.BranchId, PatientPaymentKind.Payment, PaymentMethodKind.Cash,
            lines.Sum(l => l.Amount), "PT26-0001", Guid.NewGuid(), DateTimeOffset.UtcNow,
            treatmentPlanId: plan.Id, lines: lines.Select(l => (l.LineId, l.Amount)));

    /// <summary>
    /// One slip the viewer received (4 tr, 1 tr paid), one another team received
    /// with a 2 tr line assigned to the viewer (0,5 tr paid on it, the 3 tr rest
    /// paid off) and one with nothing of the viewer's (10 tr unpaid) — all work done.
    /// </summary>
    private (TreatmentPlan[] Plans, PatientPayment[] Payments) ThreeSlips()
    {
        var other = Guid.NewGuid();
        var received = APlan(Viewer, "DT01");
        var receivedLine = AFinishedLine(received, 4_000_000m);
        var through = APlan(other, "DT02");
        var mine = AFinishedLine(through, 2_000_000m, dentist: Viewer);
        var theirs = AFinishedLine(through, 3_000_000m);
        var hidden = APlan(other, "DT03");
        AFinishedLine(hidden, 10_000_000m);

        return (
            [received, through, hidden],
            [
                APayment(received, (receivedLine.Id, 1_000_000m)),
                APayment(through, (mine.Id, 500_000m), (theirs.Id, 3_000_000m))
            ]);
    }

    private PatientRollup FoldFor(SlipScope? scope)
    {
        var (plans, payments) = ThreeSlips();
        return _rollup.For(APatient(), plans, payments, Array.Empty<Appointment>(), DateTimeOffset.UtcNow, scope);
    }

    [Fact]
    public void With_no_scope_the_money_counts_every_slip()
    {
        var rollup = FoldFor(null);

        rollup.TotalAmount.ShouldBe(19_000_000m);
        rollup.TotalRevenue.ShouldBe(4_500_000m);
        rollup.TotalDebt.ShouldBe(14_500_000m);
    }

    [Fact]
    public void A_scoped_row_counts_its_received_slips_and_its_assigned_lines()
    {
        var rollup = FoldFor(new SlipScope(new HashSet<Guid> { Viewer }));

        rollup.TotalAmount.ShouldBe(6_000_000m);
        rollup.TotalRevenue.ShouldBe(1_500_000m);
        rollup.TotalDebt.ShouldBe(4_500_000m);
    }

    [Fact]
    public void Without_the_cost_permission_an_assigned_line_adds_nothing()
    {
        var rollup = FoldFor(new SlipScope(new HashSet<Guid> { Viewer }, ShowsLineMoney: false));

        rollup.TotalAmount.ShouldBe(4_000_000m);
        rollup.TotalRevenue.ShouldBe(1_000_000m);
        rollup.TotalDebt.ShouldBe(3_000_000m);
    }

    [Fact]
    public void A_row_reads_the_same_figures_as_the_records_ho_so_cards()
    {
        var scope = new SlipScope(new HashSet<Guid> { Viewer });
        var (plans, payments) = ThreeSlips();

        var rollup = _rollup.For(APatient(), plans, payments, Array.Empty<Appointment>(), DateTimeOffset.UtcNow, scope);
        var cards = new PatientMoneyCalculator().ForScope(plans, payments, scope);

        rollup.TotalAmount.ShouldBe(cards.TotalPrice);
        rollup.TotalRevenue.ShouldBe(cards.TotalPaid - cards.TotalRefund);
        rollup.TotalDebt.ShouldBe(cards.TotalDue);
    }
}
