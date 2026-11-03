using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.EInvoicing;
using Volo.Abp;

namespace BlueDental.Billing;

/// <summary>
/// What the PHIẾU THU of a payment says, frozen when the receipt is written
/// (P2610 phase 3). The receipt page, and later the iPad and the exported PDF,
/// read this rather than today's catalog, patient and staff names, so renaming
/// any of them never rewrites a receipt the customer has seen or signed. It is
/// retaken on every revise while the receipt is still "Chưa thanh toán" and is
/// fixed from the export on.
/// </summary>
public class PaymentReceiptSnapshot
{
    private readonly List<PaymentReceiptSnapshotLine> _lines = new();

    public string PatientCode { get; private set; } = string.Empty;

    /// <summary>Người nộp tiền — the patient; the BA has named no other payer.</summary>
    public string PayerName { get; private set; } = string.Empty;

    /// <summary>The slip, for "Thanh toán điều trị ngày dd/MM/yyyy (DTxx)".</summary>
    public string PlanCode { get; private set; } = string.Empty;

    /// <summary>Ngày thanh toán picked on the dialog, the day "Lý do nộp" names.</summary>
    public DateOnly PaidOn { get; private set; }

    public PaymentMethodKind Method { get; private set; }

    public decimal Amount { get; private set; }

    public string AmountInWords { get; private set; } = string.Empty;

    /// <summary>
    /// The slip's payable total, VAT included — from P2910 once the relief of
    /// its paid receipts and of this one is off, with the VAT re-figured on
    /// what is left, so <see cref="Remaining"/> reads straight off it.
    /// </summary>
    public decimal SlipTotal { get; private set; }

    /// <summary>Net money the slip had collected ("Đã thanh toán" only) when this was written.</summary>
    public decimal PaidBefore { get; private set; }

    /// <summary>
    /// Ưu đãi đã dùng: TN giảm and payment-time vouchers of the slip's earlier
    /// paid receipts (P2910). Null on a sheet frozen before P2910.
    /// </summary>
    public decimal? ReliefBefore { get; private set; }

    /// <summary>What this receipt lets off without money — its TN giảm and voucher. Null before P2910.</summary>
    public decimal? Relief { get; private set; }

    /// <summary>The voucher this receipt is written with, as printed.</summary>
    public string? VoucherCode { get; private set; }

    /// <summary>Số tiền còn lại: what the slip still owes once this receipt is paid.</summary>
    public decimal Remaining { get; private set; }

    public string RemainingInWords { get; private set; } = string.Empty;

    /// <summary>Kế toán / Người lập phiếu — whoever wrote the receipt.</summary>
    public string CreatorName { get; private set; } = string.Empty;

    /// <summary>Each service this receipt pays, with its share, in slip order.</summary>
    public IReadOnlyCollection<PaymentReceiptSnapshotLine> Lines => _lines.AsReadOnly();

    protected PaymentReceiptSnapshot() { }

    public static PaymentReceiptSnapshot Take(
        string patientCode,
        string payerName,
        string planCode,
        DateOnly paidOn,
        PaymentMethodKind method,
        decimal amount,
        decimal slipTotal,
        decimal paidBefore,
        string creatorName,
        IEnumerable<PaymentReceiptSnapshotLine> lines,
        decimal reliefBefore = 0m,
        string? voucherCode = null)
    {
        Check.NotNullOrWhiteSpace(planCode, nameof(planCode));

        var lineList = lines.ToList();
        var relief = lineList.Sum(line => line.Relief);
        var remaining = Math.Max(0m, slipTotal - paidBefore - amount);
        var snapshot = new PaymentReceiptSnapshot
        {
            PatientCode = patientCode,
            PayerName = payerName,
            PlanCode = planCode,
            PaidOn = paidOn,
            Method = method,
            Amount = amount,
            AmountInWords = VietnameseAmountWords.Spell(amount),
            SlipTotal = slipTotal,
            PaidBefore = paidBefore,
            ReliefBefore = reliefBefore,
            Relief = relief,
            VoucherCode = voucherCode,
            Remaining = remaining,
            RemainingInWords = VietnameseAmountWords.Spell(remaining),
            CreatorName = creatorName
        };
        snapshot._lines.AddRange(lineList);
        return snapshot;
    }
}

public class PaymentReceiptSnapshotLine
{
    /// <summary>The name the receipt prints: the cashier's "Tên trên phiếu", else the catalog's.</summary>
    public string Name { get; private set; } = string.Empty;

    public decimal Amount { get; private set; }

    /// <summary>TN giảm on this line. Null on a sheet frozen before P2910 — read as none.</summary>
    public decimal? CashierDiscount { get; private set; }

    /// <summary>This line's part of the receipt's voucher. Null before P2910.</summary>
    public decimal? VoucherShare { get; private set; }

    /// <summary>"Trong đó VAT" — the VAT inside <see cref="Amount"/>. Null before P2910.</summary>
    public decimal? TaxAmount { get; private set; }

    public decimal Relief => (CashierDiscount ?? 0m) + (VoucherShare ?? 0m);

    protected PaymentReceiptSnapshotLine() { }

    public PaymentReceiptSnapshotLine(
        string name, decimal amount, decimal cashierDiscount = 0m, decimal voucherShare = 0m, decimal taxAmount = 0m)
    {
        Name = Check.NotNullOrWhiteSpace(name, nameof(name));
        Amount = amount;
        CashierDiscount = cashierDiscount;
        VoucherShare = voucherShare;
        TaxAmount = taxAmount;
    }
}
