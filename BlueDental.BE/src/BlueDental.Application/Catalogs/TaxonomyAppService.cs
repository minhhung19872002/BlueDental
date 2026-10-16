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
/// Nhóm danh mục — the group panel shared by every "BE:Perm:Catalogs" sub-route.
/// </summary>
[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class TaxonomyAppService : ApplicationService, ITaxonomyAppService
{
    private readonly IRepository<Taxonomy, Guid> _repository;
    private readonly IRepository<CatalogEntry, Guid> _entryRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly BranchAccessChecker _branchAccess;

    public TaxonomyAppService(
        IRepository<Taxonomy, Guid> repository,
        IRepository<CatalogEntry, Guid> entryRepository,
        ICurrentClinicBranchResolver branchResolver,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _entryRepository = entryRepository;
        _branchResolver = branchResolver;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<TaxonomyDto>> GetListAsync(GetTaxonomyListInput input)
    {
        // The header can switch branches, so the caller names the one it wants;
        // the checker narrows it to what this account may actually see.
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        if (input.Group == TaxonomyGroups.DentalMaterial)
        {
            await EnsureDentalMaterialGroupsAsync(branchFilter);
        }

        if (!string.IsNullOrWhiteSpace(input.Group))
            query = query.Where(x => x.Group == input.Group);
        // Every word has to appear somewhere in the row, in any field and in
        // any order — see SearchTerms for what "somewhere" means.
        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(x =>
                x.Name.ToLower().Contains(term) ||
                (x.Alias != null && x.Alias.ToLower().Contains(term)) ||
                (x.Description != null && x.Description.ToLower().Contains(term)));
        }

        var totalCount = query.Count();
        var items = query
            .OrderBy(x => x.SortOrder)
            // Newest first among equal priorities: a record just added carries
            // the default priority, so this is what puts it at the top of the
            // list the moment it is saved.
            .ThenByDescending(x => x.CreationTime)
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
        await _branchAccess.CheckAsync(taxonomy.ClinicBranchId);
        var counts = await CountEntriesAsync([id]);
        return MapToDto(taxonomy, counts);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<TaxonomyDto> CreateAsync(CreateTaxonomyDto input)
    {
        EnsureGroupsOpen(input.Group);
        var clinicBranchId = await _branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId,
            _branchResolver.GetRequiredClinicBranchId());
        await EnsureNameFreeAsync(clinicBranchId, input.Group, input.Name, exceptId: null);
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
        await _branchAccess.CheckAsync(taxonomy.ClinicBranchId);
        EnsureGroupsOpen(taxonomy.Group);

        // Only a rename is checked: a group that already shared its name before
        // the rule existed can still have its colour or priority changed.
        if (!CatalogNames.Same(taxonomy.Name, input.Name))
        {
            await EnsureNameFreeAsync(taxonomy.ClinicBranchId, taxonomy.Group, input.Name, taxonomy.Id);
        }

        taxonomy.Rename(input.Name, input.Alias);
        taxonomy.Recolor(input.Color);
        taxonomy.UpdateDescription(input.Description);
        taxonomy.Reorder(input.SortOrder);

        await _repository.UpdateAsync(taxonomy, autoSave: true);

        var counts = await CountEntriesAsync([id]);
        return MapToDto(taxonomy, counts);
    }

    /// <summary>
    /// "Vật liệu nha khoa" keeps one fixed group per kind (clinic, 2026-10-16:
    /// no new kinds yet). Delete is already refused for them as system groups.
    /// </summary>
    private static void EnsureGroupsOpen(string group)
    {
        if (group == TaxonomyGroups.DentalMaterial)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Catalogs.FixedTaxonomyGroups);
        }
    }

    /// <summary>
    /// The fixed groups of "Vật liệu nha khoa", made for each branch the list is
    /// read for the first time it is — so the tab, and mẫu 5 adding a type, always
    /// find the group of each kind.
    /// </summary>
    private async Task EnsureDentalMaterialGroupsAsync(IReadOnlyCollection<Guid> branchIds)
    {
        if (branchIds.Count == 0) return;

        var query = await _repository.GetQueryableAsync();
        var existing = query
            .Where(x => x.Group == TaxonomyGroups.DentalMaterial && branchIds.Contains(x.ClinicBranchId))
            .Select(x => new { x.ClinicBranchId, x.SubGroup })
            .ToList();

        foreach (var branchId in branchIds)
        {
            var order = 0;
            foreach (var (subGroup, name) in DentalMaterialGroups.All)
            {
                if (!existing.Any(x => x.ClinicBranchId == branchId && x.SubGroup == subGroup))
                {
                    await _repository.InsertAsync(Taxonomy.Create(
                        GuidGenerator.Create(),
                        branchId,
                        TaxonomyGroups.DentalMaterial,
                        name,
                        subGroup: subGroup,
                        isSystem: true,
                        sortOrder: order),
                        autoSave: true);
                }
                order += 1;
            }
        }
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var taxonomy = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(taxonomy.ClinicBranchId);

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

    /// <summary>
    /// Applies a whole new order in one call — a drag is one action, so it is
    /// one request and one transaction. Writing a row at a time would leave the
    /// catalog half-sorted the moment any single write failed.
    /// </summary>
    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task ReorderAsync(ReorderTaxonomyDto input)
    {
        if (input.Items.Count == 0)
        {
            return;
        }

        var ids = input.Items.Select(x => x.Id).Distinct().ToList();
        var query = await _repository.GetQueryableAsync();
        var groups = query.Where(x => ids.Contains(x.Id)).ToList();

        if (groups.Count != ids.Count)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.TaxonomyNotFound,
                "One of the groups being ordered no longer exists.");
        }

        // Every row has to be one this account may write to, and they all have
        // to belong to the catalog the caller named — otherwise a crafted
        // payload could reorder a different branch's groups.
        foreach (var branchId in groups.Select(x => x.ClinicBranchId).Distinct())
        {
            await _branchAccess.CheckAsync(branchId);
        }

        if (!string.IsNullOrWhiteSpace(input.Group) && groups.Any(x => x.Group != input.Group))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.UnknownTaxonomyGroup,
                "The groups being ordered do not all belong to that catalog.");
        }

        var order = input.Items.ToDictionary(x => x.Id, x => x.Order);
        foreach (var taxonomy in groups)
        {
            taxonomy.Reorder(order[taxonomy.Id]);
        }

        await _repository.UpdateManyAsync(groups, autoSave: true);
    }

    /// <summary>
    /// One name per group within a catalog and branch — the key the Excel import
    /// already finds groups by. The name is compared in memory because "the same
    /// name" ignores case and stray whitespace (<see cref="CatalogNames"/>).
    /// </summary>
    private async Task EnsureNameFreeAsync(Guid clinicBranchId, string group, string name, Guid? exceptId)
    {
        var query = await _repository.GetQueryableAsync();
        var taken = await AsyncExecuter.ToListAsync(query
            .Where(t => t.ClinicBranchId == clinicBranchId && t.Group == group && t.Id != exceptId)
            .Select(t => t.Name));

        CatalogNames.EnsureFree(name, taken, BlueDentalDomainErrorCodes.Catalogs.DuplicateTaxonomyName);
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
