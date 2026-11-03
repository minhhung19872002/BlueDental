using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Billing;

namespace BlueDental.TreatmentManagement.Values;

/// <summary>
/// What receipts have done to one slip line (P2910): the money collected net
/// of refunds, the relief let off without money (TN giảm + voucher, before
/// VAT) and the VAT inside that money. Only the receipts the caller hands in
/// count — the ISettleable filter keeps those to "Đã thanh toán" ones.
/// </summary>
public sealed record LineSettlement(decimal Cash, decimal Relief, decimal Tax)
{
    public static readonly LineSettlement None = new(0m, 0m, 0m);

    /// <summary>Each line of <paramref name="plan"/> that <paramref name="payments"/> touch.</summary>
    public static Dictionary<Guid, LineSettlement> Of(TreatmentPlan plan, IEnumerable<PatientPayment> payments)
    {
        var services = plan.Services.ToDictionary(s => s.Id);
        var settled = new Dictionary<Guid, LineSettlement>();
        foreach (var payment in payments.Where(p => p.TreatmentPlanId == plan.Id))
        {
            var sign = payment.Kind == PatientPaymentKind.Refund ? -1m : 1m;
            foreach (var line in payment.Lines)
            {
                if (!services.TryGetValue(line.TreatmentServiceId, out var service))
                {
                    continue;
                }

                var tax = line.TaxAmount ?? TreatmentPlan.TaxWithin(service, line.Amount);
                var soFar = settled.GetValueOrDefault(line.TreatmentServiceId, None);
                settled[line.TreatmentServiceId] = new LineSettlement(
                    soFar.Cash + sign * line.Amount,
                    soFar.Relief + line.Relief,
                    soFar.Tax + sign * tax);
            }
        }

        return settled;
    }

    /// <summary>Plus a đợt that collects <paramref name="cash"/> carrying <paramref name="tax"/> and lets <paramref name="relief"/> off.</summary>
    public LineSettlement With(decimal cash, decimal relief, decimal tax) =>
        new(Cash + cash, Relief + relief, Tax + tax);
}
