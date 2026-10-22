using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using BlueDental.CustomerCare.Messaging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.CustomerCare;

/// <summary>CSKH ▸ Gửi tin nhắn (F-77).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/message-sends")]
public sealed class MessageSendController(IMessageSendAppService service) : BlueDentalController
{
    [HttpGet("templates")]
    public Task<MessageSendTemplatesDto> GetTemplatesAsync() => service.GetTemplatesAsync();

    [HttpGet("lists")]
    public Task<List<MessageSendListDto>> GetListsAsync([FromQuery] GetMessageSendListsInput input) =>
        service.GetListsAsync(input);

    /// <summary>POST: a picked list can hold thousands of customers, too many for a query string.</summary>
    [HttpPost("recipients")]
    public Task<MessageRecipientListDto> GetRecipientsAsync([FromBody] MessageRecipientsInput input) =>
        service.GetRecipientsAsync(input);

    [HttpPost("preview")]
    public Task<MessagePreviewDto> PreviewAsync([FromBody] PreviewMessageSendInput input) =>
        service.PreviewAsync(input);

    [HttpGet("customers")]
    public Task<List<MessageSendCustomerDto>> FindCustomersAsync([FromQuery] FindMessageSendCustomersInput input) =>
        service.FindCustomersAsync(input);

    [HttpPost]
    public Task<MessageSendBatchDto> CreateAsync([FromBody] CreateMessageSendInput input) =>
        service.CreateAsync(input);

    [HttpGet("{id:guid}")]
    public Task<MessageSendBatchDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpGet]
    public Task<List<MessageSendBatchDto>> GetListAsync([FromQuery] GetMessageSendBatchListInput input) =>
        service.GetListAsync(input);

    [HttpPost("{id:guid}/cancel")]
    public Task<MessageSendBatchDto> CancelAsync(Guid id) => service.CancelAsync(id);

    [HttpPost("test")]
    public Task<MessageTestSendDto> SendTestAsync([FromBody] SendTestMessageInput input) =>
        service.SendTestAsync(input);
}
