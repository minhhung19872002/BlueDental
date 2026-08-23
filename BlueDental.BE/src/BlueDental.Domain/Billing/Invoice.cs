using System;
using BlueDental.Billing.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Billing;

/// <summary>
/// Billing invoice aggregate root.
/// Lifecycle: Draft → Issued → PartiallyPaid → Paid / Overdue / Voided / Refunded.
/// </summary>
public class Invoice : FullAuditedAggregateRoot<Guid>
{
    public string InvoiceNumber { get; private set; } = default!;
    public Guid PatientId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid? AppointmentId { get; private set; }
    public Money SubTotal { get; private set; } = default!;
    public Money TaxAmount { get; private set; } = default!;
    public Money DiscountAmount { get; private set; } = default!;
    public Money TotalAmount { get; private set; } = default!;
    public Money PaidAmount { get; private set; } = default!;
    public Money BalanceDue => TotalAmount.Subtract(PaidAmount);
    public InvoiceStatus Status { get; private set; }
    public DateTimeOffset IssuedAt { get; private set; }
    public DateTimeOffset DueAt { get; private set; }
    public string? Notes { get; private set; }

    protected Invoice() { }

    public Invoice(
        Guid id,
        string invoiceNumber,
        Guid patientId,
        Guid branchId,
        Money subTotal,
        Money taxAmount,
        Money discountAmount,
        DateTimeOffset dueAt,
        Guid? appointmentId = null,
        DateTimeOffset? issuedAt = null)
        : base(id)
    {
        InvoiceNumber = invoiceNumber;
        PatientId = patientId;
        BranchId = branchId;
        AppointmentId = appointmentId;
        SubTotal = subTotal;
        TaxAmount = taxAmount;
        DiscountAmount = discountAmount;
        TotalAmount = subTotal.Add(taxAmount).Subtract(discountAmount);
        PaidAmount = Money.Zero(subTotal.Currency);
        DueAt = dueAt;
        Status = InvoiceStatus.Draft;
        // Billing often runs after the fact, so a visit's own date can be given.
        IssuedAt = issuedAt ?? DateTimeOffset.UtcNow;
    }

    public Invoice Issue()
    {
        EnsureStatus(InvoiceStatus.Draft, nameof(Issue));
        Status = InvoiceStatus.Issued;
        return this;
    }

    public Invoice RecordPayment(Money payment, PaymentMethod method)
    {
        if (Status is InvoiceStatus.Voided or InvoiceStatus.Refunded)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition,
                $"Cannot record payment on invoice with status {Status}.");
        }

        PaidAmount = PaidAmount.Add(payment);

        Status = PaidAmount.Amount >= TotalAmount.Amount
            ? InvoiceStatus.Paid
            : InvoiceStatus.PartiallyPaid;

        return this;
    }

    public Invoice MarkOverdue()
    {
        if (Status is InvoiceStatus.Issued or InvoiceStatus.PartiallyPaid)
        {
            Status = InvoiceStatus.Overdue;
        }

        return this;
    }

    public Invoice Void(string? reason = null)
    {
        if (Status == InvoiceStatus.Paid)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvoiceAlreadyPaid,
                "Cannot void an already paid invoice. Consider issuing a refund.");
        }

        Status = InvoiceStatus.Voided;
        Notes = reason;
        return this;
    }

    private void EnsureStatus(InvoiceStatus expected, string operation)
    {
        if (Status != expected)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition,
                $"Cannot perform '{operation}' on invoice with status '{Status}'. Expected '{expected}'.");
        }
    }
}
