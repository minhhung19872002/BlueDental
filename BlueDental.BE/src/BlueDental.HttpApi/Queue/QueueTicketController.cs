using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Queue;

[RemoteService]
[Authorize]
[Route("api/v1/app/queue")]
public sealed class QueueTicketController(IQueueTicketAppService service) : BlueDentalController
{
    [HttpPost("tickets")]
    public Task<QueueTicketDto> CreateAsync([FromBody] CreateQueueTicketDto input) =>
        service.CreateAsync(input);

    [HttpGet("tickets")]
    public Task<PagedResultDto<QueueTicketDto>> GetListAsync(
        [FromQuery] GetQueueTicketListInput input) => service.GetListAsync(input);

    [HttpGet("tickets/{id:guid}")]
    public Task<QueueTicketDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost("tickets/{id:guid}/call")]
    public Task<QueueTicketDto> CallAsync(Guid id, [FromBody] CallTicketInput input) =>
        service.CallAsync(id, input);

    [HttpPost("tickets/call-next")]
    public Task<QueueTicketDto> CallNextAsync([FromBody] CallTicketInput input) =>
        service.CallNextAsync(input);

    [HttpPost("tickets/{id:guid}/serve")]
    public Task<QueueTicketDto> ServeAsync(Guid id) => service.ServeAsync(id);

    [HttpPost("tickets/{id:guid}/complete")]
    public Task<QueueTicketDto> CompleteAsync(Guid id) => service.CompleteAsync(id);

    [HttpPost("tickets/{id:guid}/skip")]
    public Task<QueueTicketDto> SkipAsync(Guid id) => service.SkipAsync(id);

    [HttpPost("tickets/{id:guid}/recall")]
    public Task<QueueTicketDto> RecallAsync(Guid id, [FromBody] CallTicketInput input) =>
        service.RecallAsync(id, input);

    [HttpGet("stats")]
    public Task<QueueStatsDto> GetStatsAsync([FromQuery] DateOnly? date = null, [FromQuery] Guid? counterId = null) =>
        service.GetStatsAsync(date, counterId);

    [HttpGet("display")]
    [AllowAnonymous]
    public Task<List<QueueDisplayDto>> GetDisplayAsync([FromQuery] Guid branchId, [FromQuery] Guid? counterId = null) =>
        service.GetDisplayAsync(branchId, counterId);

    // ── Service Counter endpoints ──

    [HttpGet("counters")]
    public Task<List<ServiceCounterDto>> GetCountersAsync() =>
        service.GetCountersAsync();

    [HttpPost("counters")]
    public Task<ServiceCounterDto> CreateCounterAsync([FromBody] CreateServiceCounterDto input) =>
        service.CreateCounterAsync(input);

    [HttpPut("counters/{id:guid}")]
    public Task<ServiceCounterDto> UpdateCounterAsync(Guid id, [FromBody] UpdateServiceCounterDto input) =>
        service.UpdateCounterAsync(id, input);

    [HttpPost("counters/{id:guid}/toggle")]
    public Task<ServiceCounterDto> ToggleCounterAsync(Guid id) =>
        service.ToggleCounterAsync(id);

    [HttpDelete("counters/{id:guid}")]
    public Task DeleteCounterAsync(Guid id) =>
        service.DeleteCounterAsync(id);
}
