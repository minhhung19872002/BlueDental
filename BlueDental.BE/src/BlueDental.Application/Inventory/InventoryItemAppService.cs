using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Inventory;

[Authorize]
public class InventoryItemAppService : ApplicationService, IInventoryItemAppService
{
    private readonly IRepository<InventoryItem, Guid> _repository;

    public InventoryItemAppService(IRepository<InventoryItem, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Read)]
    public async Task<PagedResultDto<InventoryItemDto>> GetListAsync(GetInventoryItemListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (input.BranchId.HasValue) query = query.Where(i => i.BranchId == input.BranchId.Value);
        if (input.NeedsReorder.HasValue && input.NeedsReorder.Value)
            query = query.Where(i => i.QuantityOnHand <= i.ReorderLevel);

        var totalCount = query.Count();
        var items = query.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<InventoryItemDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<InventoryItem>, System.Collections.Generic.List<InventoryItemDto>>(items));
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Read)]
    public async Task<InventoryItemDto> GetAsync(Guid id)
    {
        var item = await _repository.GetAsync(id);
        return ObjectMapper.Map<InventoryItem, InventoryItemDto>(item);
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Create)]
    public async Task<InventoryItemDto> CreateAsync(CreateInventoryItemDto input)
    {
        var item = new InventoryItem(
            GuidGenerator.Create(),
            input.ItemCode,
            input.Name,
            input.BranchId,
            input.ReorderLevel,
            input.Category,
            input.Unit,
            input.UnitCost);

        await _repository.InsertAsync(item, autoSave: true);
        return ObjectMapper.Map<InventoryItem, InventoryItemDto>(item);
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Update)]
    public async Task<InventoryItemDto> UpdateAsync(Guid id, UpdateInventoryItemDto input)
    {
        var item = await _repository.GetAsync(id);
        await _repository.UpdateAsync(item, autoSave: true);
        return ObjectMapper.Map<InventoryItem, InventoryItemDto>(item);
    }

    [Authorize(BlueDentalAbilityPermissions.Materials.Update)]
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

    [Authorize(BlueDentalAbilityPermissions.Materials.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }
}
