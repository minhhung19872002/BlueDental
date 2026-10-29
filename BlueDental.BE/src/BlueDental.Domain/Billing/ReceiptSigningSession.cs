using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Billing;

/// <summary>
/// One receipt shown on the branch's iPad for the customer to check and sign
/// (P2610). A branch has at most one open session — the database holds that
/// with a unique index on the branch where <see cref="ClosedAt"/> is null — so
/// every paired iPad of the branch shows the same receipt.
///
/// The signature is kept encrypted (<see cref="IReceiptCipher"/>) and stays on
/// the closed session: the exported PHIẾU THU (phase 5) prints it.
/// </summary>
public class ReceiptSigningSession : CreationAuditedAggregateRoot<Guid>
{
    /// <summary>
    /// How long the iPad keeps "Phiếu thu đã được xuất" after the export. The
    /// screen itself returns to "Xin chào" after ~15s; this only covers a
    /// reload in between.
    /// </summary>
    public static readonly TimeSpan IssuedShownFor = TimeSpan.FromSeconds(30);

    public Guid ClinicBranchId { get; private set; }
    public Guid PatientPaymentId { get; private set; }

    /// <summary>THANHTOAN-… — named in "iPad đang chờ khách ký phiếu …".</summary>
    public string PaymentCode { get; private set; } = string.Empty;

    /// <summary>Gửi tới iPad / Gửi lại.</summary>
    public DateTimeOffset SentAt { get; private set; }

    /// <summary>Khách kiểm tra: both boxes ticked and "Xác nhận thông tin" pressed.</summary>
    public DateTimeOffset? CheckedAt { get; private set; }

    /// <summary>Khách đồng ý &amp; ký: when "Hoàn tất ký" was pressed.</summary>
    public DateTimeOffset? SignedAt { get; private set; }

    /// <summary>The PNG drawing, encrypted; never stored or logged in clear.</summary>
    public string? SignatureCipher { get; private set; }

    public Guid? SignedOnDeviceId { get; private set; }

    public DateTimeOffset? ClosedAt { get; private set; }
    public SigningCloseReason? CloseReason { get; private set; }

    public bool IsOpen => ClosedAt == null;
    public bool IsSigned => SignedAt != null;

    protected ReceiptSigningSession() { }

    public static ReceiptSigningSession Open(
        Guid id, Guid clinicBranchId, Guid patientPaymentId, string paymentCode, DateTimeOffset now) =>
        new()
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            PatientPaymentId = patientPaymentId,
            PaymentCode = Check.NotNullOrWhiteSpace(paymentCode, nameof(paymentCode)),
            SentAt = now
        };

    /// <summary>Gửi lại: the iPad starts over on the review screen.</summary>
    public void Resend(DateTimeOffset now)
    {
        EnsureOpen();
        SentAt = now;
        CheckedAt = null;
        ClearSignature();
    }

    /// <summary>"Xác nhận thông tin" — steps 1 and 2 of the iPad are done.</summary>
    public void MarkChecked(DateTimeOffset now)
    {
        EnsureOpen();
        CheckedAt ??= now;
    }

    /// <summary>"Hoàn tất ký": the moment of signing is recorded here, not when drawing began.</summary>
    public void Sign(string signatureCipher, Guid deviceId, DateTimeOffset now)
    {
        EnsureOpen();
        if (CheckedAt == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.SigningNotChecked);
        }

        SignatureCipher = Check.NotNullOrWhiteSpace(signatureCipher, nameof(signatureCipher));
        SignedOnDeviceId = deviceId;
        SignedAt = now;
    }

    /// <summary>
    /// Yêu cầu khách ký lại: the signature goes, the check stays, so the iPad
    /// opens straight on the sign screen.
    /// </summary>
    public void RequestResign()
    {
        EnsureOpen();
        if (!IsSigned)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.SigningNotSigned);
        }

        ClearSignature();
    }

    /// <summary>Ends the session; a second close keeps the first reason.</summary>
    public void Close(SigningCloseReason reason, DateTimeOffset now)
    {
        if (!IsOpen)
        {
            return;
        }

        ClosedAt = now;
        CloseReason = reason;
    }

    /// <summary>
    /// The iPad's "Phiếu thu đã được xuất" — or, after "In phiếu thu",
    /// "Phiếu thu đã được in" — screen, for a little while after the close.
    /// </summary>
    public bool ShowsIssued(DateTimeOffset now) =>
        CloseReason is SigningCloseReason.Issued or SigningCloseReason.Printed
        && ClosedAt is { } closed && now - closed < IssuedShownFor;

    public void EnsureOpen()
    {
        if (!IsOpen)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.SigningSessionClosed);
        }
    }

    private void ClearSignature()
    {
        SignatureCipher = null;
        SignedOnDeviceId = null;
        SignedAt = null;
    }
}
