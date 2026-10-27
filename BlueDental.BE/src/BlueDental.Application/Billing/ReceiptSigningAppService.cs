using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Billing;

/// <summary>
/// The receipt page's side of the iPad (P2610): Gửi tới iPad / Gửi lại,
/// Hủy phiên &amp; sửa phiếu, Yêu cầu khách ký lại, and what the customer has
/// done so far — with the signature, decrypted for this screen only.
/// </summary>
[Authorize]
public class ReceiptSigningAppService(
    IRepository<PatientPayment, Guid> payments,
    IRepository<ReceiptSigningSession, Guid> sessions,
    ReceiptSigningDesk desk,
    IReceiptCipher cipher,
    BranchAccessChecker branchAccess) : BlueDentalAppService, IReceiptSigningAppService
{
    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<ReceiptSigningStateDto> GetAsync(Guid patientPaymentId)
    {
        var payment = await PaymentAsync(patientPaymentId);
        return await StateOfAsync(payment);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<ReceiptSigningStateDto> SendAsync(Guid patientPaymentId, SendReceiptToDeviceDto input)
    {
        var payment = await PaymentAsync(patientPaymentId);
        await desk.SendAsync(payment, input.Replace);
        return await StateOfAsync(payment);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<ReceiptSigningStateDto> CancelAsync(Guid patientPaymentId)
    {
        var payment = await PaymentAsync(patientPaymentId);
        await desk.CloseOfPaymentAsync(payment, SigningCloseReason.Cancelled);
        return await StateOfAsync(payment);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Update)]
    public async Task<ReceiptSigningStateDto> RequestResignAsync(Guid patientPaymentId)
    {
        var payment = await PaymentAsync(patientPaymentId);
        var open = await OpenOfPaymentAsync(payment.Id)
            ?? throw new Volo.Abp.BusinessException(BlueDentalDomainErrorCodes.Billing.SigningSessionClosed);
        open.RequestResign();
        await sessions.UpdateAsync(open, autoSave: true);
        desk.Notify(payment.ClinicBranchId, payment.Id);
        return await StateOfAsync(payment);
    }

    private async Task<PatientPayment> PaymentAsync(Guid id)
    {
        // An unpaid receipt is hidden by the settled-only filter.
        using var pending = DataFilter.Disable<ISettleable>();
        var payment = await payments.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new EntityNotFoundException(typeof(PatientPayment), id);
        if (payment.Kind != PatientPaymentKind.Payment)
        {
            throw new EntityNotFoundException(typeof(PatientPayment), id);
        }

        await branchAccess.CheckAsync(payment.ClinicBranchId);
        return payment;
    }

    private Task<ReceiptSigningSession?> OpenOfPaymentAsync(Guid paymentId) =>
        sessions.FirstOrDefaultAsync(x => x.PatientPaymentId == paymentId && x.ClosedAt == null);

    private async Task<ReceiptSigningStateDto> StateOfAsync(PatientPayment payment)
    {
        var branchOpen = await desk.OpenOfBranchAsync(payment.ClinicBranchId);
        var query = await sessions.GetQueryableAsync();
        // The open one first, else the latest.
        var latest = await AsyncExecuter.FirstOrDefaultAsync(query
            .Where(x => x.PatientPaymentId == payment.Id)
            .OrderBy(x => x.ClosedAt == null ? 0 : 1)
            .ThenByDescending(x => x.SentAt));

        return new ReceiptSigningStateDto
        {
            HasDevice = await desk.HasDeviceAsync(payment.ClinicBranchId),
            BusyWithCode = branchOpen != null && branchOpen.PatientPaymentId != payment.Id ? branchOpen.PaymentCode : null,
            Session = latest == null ? null : ToDto(latest)
        };
    }

    private ReceiptSigningSessionDto ToDto(ReceiptSigningSession session) => new()
    {
        Id = session.Id,
        IsOpen = session.IsOpen,
        SentAt = session.SentAt,
        CheckedAt = session.CheckedAt,
        SignedAt = session.SignedAt,
        ClosedAt = session.ClosedAt,
        CloseReason = session.CloseReason,
        SignatureDataUrl = session.SignatureCipher == null
            ? null
            : SignatureImage.ToDataUrl(cipher.Decrypt(session.SignatureCipher))
    };
}
