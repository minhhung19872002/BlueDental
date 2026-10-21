using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Billing;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp.Domain.Services;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Builds the reference's 13-field money rollup from slips and money movements.
///
/// The rollup is always derived — the reference recomputes it on every payload
/// (patient summary, treatment slip, service line), so nothing here is stored.
/// Stateless by design: it takes the aggregates rather than a repository.
/// </summary>
public class PatientMoneyCalculator : IDomainService
{
    /// <summary>Rollup of one slip.</summary>
    public PaymentSummary ForPlan(TreatmentPlan plan, IReadOnlyCollection<PatientPayment> payments)
    {
        var ofPlan = payments.Where(p => p.TreatmentPlanId == plan.Id).ToList();

        return PaymentSummary.From(
            // VAT included: what the patient is asked to pay, so Còn nợ counts it.
            totalPrice: plan.PayableAmount,
            totalPaid: ofPlan.Where(p => p.Kind == PatientPaymentKind.Payment).Sum(p => p.Amount),
            completedValue: plan.CompletedValue,
            totalRefund: ofPlan.Where(p => p.Kind == PatientPaymentKind.Refund).Sum(p => p.Amount),
            discount: plan.PlanDiscountAmount + plan.ServiceVoucherTotal + plan.ServicesDiscountAmount);
    }

    /// <summary>
    /// Rollup of <paramref name="lineIds"/> alone on one slip (BA bug 40): what
    /// a viewer who is only assigned those lines sees. Đã thu / Đã hoàn are the
    /// receipts' shares on those lines — a receipt or refund against a slip
    /// always names the lines it covers.
    /// </summary>
    public PaymentSummary ForLines(
        TreatmentPlan plan,
        IReadOnlySet<Guid> lineIds,
        IReadOnlyCollection<PatientPayment> payments)
    {
        var money = plan.MoneyOfLines(lineIds);
        var shares = payments
            .Where(p => p.TreatmentPlanId == plan.Id)
            .SelectMany(p => p.Lines
                .Where(line => lineIds.Contains(line.TreatmentServiceId))
                .Select(line => (p.Kind, line.Amount)))
            .ToList();

        return PaymentSummary.From(
            totalPrice: money.Payable,
            totalPaid: shares.Where(s => s.Kind == PatientPaymentKind.Payment).Sum(s => s.Amount),
            completedValue: money.Completed,
            totalRefund: shares.Where(s => s.Kind == PatientPaymentKind.Refund).Sum(s => s.Amount),
            discount: money.TotalDiscount);
    }

    /// <summary>Several rollups as one: the primary amounts added up, the rest derived again.</summary>
    public PaymentSummary Sum(IReadOnlyCollection<PaymentSummary> parts) =>
        PaymentSummary.From(
            totalPrice: parts.Sum(p => p.TotalPrice),
            totalPaid: parts.Sum(p => p.TotalPaid),
            completedValue: parts.Sum(p => p.CompletedValue),
            totalRefund: parts.Sum(p => p.TotalRefund),
            discount: parts.Sum(p => p.Discount),
            prepaid: parts.Sum(p => p.Prepaid));

    /// <summary>
    /// "Công nợ tồn": finished work not yet paid for, slip by slip. Each slip's
    /// Phải thu is floored at zero before the sum, so money paid ahead on one
    /// slip (Tạm ứng) never cancels what is owed on another — summed as one
    /// figure, a day of prepayments read as a large negative debt.
    /// </summary>
    public decimal UnpaidFinishedWork(
        IReadOnlyCollection<TreatmentPlan> plans,
        IReadOnlyCollection<PatientPayment> payments)
    {
        var byPlan = payments
            .Where(p => p.TreatmentPlanId.HasValue)
            .GroupBy(p => p.TreatmentPlanId!.Value)
            .ToDictionary(g => g.Key, g => (IReadOnlyCollection<PatientPayment>)g.ToList());

        return plans.Sum(plan =>
            System.Math.Max(0m, ForPlan(plan, byPlan.GetValueOrDefault(plan.Id, [])).Receivable));
    }

    /// <summary>Rollup of everything a patient owes and has paid, across every slip.</summary>
    public PaymentSummary ForPatient(
        IReadOnlyCollection<TreatmentPlan> plans,
        IReadOnlyCollection<PatientPayment> payments)
    {
        var againstSlips = payments.Where(p => p.Kind != PatientPaymentKind.Prepaid).ToList();

        return PaymentSummary.From(
            totalPrice: plans.Sum(p => p.PayableAmount),
            totalPaid: againstSlips.Where(p => p.Kind == PatientPaymentKind.Payment).Sum(p => p.Amount),
            completedValue: plans.Sum(p => p.CompletedValue),
            totalRefund: againstSlips.Where(p => p.Kind == PatientPaymentKind.Refund).Sum(p => p.Amount),
            discount: plans.Sum(p => p.PlanDiscountAmount + p.ServiceVoucherTotal + p.ServicesDiscountAmount),
            prepaid: HeldForPatient(payments));
    }

    /// <summary>
    /// Money the clinic is holding for the patient: what was topped up, less what
    /// has already been spent on slips.
    /// </summary>
    public decimal HeldForPatient(IReadOnlyCollection<PatientPayment> payments)
    {
        var toppedUp = payments.Where(p => p.Kind == PatientPaymentKind.Prepaid).Sum(p => p.Amount);
        var spent = payments
            .Where(p => p.Kind == PatientPaymentKind.Payment && p.Method == PaymentMethodKind.OutstandingDebt)
            .Sum(p => p.Amount);

        var held = toppedUp - spent;
        return held > 0m ? held : 0m;
    }
}
