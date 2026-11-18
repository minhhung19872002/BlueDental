using System;

namespace BlueDental.EInvoicing;

/// <summary>
/// One time an e-invoice went to EasyInvoice under its own key (BA
/// 2026-11-18: "một request" keeps every re-issue for tracking). Round 1 is
/// the first Lưu; an invoice cancelled on the provider goes out again as the
/// next round, under a new key, and the cancelled round stays here.
/// Kept as jsonb on the invoice row.
/// </summary>
public class ElectronicInvoiceAttempt
{
    public int Round { get; private set; }
    public string Ikey { get; private set; } = string.Empty;
    public string Pattern { get; private set; } = string.Empty;
    public string? Serial { get; private set; }
    public ElectronicInvoiceStatus Status { get; private set; }

    /// <summary>Số hóa đơn, once signed.</summary>
    public string? No { get; private set; }

    public decimal Amount { get; private set; }

    /// <summary>The last Lưu of this round (a re-send while Chờ kiểm tra moves it).</summary>
    public DateTimeOffset SentAt { get; private set; }

    public DateTimeOffset? SignedAt { get; private set; }
    public DateTimeOffset? CancelledAt { get; private set; }

    /// <summary>The signed invoice's PDF in BlueDental's blob store.</summary>
    public string? PdfBlobName { get; private set; }

    protected ElectronicInvoiceAttempt() { }

    internal ElectronicInvoiceAttempt(int round, string ikey, string pattern, string? serial, decimal amount, DateTimeOffset sentAt)
    {
        Round = round;
        Ikey = ikey;
        Status = ElectronicInvoiceStatus.Draft;
        Resent(pattern, serial, amount, sentAt);
    }

    internal void Resent(string pattern, string? serial, decimal amount, DateTimeOffset sentAt)
    {
        Pattern = pattern;
        Serial = serial;
        Amount = amount;
        SentAt = sentAt;
    }

    internal void Heard(ElectronicInvoiceStatus status, string? no, DateTimeOffset at)
    {
        if (SignedAt == null && status is ElectronicInvoiceStatus.Published
                or ElectronicInvoiceStatus.Replaced or ElectronicInvoiceStatus.Adjusted)
        {
            SignedAt = at;
        }

        if (status == ElectronicInvoiceStatus.Cancelled && Status != ElectronicInvoiceStatus.Cancelled)
        {
            CancelledAt = at;
        }

        Status = status;
        No = no ?? No;
    }

    internal void AttachPdf(string blobName) => PdfBlobName = blobName;
}
