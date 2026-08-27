using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Labo;

/// <summary>
/// Dịch vụ - vật liệu — the right-hand table of /labo/service-material.
///
/// The groups on the left are ordinary taxonomy rows under
/// <c>TaxonomyGroups.LaboMaterial</c>, served by the taxonomy endpoint; only
/// the materials live here.
/// </summary>
[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class LaboMaterialAppService : ApplicationService, ILaboMaterialAppService
{
    private readonly IRepository<LaboMaterial, Guid> _repository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly BranchAccessChecker _branchAccess;

    public LaboMaterialAppService(
        IRepository<LaboMaterial, Guid> repository,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        ICurrentClinicBranchResolver branchResolver,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _taxonomyRepository = taxonomyRepository;
        _branchResolver = branchResolver;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<LaboMaterialDto>> GetListAsync(GetLaboMaterialListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        if (input.TaxonomyId.HasValue)
        {
            query = query.Where(x => x.TaxonomyId == input.TaxonomyId.Value);
        }

        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(x => x.Name.ToLower().Contains(term));
        }

        var totalCount = query.Count();
        var items = query
            .OrderBy(x => x.SortOrder)
            // Newest first among equal priorities, so a material just added is
            // at the top of the list the moment it is saved.
            .ThenByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<LaboMaterialDto>(totalCount, await MapAsync(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<LaboMaterialDto> CreateAsync(CreateLaboMaterialDto input)
    {
        var clinicBranchId = await _branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId ?? Guid.Empty,
            _branchResolver.GetRequiredClinicBranchId());

        await GuardGroupAsync(input.TaxonomyId, clinicBranchId);

        var entity = LaboMaterial.Create(
            GuidGenerator.Create(),
            clinicBranchId,
            input.TaxonomyId,
            input.Name.Trim());

        await _repository.InsertAsync(entity, autoSave: true);
        return (await MapAsync([entity]))[0];
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<LaboMaterialDto> UpdateAsync(Guid id, UpdateLaboMaterialDto input)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);
        await GuardGroupAsync(input.TaxonomyId, entity.ClinicBranchId);

        entity.SetDetails(input.TaxonomyId, input.Name.Trim());

        await _repository.UpdateAsync(entity, autoSave: true);
        return (await MapAsync([entity]))[0];
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);
        await _repository.DeleteAsync(id, autoSave: true);
    }

    /// <summary>
    /// The group has to exist, has to be a labo material group, and has to
    /// belong to the same branch — otherwise a material could be filed into
    /// another clinic's group, or into a group from an unrelated catalog.
    /// </summary>
    private async Task GuardGroupAsync(Guid taxonomyId, Guid clinicBranchId)
    {
        var group = await _taxonomyRepository.FindAsync(taxonomyId);

        if (group is null ||
            group.Group != TaxonomyGroups.LaboMaterial ||
            group.ClinicBranchId != clinicBranchId)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Labo.MaterialNeedsGroup,
                "That classification group does not belong to this branch's labo materials.");
        }
    }

    /// <summary>Stamps each row with its group's name, which the table shows.</summary>
    private async Task<List<LaboMaterialDto>> MapAsync(IReadOnlyList<LaboMaterial> items)
    {
        var dtos = ObjectMapper.Map<List<LaboMaterial>, List<LaboMaterialDto>>(items.ToList());

        if (dtos.Count == 0)
        {
            return dtos;
        }

        var ids = items.Select(x => x.TaxonomyId).Distinct().ToList();
        var groups = await _taxonomyRepository.GetListAsync(x => ids.Contains(x.Id));
        var namesById = groups.ToDictionary(x => x.Id, x => x.Name);

        foreach (var dto in dtos)
        {
            dto.TaxonomyName = namesById.GetValueOrDefault(dto.TaxonomyId);
        }

        return dtos;
    }
}
