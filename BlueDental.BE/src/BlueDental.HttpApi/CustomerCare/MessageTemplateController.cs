using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using BlueDental.CustomerCare.Messaging;
using BlueDental.Zalo;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.CustomerCare;

/// <summary>CSKH ▸ Template tin nhắn (F-76).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/message-templates")]
public sealed class MessageTemplateController(IMessageTemplateAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<MessageTemplateListDto> GetListAsync([FromQuery] GetMessageTemplateListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<MessageTemplateDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<MessageTemplateDto> CreateAsync([FromBody] CreateMessageTemplateInput input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<MessageTemplateDto> UpdateAsync(Guid id, [FromBody] SaveMessageTemplateInput input) =>
        service.UpdateAsync(id, input);

    [HttpPost("{id:guid}/duplicate")]
    public Task<MessageTemplateDto> DuplicateAsync(Guid id) => service.DuplicateAsync(id);

    [HttpGet("variables")]
    public Task<List<MessageVariableDto>> GetVariablesAsync() => service.GetVariablesAsync();

    [HttpGet("sample-customer")]
    public Task<MessageSampleCustomerDto> GetSampleCustomerAsync([FromQuery] Guid? exceptPatientId) =>
        service.GetSampleCustomerAsync(exceptPatientId);

    [HttpPost("preview")]
    public Task<MessagePreviewDto> PreviewAsync([FromBody] PreviewMessageTemplateInput input) =>
        service.PreviewAsync(input);

    [HttpGet("zns-templates")]
    public Task<List<ZaloTemplateDto>> GetZnsTemplatesAsync() => service.GetZnsTemplatesAsync();

    [HttpGet("zns-templates/{templateId}")]
    public Task<ZaloTemplateDetailDto> GetZnsTemplateAsync(string templateId) =>
        service.GetZnsTemplateAsync(templateId);

    [HttpPost("sync-zalo-status")]
    public Task<SyncZaloTemplateStatusDto> SyncZaloStatusAsync() => service.SyncZaloStatusAsync();
}
