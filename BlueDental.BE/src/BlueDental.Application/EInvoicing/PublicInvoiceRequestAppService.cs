using System;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.EInvoicing;

/// <summary>
/// The page the QR on a PHIẾU THU opens (BA 2026-10-12). Anyone holding the
/// paper may open it, so only the name and birth year come back whole; phone,
/// CCCD, email and address are shown as hints and a field left blank keeps the
/// value on file. One answer per link, and the link expires.
/// </summary>
public class PublicInvoiceRequestAppService(
    IRepository<InvoiceRequestLink, Guid> links,
    IRepository<InvoiceRequest, Guid> requests,
    IRepository<Patient, Guid> patients,
    IRepository<ClinicBranch, Guid> branches,
    InvoiceRequestSources sources) : BlueDentalAppService, IPublicInvoiceRequestAppService
{
    public async Task<PublicInvoiceRequestFormDto> GetFormAsync(string token)
    {
        var link = await LinkAsync(token);
        var payment = await sources.EligiblePaymentAsync(link.PatientPaymentId);
        var patient = await patients.GetAsync(link.PatientId);
        var branch = await branches.FindAsync(link.ClinicBranchId);
        var answered = link.SubmittedAt != null || await HasLiveRequestAsync(link.PatientPaymentId);

        return new PublicInvoiceRequestFormDto
        {
            ClinicName = branch?.Name ?? string.Empty,
            PaymentCode = payment.Code,
            ServiceName = await sources.ServiceNameAsync(payment),
            Amount = payment.Amount,
            FullName = patient.FullName,
            BirthYear = patient.DateOfBirth?.Year,
            PhoneHint = PatientPhoneMask.Mask(patient.Contact?.PhoneNumber),
            NationalIdHint = MaskTail(patient.NationalId),
            EmailHint = MaskEmail(patient.Contact?.Email),
            AddressHint = MaskAddress(patient.Contact?.Address ?? patient.OldAddress),
            Submitted = answered,
            Expired = !answered && link.IsExpired(DateTimeOffset.UtcNow)
        };
    }

    public async Task<PublicInvoiceRequestResultDto> SubmitAsync(string token, SubmitPublicInvoiceRequestDto input)
    {
        var now = DateTimeOffset.UtcNow;
        var link = await LinkAsync(token);
        link.EnsureOpen(now);

        var payment = await sources.EligiblePaymentAsync(link.PatientPaymentId);
        await sources.EnsureNoLiveRequestAsync(payment.Id);
        var patient = await patients.GetAsync(link.PatientId);

        // Loại hóa đơn (R-916): Công ty keeps only the patient's name of the
        // personal lines; Cá nhân does not ask the Email.
        var details = input.IsCompany
            ? new InvoiceRequestDetails(
                true,
                patient.FullName,
                null,
                null,
                null,
                null,
                input.CompanyName,
                input.TaxCode,
                input.CompanyAddress,
                Kept(input.Email, patient.Contact?.Email),
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
                null,
                input.WantsPaperInvoice);

        var request = InvoiceRequest.Create(
            GuidGenerator.Create(),
            payment.ClinicBranchId,
            payment.PatientId,
            payment.Id,
            payment.TreatmentPlanId,
            await sources.NextCodeAsync(payment.ClinicBranchId),
            InvoiceRequestSource.CustomerQr,
            details,
            await sources.ServiceNameAsync(payment),
            payment.Amount,
            now);

        link.MarkSubmitted(now);
        await requests.InsertAsync(request);
        await links.UpdateAsync(link, autoSave: true);

        return new PublicInvoiceRequestResultDto { Code = request.Code, DueAt = request.DueAt };
    }

    private async Task<InvoiceRequestLink> LinkAsync(string token)
    {
        var trimmed = token?.Trim() ?? string.Empty;
        if (trimmed.Length != InvoiceRequestLink.TokenLength)
        {
            throw new EntityNotFoundException(typeof(InvoiceRequestLink), token);
        }

        return await links.FirstOrDefaultAsync(l => l.Token == trimmed)
            ?? throw new EntityNotFoundException(typeof(InvoiceRequestLink), token);
    }

    private Task<bool> HasLiveRequestAsync(Guid patientPaymentId) =>
        requests.AnyAsync(r => r.PatientPaymentId == patientPaymentId && r.Status != InvoiceRequestStatus.Cancelled);

    /// <summary>The customer's value, or the one on file when the field was left blank.</summary>
    private static string? Kept(string? typed, string? onFile) =>
        string.IsNullOrWhiteSpace(typed) ? onFile : typed;

    /// <summary>"*********123".</summary>
    private static string? MaskTail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var visible = Math.Min(3, value.Length / 3);
        return new string(PatientPhoneMask.MaskChar, value.Length - visible) + value[^visible..];
    }

    /// <summary>"n***@gmail.com".</summary>
    private static string? MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var at = email.IndexOf('@');
        return at <= 0 ? MaskTail(email) : $"{email[0]}***{email[at..]}";
    }

    /// <summary>Only the last part (province) of the address shows: "***, Hà Nội".</summary>
    private static string? MaskAddress(string? address)
    {
        if (string.IsNullOrWhiteSpace(address))
        {
            return null;
        }

        var comma = address.LastIndexOf(',');
        return comma < 0 ? "***" : $"***{address[comma..]}";
    }
}
