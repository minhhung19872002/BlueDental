using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using BlueDental.CustomerCare.Messaging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.CustomerCare;

/// <summary>Tổng quan ▸ Thống kê CSKH (F-78).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/message-stats")]
public sealed class MessageStatsController(IMessageStatsAppService service) : BlueDentalController
{
    [HttpGet("overview")]
    public Task<MessageStatsOverviewDto> GetOverviewAsync([FromQuery] MessageStatsOverviewInput input) =>
        service.GetOverviewAsync(input);

    [HttpGet("templates")]
    public Task<List<MessageStatsTemplateOptionDto>> GetTemplateOptionsAsync() => service.GetTemplateOptionsAsync();

    [HttpGet("batches")]
    public Task<PagedResultDto<MessageStatsBatchDto>> GetBatchesAsync([FromQuery] MessageStatsPagedInput input) =>
        service.GetBatchesAsync(input);

    [HttpGet("recipients")]
    public Task<PagedResultDto<MessageStatsRecipientDto>> GetRecipientsAsync(
        [FromQuery] GetMessageStatsRecipientsInput input) => service.GetRecipientsAsync(input);

    [HttpGet("excel")]
    public async Task<IActionResult> ExportAsync([FromQuery] MessageStatsExportInput input) =>
        Excel(await service.ExportAsync(input), "thong-ke-cskh");
}
