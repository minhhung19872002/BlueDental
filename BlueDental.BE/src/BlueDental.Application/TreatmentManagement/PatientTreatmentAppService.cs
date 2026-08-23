using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement.Values;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Phiếu điều trị (patient-treatments) and the service lines it holds.
///
/// The reference has no separate ability subject for the slip; it sits inside the
/// consulting chain, so <c>treatmentConsultation</c> guards it.
/// </summary>
[Authorize]
public class PatientTreatmentAppService : ApplicationService, IPatientTreatmentAppService
{
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<PatientAdvise, Guid> _adviseRepository;
    private readonly IRepository<PatientPayment, Guid> _paymentRepository;
    private readonly IRepository<TreatmentStage, Guid> _stageRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly PatientMoneyCalculator _money;

    public PatientTreatmentAppService(
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<PatientAdvise, Guid> adviseRepository,
        IRepository<PatientPayment, Guid> paymentRepository,
        IRepository<TreatmentStage, Guid> stageRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess,
        PatientMoneyCalculator money)
    {
        _planRepository = planRepository;
        _adviseRepository = adviseRepository;
        _paymentRepository = paymentRepository;
        _stageRepository = stageRepository;
        _catalogRepository = catalogRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
        _money = money;
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Read)]
    public async Task<PagedResultDto<TreatmentPlanSlipDto>> GetListAsync(
        GetTreatmentPlanSlipListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _planRepository.WithDetailsAsync(x => x.Services);

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.BranchId));
        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.Status.HasValue)
            query = query.Where(x => x.Status == input.Status.Value);

        var totalCount = query.Count();
        var plans = query
            .OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<TreatmentPlanSlipDto>(totalCount, await MapManyAsync(plans));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Read)]
    public async Task<TreatmentPlanSlipDto> GetAsync(Guid id)
    {
        var plan = await LoadAsync(id);
        return (await MapManyAsync([plan])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Create)]
    public async Task<TreatmentPlanSlipDto> OpenAsync(OpenTreatmentPlanDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);

        var advises = await GetConvertibleAdvisesAsync(input);
        if (advises.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                "A treatment slip needs at least one accepted consulting line.");
        }

        var plan = TreatmentPlan.Open(
            GuidGenerator.Create(),
            input.PatientId,
            input.DentistId,
            input.ClinicBranchId,
            await GenerateCodeAsync(input.PatientId),
            input.Title.IsNullOrWhiteSpace() ? "Kế hoạch điều trị" : input.Title!,
            input.ConsultantStaffId,
            input.DiscountType,
            input.DiscountValue);

        foreach (var advise in advises)
        {
            plan.AddService(
                GuidGenerator.Create(),
                advise.ServiceId,
                advise.Id,
                advise.Price,
                advise.Quantity,
                advise.DiscountType,
                advise.DiscountValue,
                advise.Teeth.ToList());

            advise.ConvertTo(plan.Id);
        }

        await _planRepository.InsertAsync(plan, autoSave: true);
        await _adviseRepository.UpdateManyAsync(advises, autoSave: true);

        return (await MapManyAsync([plan])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<TreatmentPlanSlipDto> ApplyDiscountAsync(Guid id, ApplyPlanDiscountDto input)
    {
        var plan = await LoadAsync(id);
        plan.ApplyDiscount(input.DiscountType, input.DiscountValue);

        await _planRepository.UpdateAsync(plan, autoSave: true);
        return (await MapManyAsync([plan])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<TreatmentPlanSlipDto> CompleteServiceAsync(Guid id, Guid serviceLineId)
    {
        var plan = await LoadAsync(id);
        plan.GetService(serviceLineId).Complete();
        plan.CloseIfAllServicesDone();

        await _planRepository.UpdateAsync(plan, autoSave: true);
        return (await MapManyAsync([plan])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<TreatmentPlanSlipDto> CancelServiceAsync(Guid id, Guid serviceLineId)
    {
        var plan = await LoadAsync(id);
        plan.GetService(serviceLineId).Cancel();
        plan.CloseIfAllServicesDone();

        await _planRepository.UpdateAsync(plan, autoSave: true);
        return (await MapManyAsync([plan])).Single();
    }

    private async Task<TreatmentPlan> LoadAsync(Guid id)
    {
        var query = await _planRepository.WithDetailsAsync(x => x.Services);
        var plan = query.FirstOrDefault(x => x.Id == id)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.TreatmentPlanNotFound,
                "Treatment plan not found.");

        await _branchAccess.CheckAsync(plan.BranchId);
        return plan;
    }

    /// <summary>The accepted lines this slip should pull in.</summary>
    private async Task<List<PatientAdvise>> GetConvertibleAdvisesAsync(OpenTreatmentPlanDto input)
    {
        var query = await _adviseRepository.GetQueryableAsync();

        var candidates = query
            .Where(x => x.PatientId == input.PatientId)
            .Where(x => x.ClinicBranchId == input.ClinicBranchId)
            .Where(x => x.Status == PatientAdviseStatus.Accepted)
            .ToList();

        return input.AdviseIds.Count == 0
            ? candidates
            : candidates.Where(x => input.AdviseIds.Contains(x.Id)).ToList();
    }

    /// <summary>Slip numbers run per patient: DT01, DT02, ...</summary>
    private async Task<string> GenerateCodeAsync(Guid patientId)
    {
        var query = await _planRepository.GetQueryableAsync();
        var used = query.Count(x => x.PatientId == patientId) + 1;
        return $"DT{used:D2}";
    }

    private async Task<List<TreatmentPlanSlipDto>> MapManyAsync(IReadOnlyCollection<TreatmentPlan> plans)
    {
        if (plans.Count == 0)
        {
            return [];
        }

        var planIds = plans.Select(p => p.Id).ToList();
        var patientIds = plans.Select(p => p.PatientId).Distinct().ToList();

        var paymentQuery = await _paymentRepository.GetQueryableAsync();
        var payments = paymentQuery.Where(p => patientIds.Contains(p.PatientId)).ToList();

        var stageQuery = await _stageRepository.GetQueryableAsync();
        var stages = stageQuery
            .Where(s => s.TreatmentId.HasValue && planIds.Contains(s.TreatmentId.Value))
            .Select(s => new { s.TreatmentServiceId, s.Status })
            .ToList();

        var serviceIds = plans.SelectMany(p => p.Services).Select(s => s.ServiceId).Distinct().ToList();
        var catalogQuery = await _catalogRepository.GetQueryableAsync();
        var serviceNames = catalogQuery
            .Where(c => serviceIds.Contains(c.Id))
            .ToDictionary(c => c.Id, c => c.Name);

        var staffIds = plans
            .SelectMany(p => new[] { p.DentistId, p.ConsultantStaffId ?? Guid.Empty })
            .Where(x => x != Guid.Empty)
            .Distinct()
            .ToList();

        var users = staffIds.Count == 0 ? [] : await _userRepository.GetListByIdsAsync(staffIds);
        var staffNames = users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        return plans.Select(plan => new TreatmentPlanSlipDto
        {
            Id = plan.Id,
            PatientId = plan.PatientId,
            BranchId = plan.BranchId,
            DentistId = plan.DentistId,
            ConsultantStaffId = plan.ConsultantStaffId,
            Code = plan.Code,
            Title = plan.Title,
            Status = plan.Status,
            ProgressPercent = plan.ProgressPercent,
            DiscountType = plan.DiscountType,
            DiscountValue = plan.DiscountValue,
            VoucherDiscountAmount = plan.VoucherDiscountAmount,
            ServicesTotal = plan.ServicesTotal,
            PlanDiscountAmount = plan.PlanDiscountAmount,
            TotalAmount = plan.TotalAmount,
            Payment = MapPayment(_money.ForPlan(plan, payments)),
            Services = plan.Services
                .OrderBy(s => s.Code)
                .Select(line => new TreatmentServiceDto
                {
                    Id = line.Id,
                    TreatmentPlanId = line.TreatmentPlanId,
                    ServiceId = line.ServiceId,
                    SourceAdviseId = line.SourceAdviseId,
                    Code = line.Code,
                    Price = line.Price,
                    Quantity = line.Quantity,
                    DiscountType = line.DiscountType,
                    DiscountValue = line.DiscountValue,
                    GrossAmount = line.GrossAmount,
                    DiscountAmount = line.DiscountAmount,
                    EffectiveAmount = line.EffectiveAmount,
                    Status = line.Status,
                    Teeth = PatientDiagnosisAppService.ToToothDtos(line.Teeth),
                    ServiceName = serviceNames.TryGetValue(line.ServiceId, out var name) ? name : null,
                    StageCount = stages.Count(s => s.TreatmentServiceId == line.Id),
                    CompletedStageCount = stages.Count(s =>
                        s.TreatmentServiceId == line.Id && s.Status == TreatmentStageStatus.Completed)
                })
                .ToList(),
            DentistName = staffNames.TryGetValue(plan.DentistId, out var dentist) ? dentist : null,
            ConsultantName = plan.ConsultantStaffId.HasValue
                && staffNames.TryGetValue(plan.ConsultantStaffId.Value, out var consultant)
                    ? consultant
                    : null,
            CreationTime = plan.CreationTime,
            CreatorId = plan.CreatorId,
            LastModificationTime = plan.LastModificationTime,
            LastModifierId = plan.LastModifierId
        }).ToList();
    }

    internal static PaymentSummaryDto MapPayment(PaymentSummary summary) => new()
    {
        TotalPrice = summary.TotalPrice,
        TotalPaid = summary.TotalPaid,
        TotalDue = summary.TotalDue,
        Receivable = summary.Receivable,
        PaidUncompleted = summary.PaidUncompleted,
        CompletedValue = summary.CompletedValue,
        TotalRefund = summary.TotalRefund,
        Debt = summary.Debt,
        Discount = summary.Discount,
        OutstandingDebt = summary.OutstandingDebt,
        OutstandingDebtConsumed = summary.OutstandingDebtConsumed,
        Prepaid = summary.Prepaid,
        CarryOverAmount = summary.CarryOverAmount
    };
}
