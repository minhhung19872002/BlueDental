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

namespace BlueDental.Catalogs;

/// <summary>
/// Nhóm danh mục — the group panel shared by every "Danh mục" sub-route.
/// </summary>
[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class TaxonomyAppService : ApplicationService, ITaxonomyAppService
{
    private readonly IRepository<Taxonomy, Guid> _repository;
    private readonly IRepository<CatalogEntry, Guid> _entryRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public TaxonomyAppService(
        IRepository<Taxonomy, Guid> repository,
        IRepository<CatalogEntry, Guid> entryRepository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _entryRepository = entryRepository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<TaxonomyDto>> GetListAsync(GetTaxonomyListInput input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(x => x.ClinicBranchId == clinicBranchId);
        if (!string.IsNullOrWhiteSpace(input.Group))
            query = query.Where(x => x.Group == input.Group);
        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim();
            query = query.Where(x => x.Name.Contains(filter));
        }

        var totalCount = query.Count();
        var items = query
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Name)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var counts = input.IncludeCount
            ? await CountEntriesAsync(items.Select(x => x.Id).ToList())
            : new Dictionary<Guid, int>();

        return new PagedResultDto<TaxonomyDto>(
            totalCount,
            items.Select(x => MapToDto(x, counts)).ToList());
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<TaxonomyDto> GetAsync(Guid id)
    {
        var taxonomy = await _repository.GetAsync(id);
        var counts = await CountEntriesAsync([id]);
        return MapToDto(taxonomy, counts);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<TaxonomyDto> CreateAsync(CreateTaxonomyDto input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var taxonomy = Taxonomy.Create(
            GuidGenerator.Create(),
            clinicBranchId,
            input.Group,
            input.Name,
            input.Alias,
            input.Color,
            input.Description,
            input.SubGroup,
            isSystem: false,
            input.SortOrder);

        await _repository.InsertAsync(taxonomy, autoSave: true);
        return MapToDto(taxonomy, new Dictionary<Guid, int>());
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<TaxonomyDto> UpdateAsync(Guid id, UpdateTaxonomyDto input)
    {
        var taxonomy = await _repository.GetAsync(id);

        taxonomy.Rename(input.Name, input.Alias);
        taxonomy.Recolor(input.Color);
        taxonomy.UpdateDescription(input.Description);
        taxonomy.Reorder(input.SortOrder);

        await _repository.UpdateAsync(taxonomy, autoSave: true);

        var counts = await CountEntriesAsync([id]);
        return MapToDto(taxonomy, counts);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var taxonomy = await _repository.GetAsync(id);

        if (taxonomy.IsSystem)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.SystemTaxonomyLocked,
                "A system taxonomy group cannot be deleted.");
        }

        var entryQuery = await _entryRepository.GetQueryableAsync();
        if (entryQuery.Any(x => x.TaxonomyId == id))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.TaxonomyNotEmpty,
                "Move or delete the entries of this group before deleting it.");
        }

        await _repository.DeleteAsync(id, autoSave: true);
    }

    private async Task<Dictionary<Guid, int>> CountEntriesAsync(IReadOnlyCollection<Guid> taxonomyIds)
    {
        if (taxonomyIds.Count == 0)
        {
            return new Dictionary<Guid, int>();
        }

        var query = await _entryRepository.GetQueryableAsync();
        return query
            .Where(x => taxonomyIds.Contains(x.TaxonomyId))
            .GroupBy(x => x.TaxonomyId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionary(x => x.Key, x => x.Count);
    }

    private static TaxonomyDto MapToDto(Taxonomy entity, IReadOnlyDictionary<Guid, int> counts) => new()
    {
        Id = entity.Id,
        ClinicBranchId = entity.ClinicBranchId,
        Group = entity.Group,
        Name = entity.Name,
        Alias = entity.Alias,
        Color = entity.Color,
        Description = entity.Description,
        SubGroup = entity.SubGroup,
        IsSystem = entity.IsSystem,
        SortOrder = entity.SortOrder,
        IsPriced = entity.IsPriced,
        IsTemplated = entity.IsTemplated,
        ItemCount = counts.TryGetValue(entity.Id, out var count) ? count : 0,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
