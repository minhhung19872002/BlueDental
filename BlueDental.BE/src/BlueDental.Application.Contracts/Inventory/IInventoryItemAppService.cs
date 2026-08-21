using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Inventory;

public interface IInventoryItemAppService : IApplicationService
{
    Task<PagedResultDto<InventoryItemDto>> GetListAsync(GetInventoryItemListInput input);
    Task<InventoryItemDto> GetAsync(Guid id);
    Task<InventoryItemDto> CreateAsync(CreateInventoryItemDto input);
    Task<InventoryItemDto> UpdateAsync(Guid id, UpdateInventoryItemDto input);
    Task<InventoryItemDto> AdjustStockAsync(Guid id, AdjustStockDto input);
    Task DeleteAsync(Guid id);
}
