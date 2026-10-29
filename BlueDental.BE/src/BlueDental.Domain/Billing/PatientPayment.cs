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

    public const int MaxReceiptFileNameLength = 200;

    public const int ReceiptFileSha256Length = 64;

    /// <summary>
    /// Mô tả lý do hủy — what the canceller wrote. A cancelled receipt is
    /// "Phiếu bị hủy" and is also soft-deleted, so no rollup, debt or report
    /// counts it; the row itself stays (bug list item 28, P2610).
    /// </summary>
    public string? CancelReason { get; private set; }

    /// <summary>
    /// Which of the four fixed reasons; null on a receipt cancelled before the
    /// cancel page existed, or one cancelled while still "Chưa thanh toán".
    /// </summary>
    public PaymentCancelReason? CancelReasonCode { get; private set; }

    /// <summary>When it was cancelled — kept apart from when it was exported or paid.</summary>
    public DateTimeOffset? CancelledAt { get; private set; }

    public Guid? CancelledById { get; private set; }

    /// <summary>When the accountant exported it ("Đã xuất phiếu thu").</summary>
    public DateTimeOffset? IssuedAt { get; private set; }

    public Guid? IssuedById { get; private set; }

    /// <summary>Ký số or Không ký số, as the accountant chose on the export.</summary>
    public ReceiptSignMode? SignMode { get; private set; }

    /// <summary>
    /// The exported PHIẾU THU (PDF/A, AES-encrypted) in blob storage. Null on a
    /// receipt not yet exported, or exported before P2610 phase 5.
    /// </summary>
    public string? ReceiptFileName { get; private set; }

    /// <summary>SHA-256 (hex) of the PDF as exported, checked on every read.</summary>
    public string? ReceiptFileSha256 { get; private set; }

    public bool HasReceiptFile => ReceiptFileName != null;

    /// <summary>
    /// See <see cref="PatientPaymentStatus"/>. Only a payment goes through the
    /// signing flow; a refund or money held for the patient is written already
    /// settled. See <see cref="ISettleable"/>.
    /// </summary>
    public PatientPaymentStatus Status { get; private set; } = PatientPaymentStatus.Completed;

    public bool IsPending => Status == PatientPaymentStatus.Pending;

    public bool IsCompleted => Status == PatientPaymentStatus.Completed;

    /// <summary>
    /// The patient asked for a red (VAT) invoice when the receipt was written
    /// ("Xuất hóa đơn đỏ" on Tạo phiếu thanh toán). Only remembered here — the
    /// e-invoice itself is issued later from another screen (owner 2026-10-12).
    /// </summary>
    public bool RedInvoiceRequested { get; private set; }

    /// <summary>
    /// Moved in from the clinic's old system by the data migration (F-61).
    /// The money was taken years ago, so such a receipt never offers itself to
    /// "Yêu cầu xuất HĐ" — the old system dealt with its invoices.
    /// </summary>
    public bool IsImported { get; private set; }

    /// <summary>
    /// The PHIẾU THU content as written — see <see cref="PaymentReceiptSnapshot"/>.
    /// Null on refunds, held money and receipts written before P2610 phase 3.
    /// </summary>
    public PaymentReceiptSnapshot? ReceiptSnapshot { get; private set; }

    public const int MaxVoucherCodeLength = 64;

    /// <summary>
    /// The voucher picked at payment time (P2910) — one per receipt, its use
    /// held from the moment the receipt is written and given back when it is
    /// cancelled or the voucher is taken off. Not the slip's own vouchers.
    /// </summary>
    public Guid? VoucherId { get; private set; }

    /// <summary>The voucher's code as it was, so the receipt reads the same if the voucher is renamed.</summary>
    public string? VoucherCode { get; private set; }

    /// <summary>What the voucher took off, split over <see cref="Lines"/> as their <c>VoucherShare</c>.</summary>
    public decimal VoucherAmount { get; private set; }

    /// <summary>"Giảm giá thu ngân" over every line — kept here so a rollup needs no lines.</summary>
    public decimal CashierDiscountTotal { get; private set; }

    /// <summary>
    /// Ưu đãi khi thanh toán: what this receipt lets off the slip without money.
    /// Like <see cref="Amount"/> it counts only once the receipt is "Đã thanh toán".
    /// </summary>
    public decimal Relief => CashierDiscountTotal + VoucherAmount;

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
        IEnumerable<PaymentLineDraft>? lines = null,
        Func<Guid>? lineIdFactory = null,
        PatientPaymentStatus status = PatientPaymentStatus.Completed,
        PaymentVoucherUse? voucher = null)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));

        // Exported and cancelled are reached through Issue and Cancel, never written.
        if (status is not (PatientPaymentStatus.Pending or PatientPaymentStatus.Completed))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition,
                "A receipt is written unpaid or paid.");
        }

        if (status == PatientPaymentStatus.Pending && kind != PatientPaymentKind.Payment)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition,
                "Only a payment waits for confirmation; refunds and held money are settled when written.");
        }

        var drafts = (lines ?? []).ToList();
        EnsureAmount(kind, amount, drafts);

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

        payment.ReplaceLines(drafts, lineIdFactory, voucher);
        return payment;
    }

    /// <summary>
    /// A money movement is above zero — except a payment whose lines are let
    /// off wholly by TN giảm or a voucher (P2910), which may collect nothing.
    /// </summary>
    private static void EnsureAmount(
        PatientPaymentKind kind, decimal amount, IReadOnlyCollection<PaymentLineDraft> lines)
    {
        var relief = lines.Sum(line => line.Relief);
        if (relief > 0m && kind != PatientPaymentKind.Payment)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "Only a payment can let a line off without money.");
        }

        if (amount < 0m || (amount == 0m && relief <= 0m))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InsufficientPaymentAmount,
                "A money movement must be greater than zero.");
        }
    }

    private void ReplaceLines(
        IReadOnlyCollection<PaymentLineDraft> lines, Func<Guid>? lineIdFactory, PaymentVoucherUse? voucher)
    {
        if (lines.Select(line => line.TreatmentServiceId).Distinct().Count() != lines.Count
            && lines.Any(line => line.Relief > 0m || line.ReceiptName != null))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "A service is named once on a receipt that lets it off or renames it.");
        }

        var voucherAmount = lines.Sum(line => line.VoucherShare);
        if ((voucher is null) != (voucherAmount == 0m))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "A voucher share needs the voucher it comes from, and a voucher must take something off.");
        }

        _lines.Clear();
        foreach (var line in lines)
        {
            _lines.Add(new PatientPaymentLine(lineIdFactory?.Invoke() ?? Guid.NewGuid(), line));
        }

        // The lines are how the receipt is spent; letting them disagree with the
        // total would make every per-line "BE:PaymentKind:StillOwed" a lie.
        if (_lines.Count > 0 && _lines.Sum(line => line.Amount) != Amount)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "The receipt's service lines must add up to its total.");
        }

        VoucherId = voucher?.VoucherId;
        VoucherCode = voucher is null
            ? null
            : Check.NotNullOrWhiteSpace(voucher.Code, nameof(voucher.Code), MaxVoucherCodeLength);
        VoucherAmount = voucherAmount;
        CashierDiscountTotal = _lines.Sum(line => line.CashierDiscount);
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
        EnsureNotCancelled();
        if (!IsPending)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCompleted,
                "An exported or paid receipt is locked.");
        }
    }

    private void EnsureNotCancelled()
    {
        if (Status == PatientPaymentStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCancelled,
                "A cancelled receipt is final.");
        }
    }

    /// <summary>
    /// Moves this receipt's share of one service onto another, up to
    /// <paramref name="limit"/> — what "Chuyển đổi dịch vụ" does with money
    /// already collected. Returns how much actually moved.
    ///
    /// The receipt's own total never changes: a share too big for the new line
    /// is split, and the remainder stays on the old one for the caller to
    /// refund or leave as credit. Only money moves — what the receipt let off
    /// the old line (TN giảm, voucher) was let off that line and stays on it.
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
            if (moved >= limit)
            {
                break;
            }

            var take = Math.Min(line.Amount, limit - moved);
            if (take <= 0m)
            {
                continue;
            }

            _lines.Remove(line);
            _lines.Add(new PatientPaymentLine(lineIdFactory(), toServiceId, take));

            // The stored VAT was the old line's; both pieces back theirs out again.
            var left = line.ToDraft() with { Amount = line.Amount - take, TaxAmount = null };
            if (left.Amount + left.Relief > 0m)
            {
                _lines.Add(new PatientPaymentLine(lineIdFactory(), left));
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

    public PatientPayment RequestRedInvoice(bool requested)
    {
        RedInvoiceRequested = requested;
        return this;
    }

    /// <summary>
    /// Writes down what the PHIẾU THU says. Only a payment has one, and only
    /// while it is still "Chưa thanh toán": from the export on the receipt is
    /// locked (Billing:0096).
    /// </summary>
    public PatientPayment FreezeReceipt(PaymentReceiptSnapshot snapshot)
    {
        Check.NotNull(snapshot, nameof(snapshot));
        EnsurePending();
        if (Kind != PatientPaymentKind.Payment)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidInvoiceTransition,
                "Only a payment carries a PHIẾU THU.");
        }

        if (snapshot.Amount != Amount)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidPaymentAllocation,
                "The PHIẾU THU must state the receipt's own total.");
        }

        ReceiptSnapshot = snapshot;
        return this;
    }

    public PatientPayment MarkImported()
    {
        IsImported = true;
        return this;
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
    /// "Phiếu bị hủy"; the caller then soft-deletes it so nothing counts it and
    /// the debt comes back. A receipt with no description is not cancelled (bug
    /// list item 28: one vanished from the list with no reason and no trace).
    ///
    /// An exported or paid payment is cancelled from the cancel page, which
    /// also asks one of the four fixed reasons (P2610) — cancelling a paid one
    /// raises Còn lại again. A receipt still "Chưa thanh toán" keeps the plain
    /// reason of the Thanh toán tab. A refund or held money is final once written.
    /// </summary>
    public PatientPayment Cancel(
        PaymentCancelReason? reasonCode,
        string? reason,
        DateTimeOffset cancelledAt,
        Guid? cancelledById)
    {
        EnsureNotCancelled();

        if (!IsPending)
        {
            if (Kind != PatientPaymentKind.Payment)
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCompleted,
                    "A refund or held money is final once written.");
            }

            if (reasonCode is null || !Enum.IsDefined(reasonCode.Value))
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Billing.PaymentCancelReasonCodeRequired,
                    "An exported or paid receipt is cancelled with one of the fixed reasons.");
            }
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.PaymentCancelReasonRequired,
                "A receipt is cancelled with a reason.");
        }

        CancelReason = Check.Length(reason.Trim(), nameof(reason), MaxCancelReasonLength);
        CancelReasonCode = reasonCode;
        CancelledAt = cancelledAt;
        CancelledById = cancelledById;
        Status = PatientPaymentStatus.Cancelled;
        return this;
    }

    /// <summary>
    /// Checked before the PDF is rendered, so a locked receipt or Ký số is
    /// refused without the cost of a render.
    /// </summary>
    public void EnsureIssuable(ReceiptSignMode signMode)
    {
        EnsurePending();
        if (signMode == ReceiptSignMode.Digital)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.ReceiptDigitalSignUnavailable,
                "Ký số is not available yet.");
        }
    }

    /// <summary>
    /// "Xuất phiếu thu": the customer has signed and the accountant has
    /// checked it. The PDF written from it is stored with its SHA-256. From
    /// here nothing on the receipt changes; the money is still not counted
    /// until ✓ <see cref="Confirm"/>.
    /// </summary>
    public PatientPayment Issue(
        DateTimeOffset issuedAt,
        Guid? accountantId,
        ReceiptSignMode signMode,
        string receiptFileName,
        string receiptFileSha256)
    {
        EnsureIssuable(signMode);
        Check.NotNullOrWhiteSpace(receiptFileName, nameof(receiptFileName), MaxReceiptFileNameLength);
        if (receiptFileSha256.Length != ReceiptFileSha256Length)
        {
            throw new ArgumentException("A SHA-256 is 64 hex digits.", nameof(receiptFileSha256));
        }

        IssuedAt = issuedAt;
        IssuedById = accountantId;
        SignMode = signMode;
        ReceiptFileName = receiptFileName;
        ReceiptFileSha256 = receiptFileSha256;
        Status = PatientPaymentStatus.Issued;
        return this;
    }

    /// <summary>
    /// "Chỉnh sửa" on a receipt still "Chưa thanh toán": nothing has been
    /// collected, so everything the create dialog asked can be rewritten — the
    /// split, the amount and its service lines, the channel and the note, and
    /// from P2910 each line's name and TN giảm and the voucher. The caller
    /// re-checks each line against what the slip still owes, and gives back
    /// the old voucher's use when it is swapped or taken off.
    /// </summary>
    public PatientPayment Revise(
        PaymentSplitMode splitMode,
        PaymentMethodKind method,
        decimal amount,
        Guid? paymentAccountId,
        string? note,
        IEnumerable<PaymentLineDraft> lines,
        Func<Guid> lineIdFactory,
        PaymentVoucherUse? voucher = null)
    {
        EnsurePending();

        var drafts = lines.ToList();
        EnsureAmount(Kind, amount, drafts);
        EnsureAccount(Kind, method, paymentAccountId);

        SplitMode = splitMode;
        Method = method;
        Amount = amount;
        PaymentAccountId = RequiresAccount(method) ? paymentAccountId : null;
        Note = note;
        ReplaceLines(drafts, lineIdFactory, voucher);
        return this;
    }

    /// <summary>
    /// ✓ "Xác nhận thanh toán" on an exported receipt: the money is in. From
    /// here the receipt counts everywhere. It keeps the "Ngày thanh toán" picked
    /// when it was written (R-934) — revenue is reported by that day, not by
    /// when ✓ was pressed. The one who confirms is credited as the cashier.
    /// </summary>
    public PatientPayment Confirm(Guid cashierId)
    {
        EnsureNotCancelled();
        if (IsPending)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.PaymentNotIssued,
                "A receipt is confirmed as paid only once it has been exported.");
        }

        if (Status != PatientPaymentStatus.Issued)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.PaymentAlreadyCompleted,
                "A paid receipt is final.");
        }

        Status = PatientPaymentStatus.Completed;
        StaffId = cashierId;
        return this;
    }
}
