using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Promotions;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using BlueDental.Values;
using Volo.Abp;

namespace BlueDental.Billing;

/// <summary>What the cashier sets on one line of a đợt: its printed name and TN giảm (in đồng).</summary>
public sealed record PaymentLineTerms(string? ReceiptName, decimal CashierDiscount, string? CashierDiscountReason);

/// <summary>
/// One đợt of a slip (P2910): the lines a receipt pays, the TN giảm on each,
/// the payment-time voucher spread over them, and from those the most each
/// line may still collect and the VAT inside its money. It reads the slip as
/// its paid receipts left it (<c>before</c>), so a pending receipt never
/// counts and is checked again when it is confirmed.
/// </summary>
public sealed class PaymentRound
{
    private readonly TreatmentPlan _plan;
    private readonly IReadOnlyDictionary<Guid, LineSettlement> _before;
    private readonly IReadOnlyDictionary<Guid, PaymentLineTerms> _terms;
    private readonly List<TreatmentService> _lines;
    private readonly Dictionary<Guid, decimal> _voucherShares = new();

    /// <param name="chosen">The lines the receipt pays, in the order the cashier ticked them; one not on the slip owes nothing.</param>
    public PaymentRound(
        TreatmentPlan plan,
        IReadOnlyDictionary<Guid, LineSettlement> before,
        IReadOnlyCollection<Guid> chosen,
        IReadOnlyDictionary<Guid, PaymentLineTerms> terms)
    {
        _plan = Check.NotNull(plan, nameof(plan));
        _before = Check.NotNull(before, nameof(before));
        _terms = Check.NotNull(terms, nameof(terms));
        _lines = chosen.Distinct()
            .Select(id => plan.Services.FirstOrDefault(line => line.Id == id))
            .OfType<TreatmentService>()
            .ToList();

        if (terms.Keys.Any(id => _lines.All(line => line.Id != id)))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "A cashier discount names a service the receipt does not pay.");
        }

        // TN giảm comes off before VAT, so it can take at most what the line
        // still owes before VAT.
        if (_lines.Any(line => DiscountOf(line) > _plan.PreTaxOutstandingOf(line, Before(line))))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.ReliefExceedsOutstanding);
        }
    }

    /// <summary>
    /// Takes <paramref name="voucher"/> on this đợt: the slip's voucher rules
    /// (branch, target services, exclusive, per-customer limit) and the
    /// voucher's own (published, dates, uses, minimum order) on what the lines
    /// it reaches still owe before VAT once this đợt's TN giảm is off — the
    /// owner's "Còn nợ" base, even when the customer pays only part. The
    /// discount is split evenly over those lines, the odd đồng on the last;
    /// what a line has no room for goes to the others.
    /// </summary>
    /// <param name="priorUses">This patient's other uses of the voucher, on slips and live receipts.</param>
    /// <param name="alongside">The other vouchers already on the slip and its live receipts.</param>
    /// <param name="held">The receipt already holds a use of it (a revise keeping its voucher): none is burnt again.</param>
    public PaymentVoucherUse UseVoucher(
        Voucher voucher,
        DateOnly onDate,
        int priorUses,
        IReadOnlyCollection<Voucher> alongside,
        IReadOnlyDictionary<Guid, Guid>? serviceGroups,
        bool held = false)
    {
        Check.NotNull(voucher, nameof(voucher));
        Check.NotNull(alongside, nameof(alongside));

        if (voucher.ClinicBranchId.HasValue && voucher.ClinicBranchId.Value != _plan.BranchId)
        {
            throw NotApplicable($"Voucher {voucher.Code} belongs to another branch.");
        }

        if (alongside.Count > 0 && (voucher.IsExclusive || alongside.Any(other => other.IsExclusive)))
        {
            throw NotApplicable("An exclusive voucher cannot be combined with another voucher.");
        }

        if (!held && voucher.PerCustomerLimit.HasValue && priorUses >= voucher.PerCustomerLimit.Value)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.VoucherPerCustomerLimitReached,
                $"This patient has already used voucher {voucher.Code} {voucher.PerCustomerLimit} time(s).");
        }

        var room = _lines
            .Where(line => voucher.ScopeTarget != VoucherScopeTarget.Service
                || TreatmentPlan.Targets(voucher, line, serviceGroups))
            .ToDictionary(
                line => line.Id,
                line => _plan.PreTaxOutstandingOf(line, Before(line).With(0m, DiscountOf(line), 0m)));
        var orderAmount = room.Values.Sum();
        if (orderAmount <= 0m)
        {
            throw NotApplicable($"Voucher {voucher.Code} reaches nothing this receipt still owes.");
        }

        var discount = held ? voucher.CalculateDiscount(orderAmount) : voucher.Redeem(onDate, orderAmount);
        foreach (var (lineId, share) in SplitEvenly(Math.Min(Vnd.Round(discount), orderAmount), room))
        {
            _voucherShares[lineId] = share;
        }

        return new PaymentVoucherUse(voucher.Id, voucher.Code);
    }

    /// <summary>The most each line may collect in this đợt, VAT included: its Còn nợ once this đợt's relief is off.</summary>
    public IReadOnlyDictionary<Guid, decimal> Caps() =>
        _lines.ToDictionary(
            line => line.Id,
            line => _plan.OutstandingOf(line, Before(line).With(0m, ReliefOf(line), 0m)));

    /// <summary>
    /// The receipt's lines once <paramref name="cash"/> is split over them, each
    /// with its VAT: a line let off without money stays at 0 đ, one with
    /// neither money nor relief is left out.
    /// </summary>
    public List<PaymentLineDraft> Drafts(IReadOnlyDictionary<Guid, decimal> cash) =>
        _lines
            .Select(line => Draft(line, cash.GetValueOrDefault(line.Id)))
            .Where(draft => draft.Amount > 0m || draft.Relief > 0m)
            .ToList();

    private PaymentLineDraft Draft(TreatmentService line, decimal amount)
    {
        var terms = _terms.GetValueOrDefault(line.Id);
        return new PaymentLineDraft(line.Id, amount)
        {
            ReceiptName = terms?.ReceiptName,
            CashierDiscount = DiscountOf(line),
            CashierDiscountReason = terms?.CashierDiscountReason,
            VoucherShare = _voucherShares.GetValueOrDefault(line.Id),
            TaxAmount = _plan.RoundTaxOf(line, Before(line), ReliefOf(line), amount)
        };
    }

    private LineSettlement Before(TreatmentService line) => _before.GetValueOrDefault(line.Id, LineSettlement.None);

    private decimal DiscountOf(TreatmentService line) => _terms.GetValueOrDefault(line.Id)?.CashierDiscount ?? 0m;

    private decimal ReliefOf(TreatmentService line) => DiscountOf(line) + _voucherShares.GetValueOrDefault(line.Id);

    /// <summary>
    /// <paramref name="amount"/> in equal whole-đồng shares, the odd đồng on the
    /// last line; a line full at its room passes the rest to the lines still
    /// open, round after round. The caller keeps <paramref name="amount"/>
    /// within the rooms' sum, so it is always spent.
    /// </summary>
    private static Dictionary<Guid, decimal> SplitEvenly(decimal amount, IReadOnlyDictionary<Guid, decimal> room)
    {
        var shares = room.Keys.ToDictionary(id => id, _ => 0m);
        var open = room.Where(pair => pair.Value > 0m).Select(pair => pair.Key).ToList();
        var left = amount;

        while (left > 0m && open.Count > 0)
        {
            var each = Math.Floor(left / open.Count);
            var odd = left - each * open.Count;
            foreach (var id in open)
            {
                var give = Math.Min(id == open[^1] ? each + odd : each, room[id] - shares[id]);
                shares[id] += give;
                left -= give;
            }

            open = open.Where(id => shares[id] < room[id]).ToList();
        }

        return shares;
    }

    private static BusinessException NotApplicable(string message) =>
        new(BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable, message);
}
