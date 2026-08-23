using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Billing;

/// <summary>
/// One money movement on a patient's account (Thanh toán / Hoàn tiền / Giữ hộ).
///
/// The reference splits every figure of its payment rollup by
/// <c>cash | banking | card | outstandingDebt</c> and reports
/// <c>totalPaid</c>, <c>totalRefund</c> and <c>totalPrepaid</c> separately, so one
/// row here carries a kind, a method and an amount — the rollup is derived, never
/// stored.
///
/// A movement with no slip is money held for the patient ("Đang Giữ Hộ Khách");
/// spending it later is a payment against a slip funded from that balance.
/// </summary>
public class PatientPayment : FullAuditedAggregateRoot<Guid>
{
    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Slip this money is for. Null means it is held for the patient.</summary>
    public Guid? TreatmentPlanId { get; private set; }

    /// <summary>Service line this money is for, when the clinic collects per line.</summary>
    public Guid? TreatmentServiceId { get; private set; }

    public PatientPaymentKind Kind { get; private set; }

    public PaymentMethodKind Method { get; private set; }

    /// <summary>Always positive; the direction lives in <see cref="Kind"/>.</summary>
    public decimal Amount { get; private set; }

    /// <summary>Receipt number shown in the UI.</summary>
    public string Code { get; private set; } = string.Empty;

    public DateTimeOffset PaidAt { get; private set; }

    /// <summary>Cashier.</summary>
    public Guid StaffId { get; private set; }

    public string? Note { get; private set; }

    /// <summary>Signed value for a rollup: a refund takes money back out.</summary>
    public decimal SignedAmount => Kind == PatientPaymentKind.Refund ? -Amount : Amount;

    protected PatientPayment() { }

    public static PatientPayment Record(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        PatientPaymentKind kind,
        PaymentMethodKind method,
        decimal amount,
        string code,
        Guid staffId,
        DateTimeOffset paidAt,
        Guid? treatmentPlanId = null,
        Guid? treatmentServiceId = null,
        string? note = null)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));

        if (amount <= 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InsufficientPaymentAmount,
                "A money movement must be greater than zero.");
        }

        if (kind == PatientPaymentKind.Prepaid && treatmentPlanId.HasValue)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition,
                "Money held for a patient cannot belong to a slip; spend it with a payment instead.");
        }

        if (kind != PatientPaymentKind.Prepaid && !treatmentPlanId.HasValue)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition,
                "A payment or refund must name the slip it belongs to.");
        }

        return new PatientPayment
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            TreatmentPlanId = treatmentPlanId,
            TreatmentServiceId = treatmentServiceId,
            Kind = kind,
            Method = method,
            Amount = amount,
            Code = code,
            StaffId = staffId,
            PaidAt = paidAt,
            Note = note
        };
    }

    public PatientPayment UpdateNote(string? note)
    {
        Note = note;
        return this;
    }
}
