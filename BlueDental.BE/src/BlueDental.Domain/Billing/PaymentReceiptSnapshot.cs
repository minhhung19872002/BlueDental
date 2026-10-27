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

    /// <summary>The slip's payable total, VAT included.</summary>
    public decimal SlipTotal { get; private set; }

    /// <summary>Net money the slip had collected ("Đã thanh toán" only) when this was written.</summary>
    public decimal PaidBefore { get; private set; }

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
        IEnumerable<PaymentReceiptSnapshotLine> lines)
    {
        Check.NotNullOrWhiteSpace(planCode, nameof(planCode));

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
            Remaining = remaining,
            RemainingInWords = VietnameseAmountWords.Spell(remaining),
            CreatorName = creatorName
        };
        snapshot._lines.AddRange(lines.ToList());
        return snapshot;
    }
}

public class PaymentReceiptSnapshotLine
{
    public string Name { get; private set; } = string.Empty;

    public decimal Amount { get; private set; }

    protected PaymentReceiptSnapshotLine() { }

    public PaymentReceiptSnapshotLine(string name, decimal amount)
    {
        Name = Check.NotNullOrWhiteSpace(name, nameof(name));
        Amount = amount;
    }
}
