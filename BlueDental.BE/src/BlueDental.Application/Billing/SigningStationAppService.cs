using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.EInvoicing;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.TreatmentManagement;
using Volo.Abp;
using Volo.Abp.Auditing;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Billing;

/// <summary>
/// The branch's iPad (P2610). No staff login: the device token names the
/// branch, and only that branch's open session can be read or moved on.
/// Not audited — the token and the drawing would land in the log in clear.
/// </summary>
[DisableAuditing]
public class SigningStationAppService(
    IRepository<SigningDevice, Guid> devices,
    IRepository<ReceiptSigningSession, Guid> sessions,
    IRepository<PatientPayment, Guid> payments,
    IRepository<ClinicBranch, Guid> branches,
    IRepository<Patient, Guid> patients,
    IRepository<InvoiceRequest, Guid> requests,
    PaymentReceiptContents receipts,
    InvoiceRequestSources sources,
    ReceiptSigningDesk desk,
    IReceiptCipher cipher) : BlueDentalAppService, ISigningStationAppService
{
    /// <summary>The iPad polls on reconnect; its "last seen" is written at most this often.</summary>
    private static readonly TimeSpan SeenEvery = TimeSpan.FromMinutes(1);

    public async Task<SigningStationDto> GetCurrentAsync(string deviceToken)
    {
        var device = await DeviceAsync(deviceToken);
        return await StationOfAsync(device);
    }

    public async Task<SigningStationDto> CheckAsync(string deviceToken, Guid sessionId)
    {
        var device = await DeviceAsync(deviceToken);
        var session = await OpenSessionAsync(device, sessionId);
        session.MarkChecked(DateTimeOffset.UtcNow);
        await sessions.UpdateAsync(session, autoSave: true);
        desk.Notify(session.ClinicBranchId, session.PatientPaymentId);
        return await StationOfAsync(device);
    }

    public async Task<SigningStationDto> SignAsync(string deviceToken, Guid sessionId, SignReceiptDto input)
    {
        var device = await DeviceAsync(deviceToken);
        var session = await OpenSessionAsync(device, sessionId);
        var png = SignatureImage.FromDataUrl(input.SignatureDataUrl);
        session.Sign(cipher.Encrypt(png), device.Id, DateTimeOffset.UtcNow);
        await sessions.UpdateAsync(session, autoSave: true);
        desk.Notify(session.ClinicBranchId, session.PatientPaymentId);
        return await StationOfAsync(device);
    }

    public async Task<SigningStationDto> RequestInvoiceAsync(
        string deviceToken, Guid sessionId, SubmitPublicInvoiceRequestDto input)
    {
        var now = DateTimeOffset.UtcNow;
        var device = await DeviceAsync(deviceToken);
        var session = await OpenSessionAsync(device, sessionId);
        var payment = await sources.EligiblePaymentAsync(session.PatientPaymentId);
        await sources.EnsureNoLiveRequestAsync(payment.Id);
        var patient = await patients.GetAsync(payment.PatientId);

        // As on the QR page: Doanh nghiệp keeps only the buyer's name of the
        // personal lines; a blank field keeps what the record holds.
        var details = input.IsCompany
            ? new InvoiceRequestDetails(
                true,
                Kept(input.FullName, patient.FullName),
                null,
                null,
                null,
                null,
                input.CompanyName,
                input.TaxCode,
                input.CompanyAddress,
                input.Email,
                input.WantsPaperInvoice)
            : new InvoiceRequestDetails(
                false,
                Kept(input.FullName, patient.FullName),
                input.BirthYear ?? patient.DateOfBirth?.Year,
                Kept(input.Phone, patient.Contact?.PhoneNumber),
                Kept(input.NationalId, patient.NationalId),
                Kept(input.PersonalAddress, patient.Contact?.Address ?? patient.OldAddress),
                null,
                null,
                null,
                input.Email,
                input.WantsPaperInvoice);

        var request = InvoiceRequest.Create(
            GuidGenerator.Create(),
            payment.ClinicBranchId,
            payment.PatientId,
            payment.Id,
            payment.TreatmentPlanId,
            await sources.NextCodeAsync(payment.ClinicBranchId),
            InvoiceRequestSource.SigningDevice,
            details,
            await sources.ServiceNameAsync(payment),
            payment.Amount,
            now);
        await requests.InsertAsync(request, autoSave: true);
        desk.Notify(session.ClinicBranchId, session.PatientPaymentId);
        return await StationOfAsync(device);
    }

    private async Task<SigningDevice> DeviceAsync(string? token)
    {
        var trimmed = token?.Trim() ?? string.Empty;
        var hash = SigningDevice.HashToken(trimmed);
        var device = trimmed.Length == SigningDevice.TokenLength
            ? await devices.FirstOrDefaultAsync(d => d.TokenHash == hash && d.RevokedAt == null)
            : null;
        if (device == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.SigningDeviceNotPaired);
        }

        var now = DateTimeOffset.UtcNow;
        if (device.LastSeenAt == null || now - device.LastSeenAt >= SeenEvery)
        {
            device.MarkSeen(now);
            await devices.UpdateAsync(device, autoSave: true);
        }

        return device;
    }

    /// <summary>The branch's open session — a stale screen naming another one is refused.</summary>
    private async Task<ReceiptSigningSession> OpenSessionAsync(SigningDevice device, Guid sessionId)
    {
        var open = await desk.OpenOfBranchAsync(device.ClinicBranchId);
        if (open == null || open.Id != sessionId)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.SigningSessionClosed);
        }

        return open;
    }

    private async Task<SigningStationDto> StationOfAsync(SigningDevice device)
    {
        var branch = await branches.FindAsync(device.ClinicBranchId);
        var station = new SigningStationDto
        {
            ClinicName = branch?.Name ?? string.Empty,
            DeviceName = device.Name,
            Stage = SigningStationStage.Idle
        };

        var now = DateTimeOffset.UtcNow;
        var session = await desk.OpenOfBranchAsync(device.ClinicBranchId) ?? await JustIssuedAsync(device.ClinicBranchId, now);
        if (session == null)
        {
            return station;
        }

        PatientPayment? payment;
        using (DataFilter.Disable<ISettleable>())
        {
            payment = await payments.FirstOrDefaultAsync(x => x.Id == session.PatientPaymentId);
        }

        if (payment == null)
        {
            return station;
        }

        station.Stage = !session.IsOpen
                ? session.CloseReason == SigningCloseReason.Printed ? SigningStationStage.Printed : SigningStationStage.Issued
            : session.CheckedAt == null ? SigningStationStage.Review
            : !session.IsSigned ? SigningStationStage.Signing
            : SigningStationStage.Signed;
        station.SessionId = session.Id;
        station.PaymentCode = payment.Code;
        station.Receipt = PaymentReceiptContents.ToDto(await receipts.ContentOfAsync(payment));
        station.SignatureDataUrl = session.SignatureCipher == null
            ? null
            : SignatureImage.ToDataUrl(cipher.Decrypt(session.SignatureCipher));
        station.InvoiceRequested = await requests.AnyAsync(r =>
            r.PatientPaymentId == payment.Id && r.Status != InvoiceRequestStatus.Cancelled);
        station.IssuedAt = payment.IssuedAt;
        station.PaperSignedAt = payment.PaperSignedAt;
        return station;
    }

    /// <summary>"Phiếu thu đã được xuất" (or "… đã được in") stays a little while after the close.</summary>
    private async Task<ReceiptSigningSession?> JustIssuedAsync(Guid clinicBranchId, DateTimeOffset now)
    {
        var since = now - ReceiptSigningSession.IssuedShownFor;
        var query = await sessions.GetQueryableAsync();
        var latest = await AsyncExecuter.FirstOrDefaultAsync(query
            .Where(x => x.ClinicBranchId == clinicBranchId
                && (x.CloseReason == SigningCloseReason.Issued || x.CloseReason == SigningCloseReason.Printed)
                && x.ClosedAt >= since)
            .OrderByDescending(x => x.ClosedAt));
        return latest != null && latest.ShowsIssued(now) ? latest : null;
    }

    private static string? Kept(string? typed, string? onFile) =>
        string.IsNullOrWhiteSpace(typed) ? onFile : typed;
}
