using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Inventory;

/// <summary>
/// Vật tư phòng khám — reference: <c>/api/v1/supplies/list</c> plus the
/// <c>supplies</c> taxonomy for the group panel.
/// </summary>
public interface IInventoryItemAppService : IApplicationService
{
    Task<PagedResultDto<InventoryItemDto>> GetListAsync(GetInventoryItemListInput input);
    Task<InventoryStatsDto> GetStatsAsync(GetInventoryItemListInput input);
    Task<InventoryItemDto> GetAsync(Guid id);
    Task<InventoryItemDto> CreateAsync(CreateInventoryItemDto input);
    Task<InventoryItemDto> UpdateAsync(Guid id, UpdateInventoryItemDto input);
    Task<InventoryItemDto> AdjustStockAsync(Guid id, AdjustStockDto input);

    /// <summary>Nhập kho — records a receipt together with its expiry.</summary>
    Task<InventoryItemDto> ReceiveStockAsync(Guid id, ReceiveStockDto input);

    Task DeleteAsync(Guid id);
}
