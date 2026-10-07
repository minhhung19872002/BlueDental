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
/// A movement with no slip is money held for the patient ("BE:PaymentKind:HeldForCustomer");
/// spending it later is a payment against a slip funded from that balance.
/// </summary>
public class PatientPayment : FullAuditedAggregateRoot<Guid>, ISettleable
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

    public const int MaxCancelReasonLength = 500;

    /// <summary>
    /// Why the receipt was cancelled. A cancelled receipt is soft-deleted — so
    /// no rollup, debt or report counts it — and keeps who cancelled it and
    /// when in <c>DeleterId</c> / <c>DeletionTime</c>; the Thanh toán tab still
    /// lists it as "Đã hủy" (bug list item 28).
    /// </summary>
    public string? CancelReason { get; private set; }

    /// <summary>
    /// "Chưa thanh toán" until the cashier confirms the money was taken, then
    /// "Hoàn tất". Only a payment waits; a refund or money held for the patient
    /// is written already settled. See <see cref="ISettleable"/>.
    /// </summary>
    public PatientPaymentStatus Status { get; private set; } = PatientPaymentStatus.Completed;

    public bool IsPending => Status == PatientPaymentStatus.Pending;

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
        Func<Guid>? lineIdFactory = null,
        PatientPaymentStatus status = PatientPaymentStatus.Completed)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));

        if (status == PatientPaymentStatus.Pending && kind != PatientPaymentKind.Payment)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition,
                "Only a payment waits for confirmation; refunds and held money are settled when written.");
        }

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
        EnsureAccount(kind, method, paymentAccountId);

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
            SplitMode = splitMode,
            Status = status
        };

        payment.ReplaceLines(lines, lineIdFactory);
        return payment;
    }

    private void ReplaceLines(
        IEnumerable<(Guid TreatmentServiceId, decimal Amount)>? lines, Func<Guid>? lineIdFactory)
    {
        _lines.Clear();
        foreach (var (serviceId, share) in lines ?? [])
        {
            _lines.Add(new PatientPaymentLine(lineIdFactory?.Invoke() ?? Guid.NewGuid(), serviceId, share));
        }

        // The lines are how the receipt is spent; letting them disagree with the
        // total would make every per-line "BE:PaymentKind:StillOwed" a lie.
        if (_lines.Count > 0 && _lines.Sum(line => line.Amount) != Amount)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "The receipt's service lines must add up to its total.");
        }
    }

    private static void EnsureAccount(PatientPaymentKind kind, PaymentMethodKind method, Guid? paymentAccountId)
    {
        if (kind != PatientPaymentKind.Refund && RequiresAccount(method) && !paymentAccountId.HasValue)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.PaymentAccountRequired,
                "A bank or e-wallet payment must name the account it was collected into.");
        }
    }

    private void EnsurePending()
    {
        if (!IsPending)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCompleted,
                "A completed receipt is final.");
        }
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

    /// <summary>
    /// What each service line of this receipt was paid. One receipt covers
    /// several services, the way the reference's dialog collects them.
    /// </summary>
    public IReadOnlyCollection<PatientPaymentLine> Lines => _lines.AsReadOnly();

    /// <summary>Ngân hàng and Ví momo collect into a named account; the rest do not.</summary>
    public static bool RequiresAccount(PaymentMethodKind method) =>
        method is PaymentMethodKind.Banking or PaymentMethodKind.EWallet;

    /// <summary>
    /// Voucher code in the reference's own shape: payment
    /// <c>THANHTOAN-31/DT32/2026</c>, refund <c>HOANTIEN-02/2026</c>. The middle
    /// part of a payment code is the slip's own code, not a second counter:
    /// staging (2026-09-22) paid patient HN8521's slip "DT32 - Test DV" as
    /// THANHTOAN-31/DT32/2026 and its next slip DT33 as THANHTOAN-34/DT33/2026.
    /// A top-up held for the patient outside any slip never appeared on the
    /// reference (its "BE:Field:DepositIncurred" rows all sit on a slip), so
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
    /// Money is collected today or was collected before: a receipt dated
    /// 28/10 typed in on 07/10 is refused (bug list item 26). Compared by the
    /// clinic's calendar day, so any time later today is still today.
    /// </summary>
    public static void EnsureNotAfterToday(DateTimeOffset paidAt, DateTimeOffset now)
    {
        if (ClinicCalendar.DateOf(paidAt) > ClinicCalendar.DateOf(now))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.PaymentDateInFuture,
                "A receipt cannot be dated after today.");
        }
    }

    /// <summary>
    /// Records why the receipt is being cancelled; the caller then soft-deletes
    /// it. A receipt with no reason is not cancelled (bug list item 28: one
    /// vanished from the list with no reason and no trace).
    /// </summary>
    public PatientPayment Cancel(string? reason)
    {
        // BA 2026-10-08: a "Hoàn tất" receipt hides Sửa and Xoá — the money was taken.
        EnsurePending();

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.PaymentCancelReasonRequired,
                "A receipt is cancelled with a reason.");
        }

        CancelReason = Check.Length(reason.Trim(), nameof(reason), MaxCancelReasonLength);
        return this;
    }

    /// <summary>
    /// "Chỉnh sửa" on a receipt still "Chưa thanh toán": nothing has been
    /// collected, so everything the create dialog asked can be rewritten — the
    /// split, the amount and its service lines, the channel and the note. The
    /// caller re-checks each line against what the slip still owes.
    /// </summary>
    public PatientPayment Revise(
        PaymentSplitMode splitMode,
        PaymentMethodKind method,
        decimal amount,
        Guid? paymentAccountId,
        string? note,
        IEnumerable<(Guid TreatmentServiceId, decimal Amount)> lines,
        Func<Guid> lineIdFactory)
    {
        EnsurePending();

        if (amount <= 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InsufficientPaymentAmount,
                "A money movement must be greater than zero.");
        }

        EnsureAccount(Kind, method, paymentAccountId);

        SplitMode = splitMode;
        Method = method;
        Amount = amount;
        PaymentAccountId = RequiresAccount(method) ? paymentAccountId : null;
        Note = note;
        ReplaceLines(lines, lineIdFactory);
        return this;
    }

    /// <summary>
    /// "Xác nhận thanh toán": the money is in. From here the receipt counts
    /// everywhere and is dated by when it was collected — revenue is reported
    /// by this day, while <c>CreationTime</c> keeps when it was written.
    /// </summary>
    public PatientPayment Confirm(DateTimeOffset collectedAt, Guid cashierId)
    {
        EnsurePending();

        Status = PatientPaymentStatus.Completed;
        PaidAt = collectedAt;
        StaffId = cashierId;
        return this;
    }
}
