using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Marketing;

/// <summary>Marketing → Ticket.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/marketing-tickets")]
public sealed class MarketingTicketController(IMarketingTicketAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<TicketDto>> GetListAsync([FromQuery] GetTicketListInput input) =>
        service.GetListAsync(input);

    [HttpGet("stats")]
    public Task<TicketStatsDto> GetStatsAsync([FromQuery] GetTicketListInput input) =>
        service.GetStatsAsync(input);

    [HttpGet("assignees")]
    public Task<ListResultDto<TicketAssigneeDto>> GetAssigneesAsync([FromQuery] Guid? clinicBranchId) =>
        service.GetAssigneesAsync(clinicBranchId);

    [HttpGet("{id:guid}")]
    public Task<TicketDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpGet("{id:guid}/activities")]
    public Task<List<TicketActivityDto>> GetActivitiesAsync(Guid id) => service.GetActivitiesAsync(id);

    [HttpPost]
    public Task<CreateTicketResultDto> CreateAsync([FromBody] CreateTicketDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<TicketDto> UpdateAsync(Guid id, [FromBody] UpdateTicketDto input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/contacts")]
    public Task<TicketDto> RecordContactAsync(Guid id, [FromBody] RecordTicketContactDto input) =>
        service.RecordContactAsync(id, input);

    [HttpPost("{id:guid}/claim")]
    public Task<TicketDto> ClaimAsync(Guid id) => service.ClaimAsync(id);

    [HttpPost("{id:guid}/assign")]
    public Task<TicketDto> AssignAsync(Guid id, [FromBody] AssignTicketDto input) =>
        service.AssignAsync(id, input);

    [HttpPost("{id:guid}/not-potential")]
    public Task<TicketDto> MarkNotPotentialAsync(Guid id, [FromBody] TicketReasonDto input) =>
        service.MarkNotPotentialAsync(id, input);

    [HttpPost("{id:guid}/reopen")]
    public Task<TicketDto> ReopenAsync(Guid id) => service.ReopenAsync(id);

    [HttpPost("{id:guid}/appointments")]
    public Task<TicketDto> BookAppointmentAsync(Guid id, [FromBody] BookTicketAppointmentDto input) =>
        service.BookAppointmentAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id, [FromBody] TicketReasonDto input) => service.DeleteAsync(id, input);

    [HttpPost("{id:guid}/restore")]
    public Task<TicketDto> RestoreAsync(Guid id) => service.RestoreAsync(id);
}

/// <summary>Marketing → Thẻ ticket.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/marketing-ticket-tags")]
public sealed class MarketingTicketTagController(IMarketingTicketTagAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<ListResultDto<TicketTagDto>> GetListAsync([FromQuery] GetTicketTagListInput input) =>
        service.GetListAsync(input);

    [HttpPost]
    public Task<TicketTagDto> CreateAsync([FromBody] CreateTicketTagDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<TicketTagDto> UpdateAsync(Guid id, [FromBody] UpdateTicketTagDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
