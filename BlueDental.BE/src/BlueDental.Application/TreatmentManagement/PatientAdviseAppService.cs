using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Tư vấn dịch vụ cho bệnh nhân — the priced bridge between a diagnosis and a
/// treatment plan.
/// </summary>
[Authorize(BlueDentalPermissions.TreatmentManagement.Default)]
public class PatientAdviseAppService : ApplicationService, IPatientAdviseAppService
{
    private readonly IRepository<PatientAdvise, Guid> _repository;
    private readonly IRepository<PatientDiagnosis, Guid> _diagnosisRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public PatientAdviseAppService(
        IRepository<PatientAdvise, Guid> repository,
        IRepository<PatientDiagnosis, Guid> diagnosisRepository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _diagnosisRepository = diagnosisRepository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.View)]
    public async Task<PagedResultDto<PatientAdviseDto>> GetListAsync(GetPatientAdviseListInput input)
    {
        var query = await BuildQueryAsync(input);

        var totalCount = query.Count();
        var items = query
            .OrderBy(x => x.SortOrder)
            .ThenByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<PatientAdviseDto>(totalCount, items.Select(MapToDto).ToList());
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.View)]
    public async Task<PatientAdviseSummaryDto> GetSummaryAsync(GetPatientAdviseListInput input)
    {
        var query = await BuildQueryAsync(input);
        var items = query.ToList();

        return new PatientAdviseSummaryDto
        {
            TotalCount = items.Count,
            AcceptedCount = items.Count(x => x.Status == PatientAdviseStatus.Accepted),
            ConvertedCount = items.Count(x => x.Status == PatientAdviseStatus.Converted),
            TotalGrossAmount = items.Sum(x => x.GrossAmount),
            TotalDiscountAmount = items.Sum(x => x.DiscountAmount),
            TotalEffectiveAmount = items.Sum(x => x.EffectiveAmount)
        };
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.View)]
    public async Task<PatientAdviseDto> GetAsync(Guid id)
    {
        return MapToDto(await _repository.GetAsync(id));
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Create)]
    public async Task<PatientAdviseDto> CreateAsync(CreatePatientAdviseDto input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var diagnosis = await _diagnosisRepository.FindAsync(input.PatientDiagnosisId)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PatientDiagnosisNotFound,
                $"Patient diagnosis {input.PatientDiagnosisId} was not found.");

        if (diagnosis.PatientId != input.PatientId)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PatientDiagnosisNotFound,
                "The diagnosis does not belong to the given patient.");
        }

        var code = await GenerateCodeAsync(clinicBranchId);

        var advise = PatientAdvise.Offer(
            GuidGenerator.Create(),
            input.PatientId,
            clinicBranchId,
            input.PatientDiagnosisId,
            input.DiagnosisId,
            input.ServiceId,
            input.StaffId,
            code,
            input.OriginalPrice,
            input.Price,
            input.Quantity,
            PatientDiagnosisAppService.ToToothSelections(input.Teeth),
            input.DiscountType,
            input.DiscountValue,
            input.SortOrder,
            input.Note,
            input.SecondStaffId,
            input.AdviseGroupId);

        await _repository.InsertAsync(advise, autoSave: true);
        return MapToDto(advise);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit)]
    public async Task<PatientAdviseDto> UpdateAsync(Guid id, UpdatePatientAdviseDto input)
    {
        var advise = await _repository.GetAsync(id);

        advise.ChangePricing(input.Price, input.Quantity);
        advise.ApplyDiscount(input.DiscountType, input.DiscountValue);
        advise.MoveToGroup(input.AdviseGroupId);
        advise.Reorder(input.SortOrder);

        await _repository.UpdateAsync(advise, autoSave: true);
        return MapToDto(advise);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit)]
    public async Task<PatientAdviseDto> AcceptAsync(Guid id)
    {
        var advise = await _repository.GetAsync(id);
        advise.Accept();
        await _repository.UpdateAsync(advise, autoSave: true);
        return MapToDto(advise);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit)]
    public async Task<PatientAdviseDto> RejectAsync(Guid id)
    {
        var advise = await _repository.GetAsync(id);
        advise.Reject();
        await _repository.UpdateAsync(advise, autoSave: true);
        return MapToDto(advise);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit)]
    public async Task<PatientAdviseDto> CancelAsync(Guid id)
    {
        var advise = await _repository.GetAsync(id);
        advise.Cancel();
        await _repository.UpdateAsync(advise, autoSave: true);
        return MapToDto(advise);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit)]
    public async Task<PatientAdviseDto> ApplyVoucherAsync(Guid id, decimal voucherDiscountAmount)
    {
        var advise = await _repository.GetAsync(id);
        advise.ApplyVoucher(voucherDiscountAmount);
        await _repository.UpdateAsync(advise, autoSave: true);
        return MapToDto(advise);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }

    private async Task<IQueryable<PatientAdvise>> BuildQueryAsync(GetPatientAdviseListInput input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(x => x.ClinicBranchId == clinicBranchId);
        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.PatientDiagnosisId.HasValue)
            query = query.Where(x => x.PatientDiagnosisId == input.PatientDiagnosisId.Value);
        if (input.AdviseGroupId.HasValue)
            query = query.Where(x => x.AdviseGroupId == input.AdviseGroupId.Value);
        if (input.TreatmentPlanId.HasValue)
            query = query.Where(x => x.TreatmentPlanId == input.TreatmentPlanId.Value);
        if (input.Status.HasValue)
            query = query.Where(x => x.Status == input.Status.Value);

        return query;
    }

    /// <summary>Sequential per-branch, per-year code — e.g. <c>TV26-0012</c>.</summary>
    private async Task<string> GenerateCodeAsync(Guid clinicBranchId)
    {
        var year = Clock.Now.Year;
        var query = await _repository.GetQueryableAsync();
        var sequence = query.Count(x => x.ClinicBranchId == clinicBranchId && x.CreationTime.Year == year) + 1;
        return $"TV{year % 100:D2}-{sequence:D4}";
    }

    private static PatientAdviseDto MapToDto(PatientAdvise entity) => new()
    {
        Id = entity.Id,
        PatientId = entity.PatientId,
        ClinicBranchId = entity.ClinicBranchId,
        ServiceId = entity.ServiceId,
        DiagnosisId = entity.DiagnosisId,
        PatientDiagnosisId = entity.PatientDiagnosisId,
        TreatmentPlanId = entity.TreatmentPlanId,
        AdviseGroupId = entity.AdviseGroupId,
        StaffId = entity.StaffId,
        SecondStaffId = entity.SecondStaffId,
        Code = entity.Code,
        Note = entity.Note,
        OriginalPrice = entity.OriginalPrice,
        Price = entity.Price,
        Quantity = entity.Quantity,
        DiscountType = entity.DiscountType,
        DiscountValue = entity.DiscountValue,
        VoucherDiscountAmount = entity.VoucherDiscountAmount,
        Status = entity.Status,
        SortOrder = entity.SortOrder,
        Teeth = PatientDiagnosisAppService.ToToothDtos(entity.Teeth),
        ImageIds = entity.ImageIds.ToList(),
        GrossAmount = entity.GrossAmount,
        DiscountAmount = entity.DiscountAmount,
        EffectiveAmount = entity.EffectiveAmount,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };

    internal static PatientAdviseDto ToDto(PatientAdvise entity) => MapToDto(entity);

    internal static List<PatientAdviseDto> ToDtos(IEnumerable<PatientAdvise> entities) =>
        entities.Select(MapToDto).ToList();
}
