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

    /// <summary>
    /// A "Chuyển đổi" line has been superseded and an "Đã chuyển" line has moved
    /// to another slip, so neither is charged here. Measured on the reference
    /// (staging, 2026-09-21): DT33 carries a 1.000.000 đ line plus a 909.091 đ
    /// <c>replaced</c> one and answers <c>totalPrice: 1000000</c>.
    /// </summary>
    [Fact]
    public void A_converted_or_transferred_line_is_not_charged_on_this_slip()
    {
        var plan = OpenPlan();
        AddLine(plan, 1_000_000m);
        AddLine(plan, 909_091m).SetInitialStatus(TreatmentServiceStatus.Replaced);
        AddLine(plan, 500_000m).SetInitialStatus(TreatmentServiceStatus.Transferred);

        plan.ServicesTotal.ShouldBe(1_000_000m);
        plan.TotalAmount.ShouldBe(1_000_000m);
        plan.ProgressPercent.ShouldBe(0);
    }

    [Fact]
    public void The_rollup_discount_and_what_is_owed_add_back_up_to_the_gross()
    {
        // The treatment-plan table prints "Tổng phiếu" − "Giảm giá" = "Thành tiền",
        // and reads the last two straight off this rollup, so the first has to be
        // recoverable from them.
        var plan = OpenPlan(DiscountType.Money, 820_000m);
        AddLine(plan, 2_500_000m, discountType: DiscountType.Money, discountValue: 100_000m);

        var rollup = _money.ForPlan(plan, new List<PatientPayment>());

        rollup.TotalPrice.ShouldBe(1_580_000m);
        rollup.Discount.ShouldBe(920_000m);
        (rollup.TotalPrice + rollup.Discount).ShouldBe(2_500_000m);
    }

    [Fact]
    public void A_cancelled_line_discounts_nothing()
    {
        var plan = OpenPlan();
        AddLine(plan, 1_000_000m);
        var dropped = AddLine(plan, 4_000_000m, discountType: DiscountType.Money, discountValue: 500_000m);

        dropped.Cancel();

        var rollup = _money.ForPlan(plan, new List<PatientPayment>());

        rollup.Discount.ShouldBe(0m);
        (rollup.TotalPrice + rollup.Discount).ShouldBe(1_000_000m);
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

        // Nothing paid yet, so the finished work is what the clinic may collect
        // now, while the whole slip is still owed.
        summary.Receivable.ShouldBe(1_000_000m);
        summary.Debt.ShouldBe(4_000_000m);
    }

    /// <summary>
    /// The slip discount is spread over the lines in proportion, so the share of
    /// a finished line is a repeating decimal as soon as the ratio is not exact.
    /// Đồng has no minor unit, and the table printed "204.545,455 đ" until this
    /// was rounded (R-459).
    /// </summary>
    [Fact]
    public void Phai_thu_stays_a_whole_dong_when_the_discount_does_not_divide()
    {
        // 2.750.000 over three lines, 500.000 off the slip, one 250.000 line done.
        var plan = OpenPlan(DiscountType.Money, 500_000m);
        var done = AddLine(plan, 250_000m);
        AddLine(plan, 1_500_000m);
        AddLine(plan, 1_000_000m);
        done.Complete();

        plan.ServicesTotal.ShouldBe(2_750_000m);
        plan.PlanDiscountAmount.ShouldBe(500_000m);

        // 250.000 − 500.000×250.000/2.750.000 = 204545,4545… → 204.545.
        plan.CompletedValue.ShouldBe(204_545m);
        plan.CompletedValue.ShouldBe(decimal.Truncate(plan.CompletedValue));

        var summary = _money.ForPlan(plan, new List<PatientPayment>());
        summary.CompletedValue.ShouldBe(204_545m);
        summary.Receivable.ShouldBe(204_545m);
    }

    /// <summary>A percentage that does not land on a whole đồng is rounded too.</summary>
    [Fact]
    public void A_percentage_discount_is_rounded_to_a_whole_dong()
    {
        var plan = OpenPlan();
        var line = AddLine(plan, 333_333m, discountType: DiscountType.Percentage, discountValue: 7m);

        // 333.333 × 7% = 23333,31 → 23.333.
        line.DiscountAmount.ShouldBe(23_333m);
        line.EffectiveAmount.ShouldBe(310_000m);
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
        summary.Receivable.ShouldBe(-1_500_000m);   // the UI clamps this at zero
        summary.PaidUncompleted.ShouldBe(1_500_000m);
        summary.Debt.ShouldBe(1_500_000m);          // 4tr slip, 2,5tr collected
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
        summary.Receivable.ShouldBe(500_000m);
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
    [Fact]
    public void A_finished_line_goes_back_to_work_when_a_step_is_re_opened()
    {
        // Un-ticking Hoàn thành on the last open công đoạn has to carry the line
        // back with it, or the row would keep reading "Hoàn thành" over a step
        // that is open again.
        var plan = OpenPlan();
        var line = AddLine(plan, 1_000_000m);
        line.Complete();
        line.IsCompleted.ShouldBeTrue();

        line.Reopen();

        line.Status.ShouldBe(TreatmentServiceStatus.InProgress);
        line.IsCompleted.ShouldBeFalse();
    }

    [Fact]
    public void Re_opening_a_line_that_was_never_finished_changes_nothing()
    {
        var plan = OpenPlan();
        var line = AddLine(plan, 1_000_000m);

        line.Reopen();

        line.Status.ShouldBe(TreatmentServiceStatus.Created);
    }

    [Fact]
    public void A_cancelled_line_stays_closed_when_a_step_is_re_opened()
    {
        // Cancelling is a decision about the line; its công đoạn do not overturn it.
        var plan = OpenPlan();
        var line = AddLine(plan, 1_000_000m);
        line.Cancel();

        Should.Throw<BusinessException>(() => line.Reopen())
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition);
    }

    [Fact]
    public void A_closed_slip_re_opens_once_one_of_its_lines_is_back_at_work()
    {
        var plan = OpenPlan();
        var first = AddLine(plan, 1_000_000m);
        var second = AddLine(plan, 500_000m);
        // TreatmentPlan.Open already lands InProgress — no approval step here.

        first.Complete();
        second.Complete();
        plan.CloseIfAllServicesDone();
        plan.Status.ShouldBe(TreatmentPlanStatus.Completed);

        second.Reopen();
        plan.ReopenIfAnyServiceActive();

        plan.Status.ShouldBe(TreatmentPlanStatus.InProgress);
    }

    [Fact]
    public void A_closed_slip_stays_closed_while_every_line_is_still_finished()
    {
        var plan = OpenPlan();
        var line = AddLine(plan, 1_000_000m);
        line.Complete();
        plan.CloseIfAllServicesDone();

        plan.ReopenIfAnyServiceActive();

        plan.Status.ShouldBe(TreatmentPlanStatus.Completed);
    }

    [Fact]
    public void A_new_line_is_born_without_a_slot()
    {
        // Until the clinic drags something, the slip reads newest first — which
        // only works while every line is still unnumbered.
        var plan = OpenPlan();

        AddLine(plan, 1_000_000m).SortOrder.ShouldBe(0);
        AddLine(plan, 2_000_000m).SortOrder.ShouldBe(0);
    }

    [Fact]
    public void A_dragged_line_renumbers_the_ones_it_passes()
    {
        var plan = OpenPlan();
        var first = AddLine(plan, 1_000_000m);
        var second = AddLine(plan, 2_000_000m);
        var third = AddLine(plan, 3_000_000m);

        plan.ReorderService(first.Id, 3);

        second.SortOrder.ShouldBe(1);
        third.SortOrder.ShouldBe(2);
        first.SortOrder.ShouldBe(3);
    }

    [Fact]
    public void A_drop_past_the_end_lands_on_the_last_slot()
    {
        var plan = OpenPlan();
        var first = AddLine(plan, 1_000_000m);
        AddLine(plan, 2_000_000m);

        plan.ReorderService(first.Id, 99);

        first.SortOrder.ShouldBe(2);
    }

    [Fact]
    public void Converting_a_line_closes_it_and_writes_the_one_that_replaces_it()
    {
        var plan = OpenPlan();
        var old = AddLine(plan, 3_500_000m);
        var newServiceId = Guid.NewGuid();

        var line = plan.ConvertService(old.Id, Guid.NewGuid(), newServiceId, 400_000m, 1, 400_000m);

        old.Status.ShouldBe(TreatmentServiceStatus.Replaced);
        old.ReplacedId.ShouldBe(line.Id);
        line.ReplacedId.ShouldBe(old.Id);
        line.ServiceId.ShouldBe(newServiceId);
        line.Status.ShouldBe(TreatmentServiceStatus.Created);
        line.EffectiveAmount.ShouldBe(400_000m);
    }

    [Fact]
    public void A_converted_line_is_no_longer_worth_anything_to_the_slip()
    {
        var plan = OpenPlan();
        var old = AddLine(plan, 3_500_000m);

        plan.ConvertService(old.Id, Guid.NewGuid(), Guid.NewGuid(), 400_000m, 1, 400_000m);

        plan.TotalAmount.ShouldBe(400_000m);
    }

    [Fact]
    public void Charging_less_than_the_list_price_shows_up_as_a_discount()
    {
        var plan = OpenPlan();
        var old = AddLine(plan, 3_500_000m);

        var line = plan.ConvertService(old.Id, Guid.NewGuid(), Guid.NewGuid(), 1_000_000m, 2, 1_500_000m);

        line.Price.ShouldBe(1_000_000m);
        line.Quantity.ShouldBe(2);
        line.DiscountAmount.ShouldBe(500_000m);
        line.EffectiveAmount.ShouldBe(1_500_000m);
    }

    [Fact]
    public void A_conversion_cannot_charge_more_than_the_new_service_costs()
    {
        var plan = OpenPlan();
        var old = AddLine(plan, 3_500_000m);

        Should.Throw<BusinessException>(
            () => plan.ConvertService(old.Id, Guid.NewGuid(), Guid.NewGuid(), 400_000m, 1, 900_000m));
    }

    [Fact]
    public void A_finished_line_cannot_be_converted()
    {
        var plan = OpenPlan();
        var old = AddLine(plan, 3_500_000m);
        old.Complete();

        Should.Throw<BusinessException>(
            () => plan.ConvertService(old.Id, Guid.NewGuid(), Guid.NewGuid(), 400_000m, 1, 400_000m));
    }

    [Fact]
    public void Money_already_collected_follows_the_service_it_was_paid_for()
    {
        var plan = OpenPlan();
        var old = AddLine(plan, 3_500_000m);
        var newLineId = Guid.NewGuid();
        var receipt = PatientPayment.Record(
            Guid.NewGuid(),
            _patientId,
            _branchId,
            PatientPaymentKind.Payment,
            PaymentMethodKind.Cash,
            1_000_000m,
            "PT26-0001",
            _dentistId,
            DateTimeOffset.UtcNow,
            plan.Id,
            lines: [(old.Id, 1_000_000m)],
            lineIdFactory: Guid.NewGuid);

        var moved = receipt.Redirect(old.Id, newLineId, 400_000m, Guid.NewGuid);

        moved.ShouldBe(400_000m);
        receipt.AmountFor(newLineId).ShouldBe(400_000m);
        // The rest stays where it was, for the dialog's "Xử lý chênh lệch" to settle.
        receipt.AmountFor(old.Id).ShouldBe(600_000m);
        receipt.Amount.ShouldBe(1_000_000m);
    }

}
