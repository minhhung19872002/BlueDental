using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

namespace BlueDental.EInvoicing;

/// <summary>
/// Yêu cầu xuất HĐ on the patient's Hóa đơn tab. Reading and keying in a
/// request is the cashier's (payment.read / payment.create); taking it,
/// sending it back, issuing and cancelling are the accountant's
/// (payment.finalize). Rows are scoped to the branches the caller may see.
/// </summary>
[Authorize]
public class InvoiceRequestAppService(
    IRepository<InvoiceRequest, Guid> requests,
    IRepository<Patient, Guid> patients,
    IRepository<IdentityUser, Guid> users,
    InvoiceRequestSources sources,
    BranchAccessChecker branchAccess) : BlueDentalAppService, IInvoiceRequestAppService
{
    [Authorize(BlueDentalAbilityPermissions.Payment.Read)]
    public async Task<PagedResultDto<InvoiceRequestDto>> GetListAsync(GetInvoiceRequestListInput input)
    {
        var query = await ScopedAsync(input.PatientId, input.ClinicBranchId);
        if (input.OpenOnly)
        {
            query = query.Where(r => r.Status == InvoiceRequestStatus.Pending
                || r.Status == InvoiceRequestStatus.Processing
                || r.Status == InvoiceRequestStatus.NeedsInfo);
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

        var open = rows.Where(r => r.Status is InvoiceRequestStatus.Pending
            or InvoiceRequestStatus.Processing or InvoiceRequestStatus.NeedsInfo).ToList();
        return new InvoiceRequestStatsDto
        {
            Total = rows.Count,
            Open = open.Count,
            Pending = Count(InvoiceRequestStatus.Pending),
            Processing = Count(InvoiceRequestStatus.Processing),
            NeedsInfo = Count(InvoiceRequestStatus.NeedsInfo),
            Issued = Count(InvoiceRequestStatus.Issued),
            Cancelled = Count(InvoiceRequestStatus.Cancelled),
            // Cần bổ sung waits on the front desk, so its clock is paused.
            Overdue = open.Count(r => r.Status != InvoiceRequestStatus.NeedsInfo && r.DueAt < now)
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
            DetailsOf(input, PatientPhoneMask.IsMasked(input.Phone) ? patient.Contact?.PhoneNumber : input.Phone),
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
        request.UpdateDetails(DetailsOf(input, PatientPhoneMask.IsMasked(input.Phone) ? request.Phone : input.Phone));
        return await SaveAsync(request);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Finalize)]
    public async Task<InvoiceRequestDto> StartAsync(Guid id)
    {
        var request = await LoadAsync(id);
        request.Start(CurrentUser.GetId());
        return await SaveAsync(request);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Finalize)]
    public async Task<InvoiceRequestDto> RequestMoreInfoAsync(Guid id, InvoiceRequestReasonDto input)
    {
        var request = await LoadAsync(id);
        request.RequestMoreInfo(input.Reason, CurrentUser.GetId());
        return await SaveAsync(request);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Finalize)]
    public async Task<InvoiceRequestDto> CompleteAsync(Guid id, CompleteInvoiceRequestDto input)
    {
        var request = await LoadAsync(id);
        request.Complete(input.InvoiceNo, CurrentUser.GetId(), DateTimeOffset.UtcNow);
        return await SaveAsync(request);
    }

    [Authorize(BlueDentalAbilityPermissions.Payment.Finalize)]
    public async Task<InvoiceRequestDto> CancelAsync(Guid id, InvoiceRequestReasonDto input)
    {
        var request = await LoadAsync(id);
        request.Cancel(input.Reason);
        return await SaveAsync(request);
    }

    internal static InvoiceRequestDetails DetailsOf(InvoiceRequestFormDto input, string? phone) => new(
        input.FullName, input.BirthYear, phone, input.NationalId, input.PersonalAddress,
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
