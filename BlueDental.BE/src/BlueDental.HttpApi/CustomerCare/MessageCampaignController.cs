using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using BlueDental.CustomerCare.Messaging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.CustomerCare;

/// <summary>CSKH ▸ Chiến dịch đã gửi and Kết quả lần gửi (F-79).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/message-campaigns")]
public sealed class MessageCampaignController(IMessageCampaignAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<MessageCampaignDto>> GetListAsync([FromQuery] MessageCampaignPagedInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<MessageCampaignDetailDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpGet("{id:guid}/recipients")]
    public Task<PagedResultDto<MessageCampaignRecipientDto>> GetRecipientsAsync(
        Guid id, [FromQuery] GetMessageCampaignRecipientsInput input) => service.GetRecipientsAsync(id, input);

    [HttpPost("{id:guid}/stop")]
    public Task<MessageCampaignDto> StopAsync(Guid id) => service.StopAsync(id);

    [HttpGet("{id:guid}/failures-excel")]
    public async Task<IActionResult> ExportFailuresAsync(Guid id) =>
        Excel(await service.ExportFailuresAsync(id), "ket-qua-lan-gui");
}
