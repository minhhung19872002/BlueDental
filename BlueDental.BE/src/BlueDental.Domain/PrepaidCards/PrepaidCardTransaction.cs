using System;
using BlueDental.Billing;
using Volo.Abp.Domain.Entities;

namespace BlueDental.PrepaidCards;

/// <summary>
/// One line of a card's ledger — "ghi nhận tình trạng sử dụng thẻ" (cụm 3 mục 2).
/// Written only by <see cref="PrepaidCard"/>; never edited afterwards, so the
/// ledger always explains the balance.
/// </summary>
public class PrepaidCardTransaction : Entity<Guid>
{
    /// <summary>Set by EF from the card's collection.</summary>
    public Guid PrepaidCardId { get; private set; }

    /// <summary>1, 2, 3… in the order the card's lines were written.</summary>
    public int Sequence { get; private set; }

    public PrepaidCardTransactionType Type { get; private set; }

    /// <summary>Usage value moved, always positive; the direction lives in <see cref="Type"/>.</summary>
    public decimal Value { get; private set; }

    /// <summary>Money the customer handed over — only on Phát hành and Nạp thêm.</summary>
    public decimal PaidAmount { get; private set; }

    /// <summary>How that money was taken — only on Phát hành and Nạp thêm.</summary>
    public PaymentMethodKind? Method { get; private set; }

    public Guid? PaymentAccountId { get; private set; }

    /// <summary>Who spent the card (owner or family member) — only on Sử dụng / Hoàn lại.</summary>
    public Guid? PatientId { get; private set; }

    /// <summary>The receipt the card paid — only on Sử dụng / Hoàn lại.</summary>
    public Guid? PatientPaymentId { get; private set; }

    public Guid? StaffId { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    public string? Note { get; private set; }

    /// <summary>Signed effect on the balance.</summary>
    public decimal SignedValue => Type == PrepaidCardTransactionType.Use ? -Value : Value;

    protected PrepaidCardTransaction() { }

    internal PrepaidCardTransaction(
        Guid id,
        int sequence,
        PrepaidCardTransactionType type,
        decimal value,
        DateTimeOffset occurredAt,
        Guid? staffId,
        string? note,
        decimal paidAmount = 0m,
        PaymentMethodKind? method = null,
        Guid? paymentAccountId = null,
        Guid? patientId = null,
        Guid? patientPaymentId = null) : base(id)
    {
        Sequence = sequence;
        Type = type;
        Value = value;
        OccurredAt = occurredAt;
        StaffId = staffId;
        Note = note;
        PaidAmount = paidAmount;
        Method = method;
        PaymentAccountId = paymentAccountId;
        PatientId = patientId;
        PatientPaymentId = patientPaymentId;
    }
}
