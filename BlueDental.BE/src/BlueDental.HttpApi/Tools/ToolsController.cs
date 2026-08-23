using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Tools;

[RemoteService]
[Authorize]
[Route("api/v1/app/tools")]
public sealed class ToolsController(IToolsAppService service) : BlueDentalController
{
    // ── Call Assignment ───────────────────────────────────────────────────

    [HttpGet("call-assignments")]
    public Task<PagedResultDto<CallAssignmentDto>> GetCallAssignmentListAsync(
        [FromQuery] GetCallAssignmentListInput input) => service.GetCallAssignmentListAsync(input);

    [HttpPost("call-assignments")]
    public Task<CallAssignmentDto> CreateCallAssignmentAsync(CreateCallAssignmentDto input) =>
        service.CreateCallAssignmentAsync(input);

    [HttpPut("call-assignments/{id}/status")]
    public Task<CallAssignmentDto> UpdateCallAssignmentStatusAsync(
        Guid id, UpdateCallAssignmentStatusDto input) =>
        service.UpdateCallAssignmentStatusAsync(id, input);

    [HttpDelete("call-assignments/{id}")]
    public Task DeleteCallAssignmentAsync(Guid id) => service.DeleteCallAssignmentAsync(id);

    // ── Call Log ──────────────────────────────────────────────────────────

    [HttpGet("call-logs")]
    public Task<PagedResultDto<CallLogDto>> GetCallLogListAsync(
        [FromQuery] GetCallLogListInput input) => service.GetCallLogListAsync(input);

    [HttpPost("call-logs")]
    public Task<CallLogDto> CreateCallLogAsync(CreateCallLogDto input) =>
        service.CreateCallLogAsync(input);

    [HttpDelete("call-logs/{id}")]
    public Task DeleteCallLogAsync(Guid id) => service.DeleteCallLogAsync(id);

    // ── Message Template ──────────────────────────────────────────────────

    [HttpGet("message-templates")]
    public Task<PagedResultDto<MessageTemplateDto>> GetMessageTemplateListAsync(
        [FromQuery] GetMessageTemplateListInput input) => service.GetMessageTemplateListAsync(input);

    [HttpPost("message-templates")]
    public Task<MessageTemplateDto> CreateMessageTemplateAsync(CreateMessageTemplateDto input) =>
        service.CreateMessageTemplateAsync(input);

    [HttpPut("message-templates/{id}")]
    public Task<MessageTemplateDto> UpdateMessageTemplateAsync(
        Guid id, UpdateMessageTemplateDto input) =>
        service.UpdateMessageTemplateAsync(id, input);

    [HttpDelete("message-templates/{id}")]
    public Task DeleteMessageTemplateAsync(Guid id) => service.DeleteMessageTemplateAsync(id);

    // ── Message Log ───────────────────────────────────────────────────────

    [HttpGet("message-logs")]
    public Task<PagedResultDto<MessageLogDto>> GetMessageLogListAsync(
        [FromQuery] GetMessageLogListInput input) => service.GetMessageLogListAsync(input);
}
