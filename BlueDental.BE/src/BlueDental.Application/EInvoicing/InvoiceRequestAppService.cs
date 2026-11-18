using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

namespace BlueDental.EInvoicing;

/// <summary>
/// Yêu cầu xuất HĐ — on the patient's Hóa đơn tab, and for every customer of
/// the branch under Tài chính › Hóa đơn đỏ. Reading and keying in a request is
/// the cashier's (payment.read / payment.create); Xử lý, which sends it to
/// EasyInvoice, and Hủy yêu cầu are the accountant's (payment.finalize). From
/// there its status follows EasyInvoice (P1811). Rows are scoped to the
/// branches the caller may see.
/// </summary>
[Authorize]
public class InvoiceRequestAppService(
    IRepository<InvoiceRequest, Guid> requests,
    IRepository<Patient, Guid> patients,
    IRepository<IdentityUser, Guid> users,
    InvoiceRequestSources sources,
    ElectronicInvoiceAppService electronicInvoices,
    BranchAccessChecker branchAccess) : BlueDentalAppService, IInvoiceRequestAppService
{
    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<PagedResultDto<InvoiceRequestDto>> GetListAsync(GetInvoiceRequestListInput input)
    {
        var query = await ScopedAsync(input.PatientId, input.ClinicBranchId);
        if (input.OpenOnly)
        {
            query = query.Where(r => r.Status == InvoiceRequestStatus.Pending
                || r.Status == InvoiceRequestStatus.Cancelled);
        }
        else if (input.Status is { } status)
        {
            query = query.Where(r => r.Status == status);
        }

        var total = await AsyncExecuter.CountAsync(query);
        var rows = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(r => r.RequestedAt)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));

        return new PagedResultDto<InvoiceRequestDto>(total, await MapAsync(rows));
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<InvoiceRequestStatsDto> GetStatsAsync(GetInvoiceRequestStatsInput input)
    {
        var query = await ScopedAsync(input.PatientId, input.ClinicBranchId);
        var now = DateTimeOffset.UtcNow;
        var rows = await AsyncExecuter.ToListAsync(query.Select(r => new { r.Status, r.DueAt }));
        int Count(InvoiceRequestStatus status) => rows.Count(r => r.Status == status);

        return new InvoiceRequestStatsDto
        {
            Total = rows.Count,
            Open = rows.Count(r => r.Status is InvoiceRequestStatus.Pending or InvoiceRequestStatus.Cancelled),
            Pending = Count(InvoiceRequestStatus.Pending),
            Processing = Count(InvoiceRequestStatus.Processing),
            Issued = Count(InvoiceRequestStatus.Issued),
            Cancelled = Count(InvoiceRequestStatus.Cancelled),
            Withdrawn = Count(InvoiceRequestStatus.Withdrawn),
            // Hạn xử lý runs from the request until it is first sent.
            Overdue = rows.Count(r => r.Status == InvoiceRequestStatus.Pending && r.DueAt < now)
        };
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<InvoiceRequestDto> GetAsync(Guid id) => await MapAsync(await LoadAsync(id));

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<List<InvoiceRequestPaymentOptionDto>> GetPaymentOptionsAsync(Guid patientId)
    {
        var patient = await patients.GetAsync(patientId);
        await branchAccess.CheckAsync(patient.BranchId);

        var open = await sources.OpenPaymentsAsync(patientId);
        var names = await sources.ServiceNamesAsync(open);
        return open.Select(p => new InvoiceRequestPaymentOptionDto
        {
            PatientPaymentId = p.Id,
            TreatmentPlanId = p.TreatmentPlanId,
            PaymentCode = p.Code,
            PaidAt = p.PaidAt,
            Amount = p.Amount,
            ServiceName = names.GetValueOrDefault(p.Id, string.Empty)
        }).ToList();
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<InvoiceRequestDraftDto> GetDraftAsync(Guid patientPaymentId)
    {
        var payment = await sources.EligiblePaymentAsync(patientPaymentId);
        await branchAccess.CheckAsync(payment.ClinicBranchId);
        var patient = await patients.GetAsync(payment.PatientId);

        return new InvoiceRequestDraftDto
        {
            PatientPaymentId = payment.Id,
            PaymentCode = payment.Code,
            ServiceName = await sources.ServiceNameAsync(payment),
            Amount = payment.Amount,
            FullName = patient.FullName,
            BirthYear = patient.DateOfBirth?.Year,
            Phone = patient.Contact?.PhoneNumber,
            NationalId = patient.NationalId,
            PersonalAddress = patient.Contact?.Address ?? patient.OldAddress,
            Email = patient.Contact?.Email
        };
    }

    /// <summary>Whoever may print the PHIẾU THU may hand out the link it carries.</summary>
    [Authorize(BlueDentalAbilityPermissions.Payment.Create)]
    public async Task<InvoiceRequestLinkDto> GetLinkAsync(Guid patientPaymentId)
    {
        var payment = await sources.EligiblePaymentAsync(patientPaymentId);
        await branchAccess.CheckAsync(payment.ClinicBranchId);
        var link = await sources.EnsureLinkAsync(payment, GuidGenerator.Create());
        return new InvoiceRequestLinkDto
        {
            Url = sources.PublicUrlOf(link),
            ExpiresAt = link.ExpiresAt,
            SubmittedAt = link.SubmittedAt
        };
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Create)]
    public async Task<InvoiceRequestDto> CreateAsync(CreateInvoiceRequestDto input)
    {
        var payment = await sources.EligiblePaymentAsync(input.PatientPaymentId);
        await branchAccess.CheckAsync(payment.ClinicBranchId);
        await sources.EnsureNoLiveRequestAsync(payment.Id);

        var patient = await patients.GetAsync(payment.PatientId);
        var request = InvoiceRequest.Create(
            GuidGenerator.Create(),
            payment.ClinicBranchId,
            payment.PatientId,
            payment.Id,
            payment.TreatmentPlanId,
            await sources.NextCodeAsync(payment.ClinicBranchId),
            InvoiceRequestSource.Staff,
            // A phone hidden from this account comes back masked: keep the one on file.
            DetailsOf(input, PatientPhoneMask.IsMasked(input.Phone) ? patient.Contact?.PhoneNumber : input.Phone, patient.FullName),
            await sources.ServiceNameAsync(payment),
            payment.Amount,
            DateTimeOffset.UtcNow);

        await requests.InsertAsync(request, autoSave: true);
        return await MapAsync(request);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Create)]
    public async Task<InvoiceRequestDto> UpdateAsync(Guid id, UpdateInvoiceRequestDto input)
    {
        var request = await LoadAsync(id);
        request.UpdateDetails(DetailsOf(input, PatientPhoneMask.IsMasked(input.Phone) ? request.Phone : input.Phone, request.FullName));
        return await SaveAsync(request);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Finalize)]
    public async Task<InvoiceRequestDto> ProcessAsync(Guid id)
    {
        var request = await LoadAsync(id);
        if (!request.NeedsAction)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidTransition);
        }

        var patient = await patients.GetAsync(request.PatientId);
        await electronicInvoices.SendForRequestAsync(request.PatientPaymentId, BuyerOf(request, patient));

        // The send moved it to Chờ xử lý already (same unit of work); this
        // only covers a request the invoice row could not link to.
        if (request.NeedsAction)
        {
            request.Process(CurrentUser.GetId(), Clock.Now);
        }

        return await SaveAsync(request);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Finalize)]
    public async Task<InvoiceRequestDto> WithdrawAsync(Guid id, InvoiceRequestReasonDto input)
    {
        var request = await LoadAsync(id);
        request.Withdraw(input.Reason);
        return await SaveAsync(request);
    }

    /// <summary>
    /// Who the invoice is made out to (P1811, BA 2026-11-18): a company under
    /// its tax code and address; a person under their CCCD as Mã số thuế, so
    /// it must be the 12-digit one, with their address — or the one on file —
    /// since EasyInvoice refuses a tax code without one.
    /// </summary>
    private static InvoiceBuyer BuyerOf(InvoiceRequest request, Patient patient)
    {
        var taxCode = request.IsCompany ? request.TaxCode : request.NationalId;
        if (request.IsCompany)
        {
            if (taxCode == null || !BuyerTaxCode.IsValid(taxCode))
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.EInvoicing.InvalidBuyerTaxCode)
                    .WithData(EasyInvoiceRefusal.FieldKey, "taxCode");
            }
        }
        else if (taxCode == null || taxCode.Length != 12 || !BuyerTaxCode.IsValid(taxCode))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.NationalIdNotTaxCode);
        }

        var address = request.IsCompany
            ? Blank(request.CompanyAddress)
            : Blank(request.PersonalAddress) ?? Blank(patient.Contact?.Address) ?? Blank(patient.OldAddress);
        if (address == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.AddressRequired);
        }

        return new InvoiceBuyer(
            request.FullName,
            request.IsCompany ? request.CompanyName : null,
            taxCode,
            address,
            Blank(request.Phone),
            Blank(request.Email),
            request.NationalId);
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>A Công ty request does not ask the name: it keeps <paramref name="nameOnFile"/>.</summary>
    internal static InvoiceRequestDetails DetailsOf(InvoiceRequestFormDto input, string? phone, string nameOnFile) => new(
        input.IsCompany,
        input.IsCompany ? nameOnFile : input.FullName,
        input.BirthYear, phone, input.NationalId, input.PersonalAddress,
        input.CompanyName, input.TaxCode, input.CompanyAddress, input.Email, input.WantsPaperInvoice);

    private async Task<IQueryable<InvoiceRequest>> ScopedAsync(Guid? patientId, Guid? clinicBranchId)
    {
        var branches = await branchAccess.ResolveFilterAsync(clinicBranchId);
        var query = await requests.GetQueryableAsync();
        if (branches.Count > 0)
        {
            query = query.Where(r => branches.Contains(r.ClinicBranchId));
        }

        return patientId is { } id ? query.Where(r => r.PatientId == id) : query;
    }

    private async Task<InvoiceRequest> LoadAsync(Guid id)
    {
        var request = await requests.FindAsync(id) ?? throw new EntityNotFoundException(typeof(InvoiceRequest), id);
        await branchAccess.CheckAsync(request.ClinicBranchId);
        return request;
    }

    private async Task<InvoiceRequestDto> SaveAsync(InvoiceRequest request)
    {
        await requests.UpdateAsync(request, autoSave: true);
        return await MapAsync(request);
    }

    private async Task<InvoiceRequestDto> MapAsync(InvoiceRequest request) => (await MapAsync([request]))[0];

    private async Task<List<InvoiceRequestDto>> MapAsync(IReadOnlyCollection<InvoiceRequest> rows)
    {
        var userIds = rows.SelectMany(r => new[] { r.AssigneeId, r.Source == InvoiceRequestSource.Staff ? r.CreatorId : null })
            .OfType<Guid>().Distinct().ToList();
        var names = (await users.GetListAsync(u => userIds.Contains(u.Id)))
            .ToDictionary(u => u.Id, DisplayName);

        var paymentCodes = await sources.PaymentCodesAsync(rows.Select(r => r.PatientPaymentId).Distinct().ToList());
        var patientIds = rows.Select(r => r.PatientId).Distinct().ToList();
        var patientsById = (await patients.GetListAsync(p => patientIds.Contains(p.Id)))
            .ToDictionary(p => p.Id);

        return rows.Select(r => new InvoiceRequestDto
        {
            Id = r.Id,
            ClinicBranchId = r.ClinicBranchId,
            PatientId = r.PatientId,
            PatientPaymentId = r.PatientPaymentId,
            TreatmentPlanId = r.TreatmentPlanId,
            Code = r.Code,
            Source = r.Source,
            RequesterName = r.Source == InvoiceRequestSource.Staff && r.CreatorId is { } creator
                ? names.GetValueOrDefault(creator)
                : null,
            PatientCode = patientsById.GetValueOrDefault(r.PatientId)?.PatientCode ?? string.Empty,
            PatientName = patientsById.GetValueOrDefault(r.PatientId)?.FullName ?? string.Empty,
            PaymentCode = paymentCodes.GetValueOrDefault(r.PatientPaymentId, string.Empty),
            FullName = r.FullName,
            BirthYear = r.BirthYear,
            Phone = r.Phone,
            NationalId = r.NationalId,
            PersonalAddress = r.PersonalAddress,
            CompanyName = r.CompanyName,
            TaxCode = r.TaxCode,
            CompanyAddress = r.CompanyAddress,
            Email = r.Email,
            WantsPaperInvoice = r.WantsPaperInvoice,
            IsCompany = r.IsCompany,
            ServiceName = r.ServiceName,
            Amount = r.Amount,
            RequestedAt = r.RequestedAt,
            DueAt = r.DueAt,
            Status = r.Status,
            AssigneeId = r.AssigneeId,
            AssigneeName = r.AssigneeId is { } assignee ? names.GetValueOrDefault(assignee) : null,
            ProcessedAt = r.ProcessedAt,
            CompletedAt = r.CompletedAt,
            InvoiceNo = r.InvoiceNo,
            Reason = r.Reason
        }).ToList();
    }

    private static string DisplayName(IdentityUser user)
    {
        var fullName = string.Join(" ", new[] { user.Surname, user.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return string.IsNullOrWhiteSpace(fullName) ? user.UserName : fullName;
    }
}
