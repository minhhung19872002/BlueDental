using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Labo;

[RemoteService]
[Authorize]
[Route("api/v1/app/labo-orders")]
public sealed class LaboController(ILaboAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<LaboOrderDto>> GetListAsync([FromQuery] GetLaboOrderListInput input) =>
        service.GetListAsync(input);

    [HttpGet("stats")]
    public Task<LaboStatsDto> GetStatsAsync([FromQuery] GetLaboOrderListInput input) =>
        service.GetStatsAsync(input);

    [HttpGet("{id:guid}")]
    public Task<LaboOrderDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<LaboOrderDto> CreateAsync([FromBody] CreateLaboOrderDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<LaboOrderDto> UpdateAsync(Guid id, [FromBody] UpdateLaboOrderDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/send")]
    public Task SendAsync(Guid id) => service.SendAsync(id);

    [HttpPost("{id:guid}/receive")]
    public Task ReceiveAsync(Guid id) => service.ReceiveAsync(id);

    [HttpPost("{id:guid}/complete")]
    public Task CompleteAsync(Guid id) => service.CompleteAsync(id);

    [HttpPost("{id:guid}/reject")]
    public Task RejectAsync(Guid id, [FromBody] string reason) => service.RejectAsync(id, reason);
}
