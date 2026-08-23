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
/// Mục danh mục — the entry table shared by every "Danh mục" sub-route.
/// </summary>
[Authorize]
public class CatalogEntryAppService : ApplicationService, ICatalogEntryAppService
{
    private readonly IRepository<CatalogEntry, Guid> _repository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly BranchAccessChecker _branchAccess;

    public CatalogEntryAppService(
        IRepository<CatalogEntry, Guid> repository,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _taxonomyRepository = taxonomyRepository;
        _branchAccess = branchAccess;
    }

    public async Task<PagedResultDto<CatalogEntryDto>> GetListAsync(GetCatalogEntryListInput input)
    {
        if (!string.IsNullOrWhiteSpace(input.Group))
        {
            await CheckGroupPermissionAsync(input.Group, BlueDentalAbilities.Actions.Read);
        }
        else if (input.TaxonomyId.HasValue)
        {
            var taxonomy = await _taxonomyRepository.GetAsync(input.TaxonomyId.Value);
            await CheckGroupPermissionAsync(taxonomy.Group, BlueDentalAbilities.Actions.Read);
        }

        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);

        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        if (input.TaxonomyId.HasValue)
            query = query.Where(x => x.TaxonomyId == input.TaxonomyId.Value);
        if (!string.IsNullOrWhiteSpace(input.Group))
            query = query.Where(x => x.Group == input.Group);
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim();
            query = query.Where(x => x.Name.Contains(filter) || (x.Code != null && x.Code.Contains(filter)));
        }

        var totalCount = query.Count();
        var items = query
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Name)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var names = await GetTaxonomyNamesAsync(items);
        return new PagedResultDto<CatalogEntryDto>(totalCount, items.Select(x => MapToDto(x, names)).ToList());
    }

    public async Task<CatalogEntryDto> GetAsync(Guid id)
    {
        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);
        await CheckGroupPermissionAsync(entry.Group, BlueDentalAbilities.Actions.Read);
        var names = await GetTaxonomyNamesAsync([entry]);
        return MapToDto(entry, names);
    }

    public async Task<CatalogEntryDto> CreateAsync(CreateCatalogEntryDto input)
    {
        var taxonomy = await _taxonomyRepository.FindAsync(input.TaxonomyId)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.TaxonomyNotFound,
                $"Taxonomy group {input.TaxonomyId} was not found.");

        await _branchAccess.CheckAsync(input.ClinicBranchId);
        await CheckGroupPermissionAsync(taxonomy.Group, BlueDentalAbilities.Actions.Create);

        var entry = CatalogEntry.Create(
            GuidGenerator.Create(),
            input.ClinicBranchId,
            taxonomy.Id,
            // The group always comes from the taxonomy, never from the client.
            taxonomy.Group,
            input.Name,
            input.Code,
            input.Price,
            input.Content,
            input.Description,
            input.IsImageRequired,
            input.SortOrder);

        await _repository.InsertAsync(entry, autoSave: true);
        return MapToDto(entry, new Dictionary<Guid, string> { [taxonomy.Id] = taxonomy.Name });
    }

    public async Task<CatalogEntryDto> UpdateAsync(Guid id, UpdateCatalogEntryDto input)
    {
        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);
        await CheckGroupPermissionAsync(entry.Group, BlueDentalAbilities.Actions.Update);

        if (entry.TaxonomyId != input.TaxonomyId)
        {
            var target = await _taxonomyRepository.FindAsync(input.TaxonomyId)
                ?? throw new BusinessException(
                    BlueDentalDomainErrorCodes.Catalogs.TaxonomyNotFound,
                    $"Taxonomy group {input.TaxonomyId} was not found.");

            if (target.Group != entry.Group)
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Catalogs.UnknownTaxonomyGroup,
                    "An entry can only be moved between groups of the same catalog.");
            }

            entry.MoveTo(target.Id);
        }

        entry.Rename(input.Name);
        entry.ChangePrice(input.Price);
        entry.UpdateContent(input.Content);
        entry.UpdateDescription(input.Description);
        entry.RequireImage(input.IsImageRequired);
        entry.Reorder(input.SortOrder);

        if (input.IsActive)
        {
            entry.Activate();
        }
        else
        {
            entry.Deactivate();
        }

        await _repository.UpdateAsync(entry, autoSave: true);

        var names = await GetTaxonomyNamesAsync([entry]);
        return MapToDto(entry, names);
    }

    public async Task DeleteAsync(Guid id)
    {
        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);
        await CheckGroupPermissionAsync(entry.Group, BlueDentalAbilities.Actions.Delete);
        await _repository.DeleteAsync(id, autoSave: true);
    }

    /// <summary>Each catalog has its own ability subject — see TaxonomyGroupAbilities.</summary>
    private Task CheckGroupPermissionAsync(string group, string action) =>
        AuthorizationService.CheckAsync(TaxonomyGroupAbilities.PermissionFor(group, action));

    private async Task<Dictionary<Guid, string>> GetTaxonomyNamesAsync(
        IReadOnlyCollection<CatalogEntry> entries)
    {
        var ids = entries.Select(x => x.TaxonomyId).Distinct().ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var query = await _taxonomyRepository.GetQueryableAsync();
        return query
            .Where(x => ids.Contains(x.Id))
            .ToDictionary(x => x.Id, x => x.Name);
    }

    private static CatalogEntryDto MapToDto(
        CatalogEntry entity,
        IReadOnlyDictionary<Guid, string> taxonomyNames) => new()
    {
        Id = entity.Id,
        ClinicBranchId = entity.ClinicBranchId,
        TaxonomyId = entity.TaxonomyId,
        Group = entity.Group,
        Name = entity.Name,
        Code = entity.Code,
        Description = entity.Description,
        Price = entity.Price,
        Content = entity.Content,
        IsImageRequired = entity.IsImageRequired,
        IsActive = entity.IsActive,
        SortOrder = entity.SortOrder,
        TaxonomyName = taxonomyNames.TryGetValue(entity.TaxonomyId, out var name) ? name : null,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
