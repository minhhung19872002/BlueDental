using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Inventory;

[Authorize(BlueDentalPermissions.Inventory.Default)]
public class InventoryItemAppService : ApplicationService, IInventoryItemAppService
{
    private readonly IRepository<InventoryItem, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public InventoryItemAppService(
        IRepository<InventoryItem, Guid> repository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.Inventory.View)]
    public async Task<PagedResultDto<InventoryItemDto>> GetListAsync(GetInventoryItemListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();
        query = query.Where(i => i.BranchId == branchId);

        // GetInventoryItemListInput has declared Filter, TaxonomyId, Status and
        // IsActive for a while, but only NeedsReorder was ever read. Callers
        // passing the others got an unfiltered list back and no error — which
        // is how the dashboard's "vật tư dưới định mức" came to report every
        // item in the branch, its rows showing stock well above the reorder
        // level.
        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var term = input.Filter.Trim();
            query = query.Where(i => i.Name.Contains(term) || i.ItemCode.Contains(term));
        }

        if (input.TaxonomyId.HasValue)
            query = query.Where(i => i.TaxonomyId == input.TaxonomyId.Value);

        if (input.IsActive.HasValue)
            query = query.Where(i => i.IsActive == input.IsActive.Value);

        if (input.NeedsReorder.HasValue && input.NeedsReorder.Value)
            query = query.Where(i => i.QuantityOnHand <= i.ReorderLevel);

        int totalCount;
        System.Collections.Generic.List<InventoryItem> items;

        if (input.Status.HasValue)
        {
            // Status is derived, not stored: expiry outranks stock level, and
            // the warning window is a per-row column. Rather than restate those
            // rules as a SQL predicate that could drift from the entity's, the
            // branch's items are read and StatusAsOf decides. Paging is applied
            // after filtering so the count and the page agree. Inventory is
            // per-branch and bounded; if that stops holding, this is the place
            // to push the rule into the query.
            var today = DateOnly.FromDateTime(Clock.Now);
            var matching = query
                .ToList()
                .Where(i => i.StatusAsOf(today) == input.Status.Value)
                .ToList();

            totalCount = matching.Count;
            items = matching.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();
        }
        else
        {
            totalCount = query.Count();
            items = query.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();
        }

        return new PagedResultDto<InventoryItemDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<InventoryItem>, System.Collections.Generic.List<InventoryItemDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Inventory.View)]
    public async Task<InventoryItemDto> GetAsync(Guid id)
    {
        var item = await _repository.GetAsync(id);
        return ObjectMapper.Map<InventoryItem, InventoryItemDto>(item);
    }

    [Authorize(BlueDentalPermissions.Inventory.Manage)]
    public async Task<InventoryItemDto> CreateAsync(CreateInventoryItemDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var item = new InventoryItem(
            GuidGenerator.Create(),
            input.ItemCode,
            input.Name,
            branchId,
            input.ReorderLevel,
            input.Category,
            input.Unit,
            input.UnitCost);

        await _repository.InsertAsync(item, autoSave: true);
        return ObjectMapper.Map<InventoryItem, InventoryItemDto>(item);
    }

    [Authorize(BlueDentalPermissions.Inventory.Manage)]
    public async Task<InventoryItemDto> UpdateAsync(Guid id, UpdateInventoryItemDto input)
    {
        var item = await _repository.GetAsync(id);
        item.UpdateCatalogInfo(input.Name, input.TaxonomyId, input.Supplier, input.Origin, input.Unit, input.UnitCost, input.SalePrice);
        item.SetReorderLevel(input.ReorderLevel);
        await _repository.UpdateAsync(item, autoSave: true);
        return ObjectMapper.Map<InventoryItem, InventoryItemDto>(item);
    }

    [Authorize(BlueDentalPermissions.Inventory.AdjustStock)]
    public async Task<InventoryItemDto> AdjustStockAsync(Guid id, AdjustStockDto input)
    {
        var item = await _repository.GetAsync(id);

        if (input.MovementType == StockMovementType.Purchase || input.MovementType == StockMovementType.Return)
        {
            item.AddStock(input.Quantity, input.Notes);
        }
        else if (input.MovementType == StockMovementType.Consumption)
        {
            item.ConsumeStock(input.Quantity);
        }

        await _repository.UpdateAsync(item, autoSave: true);
        return ObjectMapper.Map<InventoryItem, InventoryItemDto>(item);
    }

    [Authorize(BlueDentalPermissions.Inventory.View)]
    public async Task<InventoryStatsDto> GetStatsAsync(GetInventoryItemListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();
        query = query.Where(i => i.BranchId == branchId);

        var items = query.ToList();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        return new InventoryStatsDto
        {
            Total = items.Count,
            Available = items.Count(i => i.StatusAsOf(today) == SupplyStatus.Available),
            LowStock = items.Count(i => i.StatusAsOf(today) == SupplyStatus.LowStock),
            OutOfStock = items.Count(i => i.StatusAsOf(today) == SupplyStatus.OutOfStock),
            ExpiringSoon = items.Count(i => i.StatusAsOf(today) == SupplyStatus.ExpiringSoon),
            Expired = items.Count(i => i.StatusAsOf(today) == SupplyStatus.Expired),
            StockValue = items.Sum(i => i.QuantityOnHand * (i.UnitCost ?? 0m)),
        };
    }

    [Authorize(BlueDentalPermissions.Inventory.AdjustStock)]
    public async Task<InventoryItemDto> ReceiveStockAsync(Guid id, ReceiveStockDto input)
    {
        var item = await _repository.GetAsync(id);
        item.ReceiveStock(input.Quantity, input.StockedAt, input.ExpiryDate, input.ExpiryWarningDays);
        await _repository.UpdateAsync(item, autoSave: true);
        return ObjectMapper.Map<InventoryItem, InventoryItemDto>(item);
    }

    [Authorize(BlueDentalPermissions.Inventory.Manage)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
