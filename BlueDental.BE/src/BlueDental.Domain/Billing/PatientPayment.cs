using System;
using System.Collections.Generic;
using System.Linq;
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
    private readonly List<PatientPaymentLine> _lines = new();

    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Slip this money is for. Null means it is held for the patient.</summary>
    public Guid? TreatmentPlanId { get; private set; }

    /// <summary>
    /// Chia Tiền Tự Động / Thủ Công — how <see cref="Lines"/> was arrived at.
    /// Kept so reopening a receipt shows the mode it was written in.
    /// </summary>
    public PaymentSplitMode SplitMode { get; private set; }

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

    /// <summary>
    /// Tài khoản nhận tiền — which of the clinic's MoMo wallets or bank
    /// accounts the money went into. The reference makes this mandatory for
    /// those two methods and leaves it off cash, card and Dư nợ.
    /// </summary>
    public Guid? PaymentAccountId { get; private set; }

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
        string? note = null,
        Guid? paymentAccountId = null,
        PaymentSplitMode splitMode = PaymentSplitMode.Auto,
        IEnumerable<(Guid TreatmentServiceId, decimal Amount)>? lines = null,
        Func<Guid>? lineIdFactory = null)
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

        // The reference's dialog will not save a bank or e-wallet payment until
        // one of the clinic's accounts is picked, so the record keeps that rule.
        // A refund goes the other way — its dialog only names the channel.
        if (kind != PatientPaymentKind.Refund && RequiresAccount(method) && !paymentAccountId.HasValue)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.PaymentAccountRequired,
                "A bank or e-wallet payment must name the account it was collected into.");
        }

        var payment = new PatientPayment
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            TreatmentPlanId = treatmentPlanId,
            Kind = kind,
            Method = method,
            Amount = amount,
            Code = code,
            StaffId = staffId,
            PaidAt = paidAt,
            Note = note,
            PaymentAccountId = RequiresAccount(method) ? paymentAccountId : null,
            SplitMode = splitMode
        };

        foreach (var (serviceId, share) in lines ?? [])
        {
            payment._lines.Add(
                new PatientPaymentLine(lineIdFactory?.Invoke() ?? Guid.NewGuid(), serviceId, share));
        }

        // The lines are how the receipt is spent; letting them disagree with the
        // total would make every per-line "Còn nợ" a lie.
        if (payment._lines.Count > 0 && payment._lines.Sum(line => line.Amount) != amount)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "The receipt's service lines must add up to its total.");
        }

        return payment;
    }

    /// <summary>
    /// Moves this receipt's share of one service onto another, up to
    /// <paramref name="limit"/> — what "Chuyển đổi dịch vụ" does with money
    /// already collected. Returns how much actually moved.
    ///
    /// The receipt's own total never changes: a share too big for the new line
    /// is split, and the remainder stays on the old one for the caller to
    /// refund or leave as credit.
    /// </summary>
    public decimal Redirect(
        Guid fromServiceId, Guid toServiceId, decimal limit, Func<Guid> lineIdFactory)
    {
        if (limit <= 0m)
        {
            return 0m;
        }

        var moved = 0m;
        foreach (var line in _lines.Where(l => l.TreatmentServiceId == fromServiceId).ToList())
        {
            var take = Math.Min(line.Amount, limit - moved);
            if (take <= 0m)
            {
                break;
            }

            _lines.Remove(line);
            _lines.Add(new PatientPaymentLine(lineIdFactory(), toServiceId, take));

            if (take < line.Amount)
            {
                _lines.Add(
                    new PatientPaymentLine(lineIdFactory(), fromServiceId, line.Amount - take));
            }

            moved += take;
        }

        return moved;
    }

    /// <summary>What this receipt put against one service line.</summary>
    public decimal AmountFor(Guid treatmentServiceId) =>
        _lines.Where(line => line.TreatmentServiceId == treatmentServiceId).Sum(line => line.Amount);

    /// <summary>Ngân hàng and Ví momo collect into a named account; the rest do not.</summary>
    /// <summary>
    /// What each service line of this receipt was paid. One receipt covers
    /// several services, the way the reference's dialog collects them.
    /// </summary>
    public IReadOnlyCollection<PatientPaymentLine> Lines => _lines.AsReadOnly();

    public static bool RequiresAccount(PaymentMethodKind method) =>
        method is PaymentMethodKind.Banking or PaymentMethodKind.EWallet;

    /// <summary>
    /// Voucher code in the reference's own shape: payment
    /// <c>THANHTOAN-31/DT32/2026</c>, refund <c>HOANTIEN-02/2026</c>. The middle
    /// part of a payment code is the slip's own code, not a second counter:
    /// staging (2026-09-22) paid patient HN8521's slip "DT32 - Test DV" as
    /// THANHTOAN-31/DT32/2026 and its next slip DT33 as THANHTOAN-34/DT33/2026.
    /// A top-up held for the patient outside any slip never appeared on the
    /// reference (its "Tạm ứng phát sinh" rows all sit on a slip), so
    /// <c>TAMUNG-NN/yyyy</c> follows the refund pattern (UNKNOWN_REFERENCE_BEHAVIOR).
    /// </summary>
    public static string FormatCode(PatientPaymentKind kind, int sequence, int year, string? planCode = null)
    {
        if (kind == PatientPaymentKind.Payment)
        {
            Check.NotNullOrWhiteSpace(planCode, nameof(planCode));
            return $"THANHTOAN-{sequence:D2}/{planCode}/{year}";
        }

        return kind == PatientPaymentKind.Refund
            ? $"HOANTIEN-{sequence:D2}/{year}"
            : $"TAMUNG-{sequence:D2}/{year}";
    }

    public PatientPayment UpdateNote(string? note)
    {
        Note = note;
        return this;
    }

    /// <summary>
    /// "Chỉnh sửa" on a receipt: the facts about how the money was taken, not
    /// how much. The amount and the service lines stay put — they are what the
    /// slip's rollup and every per-line "Còn nợ" are built from, so correcting
    /// them means voiding the receipt and writing a new one.
    /// </summary>
    public PatientPayment Revise(
        PaymentMethodKind method,
        Guid? paymentAccountId,
        DateTimeOffset paidAt,
        string? note)
    {
        if (Kind != PatientPaymentKind.Refund && RequiresAccount(method) && !paymentAccountId.HasValue)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.PaymentAccountRequired,
                "A bank or e-wallet payment must name the account it was collected into.");
        }

        Method = method;
        PaymentAccountId = RequiresAccount(method) ? paymentAccountId : null;
        PaidAt = paidAt;
        Note = note;
        return this;
    }
}
