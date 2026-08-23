using System;
using System.Collections.Generic;
using BlueDental.Billing;
using BlueDental.TreatmentManagement;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>
/// Phiếu điều trị: the money rollup and the progress the reference shows on the
/// treatment-plan table.
/// </summary>
public class TreatmentPlanSlipTests
{
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _dentistId = Guid.NewGuid();
    private readonly PatientMoneyCalculator _money = new();

    private TreatmentPlan OpenPlan(
        DiscountType discountType = DiscountType.None,
        decimal discountValue = 0m)
    {
        return TreatmentPlan.Open(
            Guid.NewGuid(),
            _patientId,
            _dentistId,
            _branchId,
            "DT01",
            "Kế hoạch điều trị",
            discountType: discountType,
            discountValue: discountValue);
    }

    private static TreatmentService AddLine(
        TreatmentPlan plan,
        decimal price,
        int quantity = 1,
        DiscountType discountType = DiscountType.None,
        decimal discountValue = 0m)
    {
        return plan.AddService(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            price,
            quantity,
            discountType,
            discountValue);
    }

    private PatientPayment Pay(
        TreatmentPlan plan,
        decimal amount,
        PatientPaymentKind kind = PatientPaymentKind.Payment,
        PaymentMethodKind method = PaymentMethodKind.Cash)
    {
        return PatientPayment.Record(
            Guid.NewGuid(),
            _patientId,
            _branchId,
            kind,
            method,
            amount,
            "PT26-0001",
            _dentistId,
            DateTimeOffset.UtcNow,
            kind == PatientPaymentKind.Prepaid ? null : plan.Id);
    }

    [Fact]
    public void A_slip_opens_in_progress_with_no_lines_and_no_progress()
    {
        var plan = OpenPlan();

        plan.Status.ShouldBe(TreatmentPlanStatus.InProgress);
        plan.Services.ShouldBeEmpty();
        plan.ProgressPercent.ShouldBe(0);
        plan.TotalAmount.ShouldBe(0m);
    }

    [Fact]
    public void Service_lines_are_numbered_inside_their_slip()
    {
        var plan = OpenPlan();

        AddLine(plan, 1_000_000m).Code.ShouldBe("DT01-01");
        AddLine(plan, 2_000_000m).Code.ShouldBe("DT01-02");
    }

