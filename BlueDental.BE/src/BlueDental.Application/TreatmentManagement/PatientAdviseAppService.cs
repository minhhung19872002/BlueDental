using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using BlueDental.Catalogs;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Tư vấn dịch vụ cho bệnh nhân — the priced bridge between a diagnosis and a
/// treatment plan.
/// </summary>
[Authorize]
public class PatientAdviseAppService : ApplicationService, IPatientAdviseAppService
{
    private readonly IRepository<PatientAdvise, Guid> _repository;
    private readonly IRepository<PatientDiagnosis, Guid> _diagnosisRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IIdentityUserRepository _userRepository;

    public PatientAdviseAppService(
        IRepository<PatientAdvise, Guid> repository,
        IRepository<PatientDiagnosis, Guid> diagnosisRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IIdentityUserRepository userRepository)
    {
        _repository = repository;
        _diagnosisRepository = diagnosisRepository;
        _catalogRepository = catalogRepository;
        _userRepository = userRepository;
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Read)]
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

        var lookups = await BuildLookupsAsync(items);
        return new PagedResultDto<PatientAdviseDto>(
            totalCount,
            items.Select(x => MapToDto(x, lookups)).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Read)]
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

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Read)]
    public async Task<PatientAdviseDto> GetAsync(Guid id)
    {
        var advise = await _repository.GetAsync(id);
        return MapToDto(advise, await BuildLookupsAsync([advise]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Create)]
    public async Task<PatientAdviseDto> CreateAsync(CreatePatientAdviseDto input)
    {
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

        var code = await GenerateCodeAsync(input.ClinicBranchId);

        var advise = PatientAdvise.Offer(
            GuidGenerator.Create(),
            input.PatientId,
            input.ClinicBranchId,
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
        return MapToDto(advise, await BuildLookupsAsync([advise]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<PatientAdviseDto> UpdateAsync(Guid id, UpdatePatientAdviseDto input)
    {
        var advise = await _repository.GetAsync(id);

        advise.ChangePricing(input.Price, input.Quantity);
        advise.ApplyDiscount(input.DiscountType, input.DiscountValue);
        advise.MoveToGroup(input.AdviseGroupId);
        advise.Reorder(input.SortOrder);

        await _repository.UpdateAsync(advise, autoSave: true);
        return MapToDto(advise, await BuildLookupsAsync([advise]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<PatientAdviseDto> AcceptAsync(Guid id)
    {
        var advise = await _repository.GetAsync(id);
        advise.Accept();
        await _repository.UpdateAsync(advise, autoSave: true);
        return MapToDto(advise, await BuildLookupsAsync([advise]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<PatientAdviseDto> RejectAsync(Guid id)
    {
        var advise = await _repository.GetAsync(id);
        advise.Reject();
        await _repository.UpdateAsync(advise, autoSave: true);
        return MapToDto(advise, await BuildLookupsAsync([advise]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<PatientAdviseDto> CancelAsync(Guid id)
    {
        var advise = await _repository.GetAsync(id);
        advise.Cancel();
        await _repository.UpdateAsync(advise, autoSave: true);
        return MapToDto(advise, await BuildLookupsAsync([advise]));
    }

    [Authorize(BlueDentalAbilityPermissions.Voucher.Update)]
    public async Task<PatientAdviseDto> ApplyVoucherAsync(Guid id, decimal voucherDiscountAmount)
    {
        var advise = await _repository.GetAsync(id);
        advise.ApplyVoucher(voucherDiscountAmount);
        await _repository.UpdateAsync(advise, autoSave: true);
        return MapToDto(advise, await BuildLookupsAsync([advise]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }

    private async Task<IQueryable<PatientAdvise>> BuildQueryAsync(GetPatientAdviseListInput input)
    {
        var query = await _repository.GetQueryableAsync();

        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.ClinicBranchId.HasValue)
            query = query.Where(x => x.ClinicBranchId == input.ClinicBranchId.Value);
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

    /// <summary>Service and staff names shown in the consulting table.</summary>
    private async Task<AdviseLookups> BuildLookupsAsync(IReadOnlyCollection<PatientAdvise> items)
    {
        var serviceIds = items.Select(x => x.ServiceId).Distinct().ToList();
        var staffIds = items.Select(x => x.StaffId).Distinct().ToList();

        var catalogQuery = await _catalogRepository.GetQueryableAsync();
        var serviceNames = catalogQuery
            .Where(c => serviceIds.Contains(c.Id))
            .ToDictionary(c => c.Id, c => c.Name);

        var users = staffIds.Count == 0
            ? []
            : await _userRepository.GetListByIdsAsync(staffIds);

        return new AdviseLookups(
            serviceNames,
            users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName));
    }

    internal sealed record AdviseLookups(
        IReadOnlyDictionary<Guid, string> ServiceNames,
        IReadOnlyDictionary<Guid, string> StaffNames);

    private static PatientAdviseDto MapToDto(
        PatientAdvise entity,
        AdviseLookups lookups) => new()
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
        ServiceName = lookups.ServiceNames.TryGetValue(entity.ServiceId, out var serviceName)
            ? serviceName
            : null,
        StaffName = lookups.StaffNames.TryGetValue(entity.StaffId, out var staffName) ? staffName : null,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };

}
