using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Visits;

[RemoteService]
[Authorize]
[Route("api/v1/app/visits")]
public sealed class VisitController(IVisitAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<VisitDto>> GetListAsync([FromQuery] GetVisitListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<VisitDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<VisitDto> CreateAsync([FromBody] CreateVisitDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<VisitDto> UpdateAsync(Guid id, [FromBody] UpdateVisitDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/check-in")]
    public Task CheckInAsync(Guid id) => service.CheckInAsync(id);

    [HttpPost("{id:guid}/start")]
    public Task StartAsync(Guid id) => service.StartAsync(id);

    [HttpPost("{id:guid}/complete")]
    public Task CompleteAsync(Guid id, [FromBody] string? notes) => service.CompleteAsync(id, notes);

    [HttpPost("{id:guid}/cancel")]
    public Task CancelAsync(Guid id, [FromBody] string reason) => service.CancelAsync(id, reason);

    [HttpPost("{id:guid}/no-show")]
    public Task MarkNoShowAsync(Guid id) => service.MarkNoShowAsync(id);
}