    [Fact]
    public void The_same_consulting_line_cannot_be_pulled_in_twice()
    {
        var plan = OpenPlan();
        var adviseId = Guid.NewGuid();

        plan.AddService(Guid.NewGuid(), Guid.NewGuid(), adviseId, 500_000m, 1, DiscountType.None, 0m);

        Should.Throw<BusinessException>(() =>
                plan.AddService(Guid.NewGuid(), Guid.NewGuid(), adviseId, 500_000m, 1, DiscountType.None, 0m))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition);
    }

    [Fact]
    public void A_slip_discount_applies_on_top_of_the_line_discounts()
    {
        var plan = OpenPlan(DiscountType.Percentage, 10m);
        AddLine(plan, 1_000_000m, quantity: 2);                                    // 2.000.000
        AddLine(plan, 1_000_000m, discountType: DiscountType.Money, discountValue: 200_000m); // 800.000

        plan.ServicesTotal.ShouldBe(2_800_000m);
        plan.PlanDiscountAmount.ShouldBe(280_000m);
        plan.TotalAmount.ShouldBe(2_520_000m);
    }

    [Fact]
    public void A_discount_never_exceeds_the_slip()
    {
        var plan = OpenPlan(DiscountType.Money, 10_000_000m);
        AddLine(plan, 1_000_000m);

        plan.PlanDiscountAmount.ShouldBe(1_000_000m);
        plan.TotalAmount.ShouldBe(0m);
    }

    [Fact]
    public void A_cancelled_line_is_worth_nothing_and_leaves_the_progress()
    {
        var plan = OpenPlan();
        var kept = AddLine(plan, 1_000_000m);
        var dropped = AddLine(plan, 4_000_000m);

        dropped.Cancel();

        plan.ServicesTotal.ShouldBe(1_000_000m);
        plan.ProgressPercent.ShouldBe(0);

        kept.Complete();
        plan.ProgressPercent.ShouldBe(100);
    }

    [Fact]
    public void A_slip_closes_once_every_counted_line_is_done()
    {
        var plan = OpenPlan();
        var first = AddLine(plan, 1_000_000m);
        var second = AddLine(plan, 2_000_000m);

        first.Complete();
        plan.CloseIfAllServicesDone();
        plan.Status.ShouldBe(TreatmentPlanStatus.InProgress);

        second.Complete();
        plan.CloseIfAllServicesDone();
        plan.Status.ShouldBe(TreatmentPlanStatus.Completed);
    }

    [Fact]
    public void Phai_thu_only_counts_the_lines_already_finished()
    {
        var plan = OpenPlan();
        var done = AddLine(plan, 1_000_000m);
        AddLine(plan, 3_000_000m);
        done.Complete();

        var payments = new List<PatientPayment>();
        var summary = _money.ForPlan(plan, payments);

        summary.TotalPrice.ShouldBe(4_000_000m);
        summary.CompletedValue.ShouldBe(1_000_000m);

        // Nothing paid yet, so the finished work is what the clinic may collect.
        summary.Receivable.ShouldBe(1_000_000m);
        summary.Debt.ShouldBe(1_000_000m);
        summary.TotalDue.ShouldBe(4_000_000m);
    }

    [Fact]
    public void Paying_more_than_the_finished_work_shows_as_paid_uncompleted()
    {
        var plan = OpenPlan();
        var done = AddLine(plan, 1_000_000m);
        AddLine(plan, 3_000_000m);
        done.Complete();

        var summary = _money.ForPlan(plan, [Pay(plan, 2_500_000m)]);

        summary.TotalPaid.ShouldBe(2_500_000m);
        summary.Debt.ShouldBe(0m);
        summary.PaidUncompleted.ShouldBe(1_500_000m);
        summary.TotalDue.ShouldBe(1_500_000m);
    }

    [Fact]
    public void A_refund_takes_money_back_out_of_the_rollup()
    {
        var plan = OpenPlan();
        AddLine(plan, 2_000_000m).Complete();

        var summary = _money.ForPlan(plan, [
            Pay(plan, 2_000_000m),
            Pay(plan, 500_000m, PatientPaymentKind.Refund)
        ]);

        summary.TotalPaid.ShouldBe(2_000_000m);
        summary.TotalRefund.ShouldBe(500_000m);
        summary.TotalDue.ShouldBe(500_000m);
        summary.Debt.ShouldBe(500_000m);
    }

    [Fact]
    public void Money_held_for_the_patient_is_what_was_topped_up_less_what_was_spent()
    {
        var plan = OpenPlan();
        AddLine(plan, 1_000_000m);

        var payments = new List<PatientPayment>
        {
            Pay(plan, 3_000_000m, PatientPaymentKind.Prepaid),
            Pay(plan, 1_000_000m, PatientPaymentKind.Payment, PaymentMethodKind.OutstandingDebt)
        };

        _money.HeldForPatient(payments).ShouldBe(2_000_000m);
    }

    [Fact]
    public void Held_money_never_goes_negative()
    {
        var plan = OpenPlan();
        var payments = new List<PatientPayment>
        {
            Pay(plan, 500_000m, PatientPaymentKind.Payment, PaymentMethodKind.OutstandingDebt)
        };

        _money.HeldForPatient(payments).ShouldBe(0m);
    }

    [Fact]
    public void Held_money_cannot_belong_to_a_slip()
    {
        var plan = OpenPlan();

        Should.Throw<BusinessException>(() => PatientPayment.Record(
                Guid.NewGuid(),
                _patientId,
                _branchId,
                PatientPaymentKind.Prepaid,
                PaymentMethodKind.Cash,
                100_000m,
                "GH26-0001",
                _dentistId,
                DateTimeOffset.UtcNow,
                plan.Id))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition);
    }

    [Fact]
    public void A_payment_must_name_its_slip()
    {
        Should.Throw<BusinessException>(() => PatientPayment.Record(
                Guid.NewGuid(),
                _patientId,
                _branchId,
                PatientPaymentKind.Payment,
                PaymentMethodKind.Cash,
                100_000m,
                "PT26-0001",
                _dentistId,
                DateTimeOffset.UtcNow))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition);
    }

    [Fact]
    public void A_money_movement_is_always_positive()
    {
        var plan = OpenPlan();

        Should.Throw<BusinessException>(() => Pay(plan, 0m))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.InsufficientPaymentAmount);
    }

    [Fact]
    public void A_finished_line_cannot_be_cancelled()
    {
        var plan = OpenPlan();
        var line = AddLine(plan, 1_000_000m);
        line.Complete();

        Should.Throw<BusinessException>(() => line.Cancel())
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition);
    }
}
