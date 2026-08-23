using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Inventory;

[RemoteService]
[Authorize]
[Route("api/v1/app/inventory-items")]
public sealed class InventoryItemController(IInventoryItemAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<InventoryItemDto>> GetListAsync(
        [FromQuery] GetInventoryItemListInput input) => service.GetListAsync(input);

    [HttpGet("stats")]
    public Task<InventoryStatsDto> GetStatsAsync([FromQuery] GetInventoryItemListInput input) =>
        service.GetStatsAsync(input);

    [HttpGet("{id:guid}")]
    public Task<InventoryItemDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<InventoryItemDto> CreateAsync([FromBody] CreateInventoryItemDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<InventoryItemDto> UpdateAsync(Guid id, [FromBody] UpdateInventoryItemDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/receive-stock")]
    public Task<InventoryItemDto> ReceiveStockAsync(Guid id, [FromBody] ReceiveStockDto input) =>
        service.ReceiveStockAsync(id, input);

    [HttpPost("{id:guid}/adjust-stock")]
    public Task<InventoryItemDto> AdjustStockAsync(Guid id, [FromBody] AdjustStockDto input) =>
        service.AdjustStockAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
