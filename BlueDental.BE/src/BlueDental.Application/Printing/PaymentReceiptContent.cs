using System;
using System.Collections.Generic;
using System.Globalization;
using BlueDental.EInvoicing;

namespace BlueDental.Printing;

/// <summary>
/// What goes into the PHIẾU THU placeholders. Kept apart from the app service
/// so the money rules sit in one place: the BA has yet to settle how the
/// remaining amount carries over split payments (docs/clone/unknowns.md).
/// </summary>
public sealed record PaymentReceiptContent(
    string CustomerName,
    string TreatmentWork,
    decimal PaidAmount,
    decimal SlipTotal,
    string PayerName,
    DateOnly IssueDate,
    string CashierName)
{
    /// <summary>Vietnamese grouping without relying on the host's ICU data (the image may run invariant).</summary>
    private static readonly NumberFormatInfo Grouping = new() { NumberGroupSeparator = ".", NumberDecimalSeparator = "," };

    /// <summary>
    /// Số tiền còn lại = Tổng phiếu điều trị − Thanh toán (BA, 2026-10-07).
    /// Provisional: right for the first receipt of a slip only, until the BA
    /// says how earlier receipts count.
    /// </summary>
    public decimal RemainingAmount => Math.Max(0m, SlipTotal - PaidAmount);

    public IReadOnlyDictionary<string, string> ToPlaceholders() => new Dictionary<string, string>
    {
        ["CustomerName"] = CustomerName,
        ["TreatmentWork"] = TreatmentWork,
        ["PaidAmount"] = Money(PaidAmount),
        ["PaidAmountInWords"] = VietnameseAmountWords.Spell(PaidAmount),
        ["RemainingAmount"] = Money(RemainingAmount),
        ["RemainingAmountInWords"] = VietnameseAmountWords.Spell(RemainingAmount),
        ["PayerName"] = PayerName,
        ["IssueDate"] = IssueDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
        ["CashierName"] = CashierName
    };

    /// <summary>"15.000.000 đ" — VND has no minor unit, so whole đồng.</summary>
    public static string Money(decimal amount) =>
        decimal.Round(amount, 0, MidpointRounding.AwayFromZero).ToString("#,##0", Grouping) + " đ";
}
