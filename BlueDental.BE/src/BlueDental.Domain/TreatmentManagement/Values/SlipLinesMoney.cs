namespace BlueDental.TreatmentManagement.Values;

/// <summary>
/// A slip's money read over some of its lines only (BA bug 40, 2026-10-21):
/// what a viewer assigned those lines of a slip received outside their scope
/// may see. Each line counts at what it is charged on the slip — its share of
/// the slip discount and voucher taken off — so the parts of a slip add up to
/// the whole. Lines that no longer count (cancelled, replaced, transferred)
/// add nothing, as on the whole slip.
/// </summary>
public sealed record SlipLinesMoney(
    decimal GrossTotal,
    decimal ServicesTotal,
    decimal ServicesDiscount,
    decimal ServiceVoucher,
    decimal PlanDiscount,
    decimal PlanVoucher,
    decimal Total,
    decimal Tax,
    decimal Completed)
{
    /// <summary>The slip's own %/money discount part of <see cref="PlanDiscount"/> ("Giảm KHDT").</summary>
    public decimal PlanOwnDiscount => PlanDiscount - PlanVoucher;

    public decimal TotalDiscount => ServicesDiscount + ServiceVoucher + PlanDiscount;

    /// <summary>VAT included, like <see cref="TreatmentPlan.PayableAmount"/>.</summary>
    public decimal Payable => Total + Tax;
}
