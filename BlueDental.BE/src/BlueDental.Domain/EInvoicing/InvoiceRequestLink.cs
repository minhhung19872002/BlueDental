using System;
using System.Security.Cryptography;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.EInvoicing;

/// <summary>
/// The address behind the QR on a PHIẾU THU with "Xuất hóa đơn đỏ" ticked: one
/// per receipt, so one customer and one slip (BA 2026-10-12). The token is the
/// only secret — anyone holding the paper may open the form — so the page shows
/// the customer's contact details masked, the link expires and it takes one
/// answer.
/// </summary>
public class InvoiceRequestLink : CreationAuditedAggregateRoot<Guid>
{
    public const int TokenLength = 43;

    /// <summary>How long a printed QR stays usable (UNKNOWN_REFERENCE_BEHAVIOR — BA to confirm).</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(30);

    public Guid ClinicBranchId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid PatientPaymentId { get; private set; }
    public Guid? TreatmentPlanId { get; private set; }

    /// <summary>32 random bytes, base64url.</summary>
    public string Token { get; private set; } = string.Empty;

    public DateTimeOffset ExpiresAt { get; private set; }

    /// <summary>When the customer sent the form; a link takes one answer.</summary>
    public DateTimeOffset? SubmittedAt { get; private set; }

    protected InvoiceRequestLink() { }

    public static InvoiceRequestLink Issue(
        Guid id, Guid clinicBranchId, Guid patientId, Guid patientPaymentId, Guid? treatmentPlanId, DateTimeOffset now) =>
        new()
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            PatientId = patientId,
            PatientPaymentId = patientPaymentId,
            TreatmentPlanId = treatmentPlanId,
            Token = NewToken(),
            ExpiresAt = now + Lifetime
        };

    public bool IsExpired(DateTimeOffset now) => now >= ExpiresAt;

    /// <summary>The receipt is printed again after the QR expired: same link, new lifetime.</summary>
    public void Renew(DateTimeOffset now)
    {
        if (SubmittedAt == null && IsExpired(now))
        {
            ExpiresAt = now + Lifetime;
        }
    }

    public void EnsureOpen(DateTimeOffset now)
    {
        if (SubmittedAt != null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.LinkUsed);
        }

        if (IsExpired(now))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.LinkExpired);
        }
    }

    public void MarkSubmitted(DateTimeOffset now)
    {
        EnsureOpen(now);
        SubmittedAt = now;
    }

    private static string NewToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
