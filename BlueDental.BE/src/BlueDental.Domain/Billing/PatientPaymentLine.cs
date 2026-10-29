using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Billing;

/// <summary>
/// One service line's share of a receipt.
///
/// The reference collects money as a single "phiếu thanh toán" naming every
/// service it covers (<c>treatmentServiceIds[]</c>), and — when the cashier
/// splits by hand — how much of the total goes to each (<c>items[]</c>). A
/// receipt therefore has lines rather than one service of its own.
///
/// Besides the money (<see cref="Amount"/>) a line may carry what the receipt
/// lets off the line's debt without money changing hands (P2910): the
/// cashier's own discount and its share of a voucher picked at payment time.
/// Both count only once the receipt is "Đã thanh toán", like the money.
/// </summary>
public class PatientPaymentLine : Entity<Guid>
{
    public const int MaxReceiptNameLength = 200;

    public const int MaxCashierDiscountReasonLength = 500;

    /// <summary>Set by EF from the receipt's collection.</summary>
    public Guid PatientPaymentId { get; private set; }

    public Guid TreatmentServiceId { get; private set; }

    /// <summary>
    /// The money this line takes of the receipt total. Zero only on a line the
    /// receipt settles wholly by <see cref="Relief"/>.
    /// </summary>
    public decimal Amount { get; private set; }

    /// <summary>
    /// "Tên dịch vụ" as the PHIẾU THU prints it — free text the cashier typed;
    /// null prints the catalog name. Display only (owner 2026-10-29).
    /// </summary>
    public string? ReceiptName { get; private set; }

    /// <summary>"Giảm giá thu ngân" (TN giảm) — let off this line's debt, in đồng.</summary>
    public decimal CashierDiscount { get; private set; }

    /// <summary>Why the cashier let it off; optional, read by the accountant.</summary>
    public string? CashierDiscountReason { get; private set; }

    /// <summary>This line's part of the receipt's voucher.</summary>
    public decimal VoucherShare { get; private set; }

    /// <summary>
    /// The VAT inside <see cref="Amount"/> for this đợt (P2910): backed out of
    /// the money, except on the đợt that clears the line, which takes whatever
    /// of the line's VAT the earlier đợt left — so the đợt add up to the VAT
    /// of the line after relief. Null on a line written before P2910 or moved
    /// by "Chuyển đổi dịch vụ"; readers then back it out of the money.
    /// </summary>
    public decimal? TaxAmount { get; private set; }

    /// <summary>What the line is let off without money: TN giảm plus its voucher share.</summary>
    public decimal Relief => CashierDiscount + VoucherShare;

    /// <summary>Money and relief together — how far the receipt brings the line's debt down.</summary>
    public decimal Settled => Amount + Relief;

    protected PatientPaymentLine() { }

    internal PatientPaymentLine(Guid id, Guid treatmentServiceId, decimal amount)
        : this(id, new PaymentLineDraft(treatmentServiceId, amount))
    {
    }

    internal PatientPaymentLine(Guid id, PaymentLineDraft draft)
        : base(id)
    {
        if (draft.TreatmentServiceId == Guid.Empty)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "A receipt line must name the service it pays for.");
        }

        if (draft.Amount < 0m || draft.CashierDiscount < 0m || draft.VoucherShare < 0m
            || draft.Amount + draft.CashierDiscount + draft.VoucherShare <= 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "A receipt line must be greater than zero.");
        }

        if (draft.TaxAmount is { } tax && (tax < 0m || tax > draft.Amount))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "A line's VAT is part of its money.");
        }

        TreatmentServiceId = draft.TreatmentServiceId;
        Amount = draft.Amount;
        ReceiptName = Trimmed(draft.ReceiptName, nameof(draft.ReceiptName), MaxReceiptNameLength);
        CashierDiscount = draft.CashierDiscount;
        // A reason with nothing let off would print under a line that has no discount.
        CashierDiscountReason = draft.CashierDiscount > 0m
            ? Trimmed(draft.CashierDiscountReason, nameof(draft.CashierDiscountReason), MaxCashierDiscountReasonLength)
            : null;
        VoucherShare = draft.VoucherShare;
        TaxAmount = draft.TaxAmount;
    }

    /// <summary>Keeps the other parts and gives the line a new service — "Chuyển đổi dịch vụ".</summary>
    internal PaymentLineDraft ToDraft() =>
        new(TreatmentServiceId, Amount)
        {
            ReceiptName = ReceiptName,
            CashierDiscount = CashierDiscount,
            CashierDiscountReason = CashierDiscountReason,
            VoucherShare = VoucherShare,
            TaxAmount = TaxAmount
        };

    private static string? Trimmed(string? value, string name, int maxLength) =>
        string.IsNullOrWhiteSpace(value) ? null : Check.Length(value.Trim(), name, maxLength);
}

/// <summary>
/// What one line of a receipt is to carry: its money and, from P2910, its
/// printed name, the cashier's discount and its voucher share.
/// </summary>
public sealed record PaymentLineDraft(Guid TreatmentServiceId, decimal Amount)
{
    public string? ReceiptName { get; init; }

    public decimal CashierDiscount { get; init; }

    public string? CashierDiscountReason { get; init; }

    public decimal VoucherShare { get; init; }

    /// <summary>The VAT inside <see cref="Amount"/>; null = back it out when read.</summary>
    public decimal? TaxAmount { get; init; }

    public decimal Relief => CashierDiscount + VoucherShare;

    public static implicit operator PaymentLineDraft((Guid TreatmentServiceId, decimal Amount) line) =>
        new(line.TreatmentServiceId, line.Amount);
}
