using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Nhóm tư vấn — groups consulting lines into alternative packages.
/// </summary>
[Authorize]
public class AdviseGroupAppService : ApplicationService, IAdviseGroupAppService
{
    private readonly IRepository<AdviseGroup, Guid> _repository;
    private readonly IRepository<PatientAdvise, Guid> _adviseRepository;

    public AdviseGroupAppService(
        IRepository<AdviseGroup, Guid> repository,
        IRepository<PatientAdvise, Guid> adviseRepository)
    {
        _repository = repository;
        _adviseRepository = adviseRepository;
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Read)]
    public async Task<PagedResultDto<AdviseGroupDto>> GetListAsync(GetAdviseGroupListInput input)
    {
        var query = await _repository.GetQueryableAsync();

        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.ClinicBranchId.HasValue)
            query = query.Where(x => x.ClinicBranchId == input.ClinicBranchId.Value);

        var totalCount = query.Count();
        var items = query
            .OrderBy(x => x.SortOrder)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var groupIds = items.Select(x => x.Id).ToList();
        var adviseQuery = await _adviseRepository.GetQueryableAsync();
        var advises = adviseQuery
            .Where(a => a.AdviseGroupId.HasValue && groupIds.Contains(a.AdviseGroupId.Value))
            .ToList();

        var dtos = items.Select(g => MapToDto(g, advises)).ToList();
        return new PagedResultDto<AdviseGroupDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Read)]
    public async Task<AdviseGroupDto> GetAsync(Guid id)
    {
        var group = await _repository.GetAsync(id);
        var adviseQuery = await _adviseRepository.GetQueryableAsync();
        var advises = adviseQuery.Where(a => a.AdviseGroupId == id).ToList();
        return MapToDto(group, advises);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Create)]
    public async Task<AdviseGroupDto> CreateAsync(CreateAdviseGroupDto input)
    {
        var group = AdviseGroup.Create(
            GuidGenerator.Create(),
            input.PatientId,
            input.ClinicBranchId,
            input.Name,
            input.Description,
            input.SortOrder);

        await _repository.InsertAsync(group, autoSave: true);
        return MapToDto(group, new List<PatientAdvise>());
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Update)]
    public async Task<AdviseGroupDto> UpdateAsync(Guid id, UpdateAdviseGroupDto input)
    {
        var group = await _repository.GetAsync(id);
        group.Rename(input.Name);
        group.UpdateDescription(input.Description);
        group.Reorder(input.SortOrder);

        await _repository.UpdateAsync(group, autoSave: true);

        var adviseQuery = await _adviseRepository.GetQueryableAsync();
        var advises = adviseQuery.Where(a => a.AdviseGroupId == id).ToList();
        return MapToDto(group, advises);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        // Detach the advises first so they are not orphaned by a dangling group id.
        var adviseQuery = await _adviseRepository.GetQueryableAsync();
        var advises = adviseQuery.Where(a => a.AdviseGroupId == id).ToList();

        foreach (var advise in advises)
        {
            advise.MoveToGroup(null);
            await _adviseRepository.UpdateAsync(advise);
        }

        await _repository.DeleteAsync(id, autoSave: true);
    }

    private static AdviseGroupDto MapToDto(AdviseGroup entity, IReadOnlyCollection<PatientAdvise> advises)
    {
        var groupAdvises = advises.Where(a => a.AdviseGroupId == entity.Id).ToList();

        return new AdviseGroupDto
        {
            Id = entity.Id,
            PatientId = entity.PatientId,
            ClinicBranchId = entity.ClinicBranchId,
            Name = entity.Name,
            Description = entity.Description,
            SortOrder = entity.SortOrder,
            AdviseCount = groupAdvises.Count,
            TotalEffectiveAmount = groupAdvises.Sum(a => a.EffectiveAmount),
            CreationTime = entity.CreationTime,
            CreatorId = entity.CreatorId,
            LastModificationTime = entity.LastModificationTime,
            LastModifierId = entity.LastModifierId
        };
    }
}
