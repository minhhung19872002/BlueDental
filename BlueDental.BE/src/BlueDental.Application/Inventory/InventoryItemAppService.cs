using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Inventory;

/// <summary>
/// Vật tư phòng khám.
/// </summary>
[Authorize]
public class InventoryItemAppService : ApplicationService, IInventoryItemAppService
{
    private readonly IRepository<InventoryItem, Guid> _repository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly BranchAccessChecker _branchAccess;

    public InventoryItemAppService(
        IRepository<InventoryItem, Guid> repository,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _taxonomyRepository = taxonomyRepository;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Read)]
    public async Task<PagedResultDto<InventoryItemDto>> GetListAsync(GetInventoryItemListInput input)
    {
        var items = await QueryAsync(input);

        var page = items
            .OrderBy(x => x.Name)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var names = await GetTaxonomyNamesAsync(page);
        return new PagedResultDto<InventoryItemDto>(items.Count, page.Select(x => MapToDto(x, names)).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Read)]
    public async Task<InventoryStatsDto> GetStatsAsync(GetInventoryItemListInput input)
    {
        var items = await QueryAsync(input);
        var today = Today();

        return new InventoryStatsDto
        {
            Total = items.Count,
            Available = items.Count(x => x.StatusAsOf(today) == SupplyStatus.Available),
            LowStock = items.Count(x => x.StatusAsOf(today) == SupplyStatus.LowStock),
            OutOfStock = items.Count(x => x.StatusAsOf(today) == SupplyStatus.OutOfStock),
            ExpiringSoon = items.Count(x => x.StatusAsOf(today) == SupplyStatus.ExpiringSoon),
            Expired = items.Count(x => x.StatusAsOf(today) == SupplyStatus.Expired),
            StockValue = items.Sum(x => x.QuantityOnHand * (x.UnitCost ?? 0m))
        };
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Read)]
    public async Task<InventoryItemDto> GetAsync(Guid id)
    {
        var item = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(item.BranchId);
        return MapToDto(item, await GetTaxonomyNamesAsync([item]));
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Create)]
    public async Task<InventoryItemDto> CreateAsync(CreateInventoryItemDto input)
    {
        await _branchAccess.CheckAsync(input.BranchId);

        var item = new InventoryItem(
            GuidGenerator.Create(),
            input.ItemCode,
            input.Name,
            input.BranchId,
            input.ReorderLevel,
            input.Category,
            input.Unit,
            input.UnitCost);

        item.UpdateCatalogInfo(
            input.Name,
            input.TaxonomyId,
            input.Supplier,
            input.Origin,
            input.Unit,
            input.UnitCost,
            input.SalePrice);

        await _repository.InsertAsync(item, autoSave: true);
        return MapToDto(item, await GetTaxonomyNamesAsync([item]));
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Update)]
    public async Task<InventoryItemDto> UpdateAsync(Guid id, UpdateInventoryItemDto input)
    {
        var item = await LoadForWriteAsync(id);

        item.UpdateCatalogInfo(
            input.Name,
            input.TaxonomyId,
            input.Supplier,
            input.Origin,
            input.Unit,
            input.UnitCost,
            input.SalePrice);
        item.SetReorderLevel(input.ReorderLevel);

        await _repository.UpdateAsync(item, autoSave: true);
        return MapToDto(item, await GetTaxonomyNamesAsync([item]));
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Update)]
    public async Task<InventoryItemDto> AdjustStockAsync(Guid id, AdjustStockDto input)
    {
        var item = await LoadForWriteAsync(id);

        // Consumption-style movements reduce stock; the rest add to it.
        var reduces = input.MovementType
            is StockMovementType.Consumption
            or StockMovementType.Expired
            or StockMovementType.Damaged
            or StockMovementType.Transfer;

        if (reduces)
        {
            item.ConsumeStock(input.Quantity);
        }
        else
        {
            item.AddStock(input.Quantity, input.Notes);
        }

        await _repository.UpdateAsync(item, autoSave: true);
        return MapToDto(item, await GetTaxonomyNamesAsync([item]));
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Update)]
    public async Task<InventoryItemDto> ReceiveStockAsync(Guid id, ReceiveStockDto input)
    {
        var item = await LoadForWriteAsync(id);

        item.ReceiveStock(input.Quantity, input.StockedAt, input.ExpiryDate, input.ExpiryWarningDays);

        await _repository.UpdateAsync(item, autoSave: true);
        return MapToDto(item, await GetTaxonomyNamesAsync([item]));
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await LoadForWriteAsync(id);
        await _repository.DeleteAsync(id, autoSave: true);
    }

    private async Task<InventoryItem> LoadForWriteAsync(Guid id)
    {
        var item = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(item.BranchId);
        return item;
    }

    /// <summary>
    /// Status is derived, so filtering by it happens in memory after the database
    /// has narrowed the set as far as it can.
    /// </summary>
    private async Task<List<InventoryItem>> QueryAsync(GetInventoryItemListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.BranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.BranchId));
        if (input.TaxonomyId.HasValue)
            query = query.Where(x => x.TaxonomyId == input.TaxonomyId.Value);
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);
        if (input.NeedsReorder == true)
            query = query.Where(x => x.QuantityOnHand <= x.ReorderLevel);
        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim();
            query = query.Where(x => x.Name.Contains(filter) || x.ItemCode.Contains(filter));
        }

        var items = query.ToList();

        if (input.Status.HasValue)
        {
            var today = Today();
            items = items.Where(x => x.StatusAsOf(today) == input.Status.Value).ToList();
        }

        return items;
    }

    private DateOnly Today() => DateOnly.FromDateTime(Clock.Now);

    private async Task<Dictionary<Guid, string>> GetTaxonomyNamesAsync(
        IReadOnlyCollection<InventoryItem> items)
    {
        var ids = items
            .Where(x => x.TaxonomyId.HasValue)
            .Select(x => x.TaxonomyId!.Value)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var query = await _taxonomyRepository.GetQueryableAsync();
        return query.Where(t => ids.Contains(t.Id)).ToDictionary(t => t.Id, t => t.Name);
    }

    private InventoryItemDto MapToDto(InventoryItem entity, IReadOnlyDictionary<Guid, string> names) => new()
    {
        Id = entity.Id,
        ItemCode = entity.ItemCode,
        Name = entity.Name,
        Description = entity.Description,
        TaxonomyId = entity.TaxonomyId,
        TaxonomyName = entity.TaxonomyId.HasValue && names.TryGetValue(entity.TaxonomyId.Value, out var name)
            ? name
            : null,
        Category = entity.Category,
        Unit = entity.Unit,
        StockedAt = entity.StockedAt,
        ExpiryDate = entity.ExpiryDate,
        ExpiryWarningDays = entity.ExpiryWarningDays,
        QuantityOnHand = entity.QuantityOnHand,
        ReorderLevel = entity.ReorderLevel,
        NeedsReorder = entity.NeedsReorder,
        Status = entity.StatusAsOf(Today()),
        Supplier = entity.Supplier,
        Origin = entity.Origin,
        UnitCost = entity.UnitCost,
        SalePrice = entity.SalePrice,
        BranchId = entity.BranchId,
        IsActive = entity.IsActive,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
