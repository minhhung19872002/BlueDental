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
            totalPrice: plan.TotalAmount,
            totalPaid: ofPlan.Where(p => p.Kind == PatientPaymentKind.Payment).Sum(p => p.Amount),
            completedValue: plan.CompletedValue,
            totalRefund: ofPlan.Where(p => p.Kind == PatientPaymentKind.Refund).Sum(p => p.Amount),
            discount: plan.PlanDiscountAmount + plan.Services.Sum(s => s.DiscountAmount));
    }

    /// <summary>Rollup of everything a patient owes and has paid, across every slip.</summary>
    public PaymentSummary ForPatient(
        IReadOnlyCollection<TreatmentPlan> plans,
        IReadOnlyCollection<PatientPayment> payments)
    {
        var againstSlips = payments.Where(p => p.Kind != PatientPaymentKind.Prepaid).ToList();

        return PaymentSummary.From(
            totalPrice: plans.Sum(p => p.TotalAmount),
            totalPaid: againstSlips.Where(p => p.Kind == PatientPaymentKind.Payment).Sum(p => p.Amount),
            completedValue: plans.Sum(p => p.CompletedValue),
            totalRefund: againstSlips.Where(p => p.Kind == PatientPaymentKind.Refund).Sum(p => p.Amount),
            discount: plans.Sum(p => p.PlanDiscountAmount + p.Services.Sum(s => s.DiscountAmount)),
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
