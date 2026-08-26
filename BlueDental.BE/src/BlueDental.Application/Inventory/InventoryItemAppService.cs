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

namespace BlueDental.Inventory;

[Authorize(BlueDentalPermissions.Inventory.Default)]
public class InventoryItemAppService : ApplicationService, IInventoryItemAppService
{
    private readonly IRepository<InventoryItem, Guid> _repository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public InventoryItemAppService(
        IRepository<InventoryItem, Guid> repository,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _taxonomyRepository = taxonomyRepository;
        _branchResolver = branchResolver;
    }

    /// <summary>
    /// Finishes a mapped row with the two fields AutoMapper cannot reach.
    ///
    /// Status is not a stored column — the entity derives it from stock and
    /// expiry, so mapping alone left every row at the enum's unnamed zero. The
    /// group name lives on Taxonomy, which the item references by id only.
    /// </summary>
    private async Task<List<InventoryItemDto>> ToDtosAsync(List<InventoryItem> items)
    {
        var dtos = ObjectMapper.Map<List<InventoryItem>, List<InventoryItemDto>>(items);
        var today = DateOnly.FromDateTime(Clock.Now);

        var taxonomyIds = items
            .Where(i => i.TaxonomyId.HasValue)
            .Select(i => i.TaxonomyId!.Value)
            .Distinct()
            .ToList();

        var names = new Dictionary<Guid, string>();
        if (taxonomyIds.Count > 0)
        {
            var query = await _taxonomyRepository.GetQueryableAsync();
            names = query
                .Where(t => taxonomyIds.Contains(t.Id))
                .ToDictionary(t => t.Id, t => t.Name);
        }

        for (var i = 0; i < items.Count; i++)
        {
            dtos[i].Status = items[i].StatusAsOf(today);

            if (items[i].TaxonomyId.HasValue
                && names.TryGetValue(items[i].TaxonomyId!.Value, out var name))
            {
                dtos[i].TaxonomyName = name;
            }
        }

        return dtos;
    }

    private async Task<InventoryItemDto> ToDtoAsync(InventoryItem item) =>
        (await ToDtosAsync([item]))[0];

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
        // Every word typed has to appear somewhere in the row, in either field
        // and in any order. Contains() alone is case-sensitive on PostgreSQL,
        // so a search for "gang tay" missed "Găng Tay"; SearchTerms lowercases
        // and splits, and the column is lowered to match.
        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(i =>
                i.Name.ToLower().Contains(term) ||
                i.ItemCode.ToLower().Contains(term));
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

        return new PagedResultDto<InventoryItemDto>(totalCount, await ToDtosAsync(items));
    }

    [Authorize(BlueDentalPermissions.Inventory.View)]
    public async Task<InventoryItemDto> GetAsync(Guid id)
    {
        var item = await _repository.GetAsync(id);
        return await ToDtoAsync(item);
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

        // Everything the form collects, set at once: the group it is filed
        // under, who supplies it, where it comes from, and what it sells for.
        item.UpdateCatalogInfo(
            input.Name,
            input.TaxonomyId,
            input.Supplier,
            input.Origin,
            input.Unit,
            input.UnitCost,
            input.SalePrice);

        // A material is normally created because a delivery arrived, so its
        // first stock and its dates come in with it rather than needing a
        // separate receipt. "Số lượng" is optional on the reference's form,
        // though, and AddStock rightly refuses a receipt of nothing — so an
        // empty quantity records the dates and leaves the stock at zero,
        // rather than failing the whole save.
        if (input.Quantity > 0)
        {
            item.AddStock(input.Quantity);
        }

        item.SetShelfLife(input.StockedAt, input.ExpiryDate, input.ExpiryWarningDays);

        await _repository.InsertAsync(item, autoSave: true);
        return await ToDtoAsync(item);
    }

    [Authorize(BlueDentalPermissions.Inventory.Manage)]
    public async Task<InventoryItemDto> UpdateAsync(Guid id, UpdateInventoryItemDto input)
    {
        var item = await _repository.GetAsync(id);
        item.UpdateCatalogInfo(input.Name, input.TaxonomyId, input.Supplier, input.Origin, input.Unit, input.UnitCost, input.SalePrice);
        item.SetReorderLevel(input.ReorderLevel);
        await _repository.UpdateAsync(item, autoSave: true);
        return await ToDtoAsync(item);
    }

    [Authorize(BlueDentalPermissions.Inventory.AdjustStock)]
    public async Task<InventoryItemDto> AdjustStockAsync(Guid id, AdjustStockDto input)
    {
        var item = await _repository.GetAsync(id);

        // Anything outside these three used to fall through both branches: the
        // call answered 200 with the stock untouched, which reads as a movement
        // that was recorded and was not.
        switch (input.MovementType)
        {
            case StockMovementType.Purchase:
            case StockMovementType.Return:
                item.AddStock(input.Quantity, input.Notes);
                break;

            case StockMovementType.Consumption:
            case StockMovementType.Expired:
                item.ConsumeStock(input.Quantity);
                break;

            default:
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Inventory.InvalidStockMovement,
                    $"Stock movement {input.MovementType} is not supported here.");
        }

        await _repository.UpdateAsync(item, autoSave: true);
        return await ToDtoAsync(item);
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
        return await ToDtoAsync(item);
    }

    [Authorize(BlueDentalPermissions.Inventory.Manage)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
