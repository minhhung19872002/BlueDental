using System;
using System.Globalization;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Billing;

/// <summary>
/// One line of a receipt's log (P2910_02 BA note on "Xuất phiếu thu"): when
/// it was exported, who signed it and when, when it was cancelled — each with
/// the user and the moment. Kept apart from the receipt's own columns, which
/// an edit or "Hủy phiên" clears, so nothing that happened is lost. Ids and
/// times only: the payer's name stays on the frozen receipt content.
/// <para>
/// Each line is sealed to the one before it (<see cref="SealAfter"/>, R-1082),
/// and the table refuses UPDATE, DELETE and TRUNCATE: a line changed, dropped
/// or forged without the vault key shows in <see cref="ReceiptLogChain"/>.
/// </para>
/// </summary>
public class PaymentReceiptLog : Entity<Guid>
{
    public const int MaxSealLength = 80;
    private const string SealVersion = "receipt-log/v1";

    public Guid PatientPaymentId { get; private set; }
    public Guid ClinicBranchId { get; private set; }
    public ReceiptLogAction Action { get; private set; }

    /// <summary>When it happened.</summary>
    public DateTimeOffset At { get; private set; }

    /// <summary>Who did it — the cashier who printed, the accountant who exported, the one who cancelled.</summary>
    public Guid? UserId { get; private set; }

    /// <summary>Exported: Ký điện tử, Token điện tử or Ký tay trực tiếp.</summary>
    public ReceiptSignMode? SignMode { get; private set; }

    /// <summary>Exported with Ký điện tử: whose saved signature went on the PDF, and when it was saved.</summary>
    public Guid? AccountantSignerId { get; private set; }

    public DateTimeOffset? AccountantSignatureSavedAt { get; private set; }

    /// <summary>Exported: when the customer signed, and whether on the printout rather than the iPad.</summary>
    public DateTimeOffset? CustomerSignedAt { get; private set; }

    public bool? CustomerSignedOnPaper { get; private set; }

    /// <summary>Exported: the SHA-256 of the PDF sealed in storage.</summary>
    public string? FileSha256 { get; private set; }

    /// <summary>Cancelled: one of the four fixed reasons, when the receipt had been exported.</summary>
    public PaymentCancelReason? CancelReasonCode { get; private set; }

    /// <summary>1, 2, 3… within the receipt: the order the chain runs in.</summary>
    public int Sequence { get; private set; }

    /// <summary>
    /// <see cref="IReceiptCipher.Mac"/> over this line and the previous line's
    /// seal. Null only on lines written before R-1082.
    /// </summary>
    public string? Seal { get; private set; }

    protected PaymentReceiptLog() { }

    private PaymentReceiptLog(Guid id, PatientPayment payment, ReceiptLogAction action, DateTimeOffset at, Guid? userId)
        : base(id)
    {
        PatientPaymentId = payment.Id;
        ClinicBranchId = payment.ClinicBranchId;
        Action = action;
        At = Stored(at);
        UserId = userId;
    }

    /// <summary>
    /// Numbers the line after <paramref name="previous"/> (the receipt's last
    /// line, or null for its first) and seals it to it. Once only.
    /// </summary>
    public void SealAfter(PaymentReceiptLog? previous, IReceiptCipher cipher)
    {
        if (Seal != null)
        {
            throw new InvalidOperationException("The receipt log line is already sealed.");
        }

        if (previous != null && previous.PatientPaymentId != PatientPaymentId)
        {
            throw new ArgumentException("The previous line belongs to another receipt.", nameof(previous));
        }

        Sequence = (previous?.Sequence ?? 0) + 1;
        Seal = cipher.Mac(SealedText(previous?.Seal));
    }

    /// <summary>Whether the line still reads as it was sealed after a line sealed <paramref name="previousSeal"/>.</summary>
    public bool IsSealedAfter(string? previousSeal, IReceiptCipher cipher) =>
        Seal != null && cipher.MacMatches(SealedText(previousSeal), Seal);

    private string SealedText(string? previousSeal) => string.Join('|',
        SealVersion,
        Id.ToString("D"),
        PatientPaymentId.ToString("D"),
        ClinicBranchId.ToString("D"),
        Sequence.ToString(CultureInfo.InvariantCulture),
        ((int)Action).ToString(CultureInfo.InvariantCulture),
        Ticks(At),
        UserId?.ToString("D"),
        SignMode is { } signMode ? ((int)signMode).ToString(CultureInfo.InvariantCulture) : null,
        AccountantSignerId?.ToString("D"),
        Ticks(AccountantSignatureSavedAt),
        Ticks(CustomerSignedAt),
        CustomerSignedOnPaper switch { true => "1", false => "0", null => null },
        FileSha256,
        CancelReasonCode is { } reason ? ((int)reason).ToString(CultureInfo.InvariantCulture) : null,
        previousSeal);

    private static string? Ticks(DateTimeOffset? at) => at?.UtcTicks.ToString(CultureInfo.InvariantCulture);

    /// <summary>
    /// UTC to the microsecond, as PostgreSQL keeps it: a time read back seals
    /// to the same text it was sealed with.
    /// </summary>
    private static DateTimeOffset Stored(DateTimeOffset at) =>
        new(at.UtcTicks - at.UtcTicks % TimeSpan.TicksPerMicrosecond, TimeSpan.Zero);

    private static DateTimeOffset? Stored(DateTimeOffset? at) => at is { } value ? Stored(value) : null;

    public static PaymentReceiptLog PrintedForPaper(Guid id, PatientPayment payment) =>
        new(id, payment, ReceiptLogAction.PrintedForPaper,
            payment.PaperSignedAt ?? throw new ArgumentException("The receipt is not on paper.", nameof(payment)),
            payment.PaperSignedById);

    public static PaymentReceiptLog PaperTakenBack(Guid id, PatientPayment payment, DateTimeOffset at, Guid? userId) =>
        new(id, payment, ReceiptLogAction.PaperTakenBack, at, userId);

    /// <summary>
    /// Read from the receipt once <see cref="PatientPayment.Issue"/> has run:
    /// the export time and user, the sign mode and the accountant's signer;
    /// <paramref name="customerSignedAt"/> is the iPad's "Hoàn tất ký" or the
    /// paper print.
    /// </summary>
    public static PaymentReceiptLog Exported(Guid id, PatientPayment payment, DateTimeOffset customerSignedAt)
    {
        if (payment.IssuedAt is not { } issuedAt)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.PaymentNotIssued);
        }

        return new PaymentReceiptLog(id, payment, ReceiptLogAction.Exported, issuedAt, payment.IssuedById)
        {
            SignMode = payment.SignMode,
            AccountantSignerId = payment.AccountantSignerId,
            AccountantSignatureSavedAt = Stored(payment.AccountantSignatureSavedAt),
            CustomerSignedAt = Stored(customerSignedAt),
            CustomerSignedOnPaper = payment.IsSignedOnPaper,
            FileSha256 = payment.ReceiptFileSha256
        };
    }

    /// <summary>Read from the receipt once <see cref="PatientPayment.Cancel"/> has run.</summary>
    public static PaymentReceiptLog Cancelled(Guid id, PatientPayment payment)
    {
        if (payment.CancelledAt is not { } cancelledAt)
        {
            throw new ArgumentException("The receipt is not cancelled.", nameof(payment));
        }

        return new PaymentReceiptLog(id, payment, ReceiptLogAction.Cancelled, cancelledAt, payment.CancelledById)
        {
            CancelReasonCode = payment.CancelReasonCode
        };
    }
}
