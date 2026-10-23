using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.ZaloInbox;

/// <summary>CSKH ▸ Hộp thư Zalo (F-80).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/zalo-inbox")]
public sealed class ZaloInboxController(
    IZaloInboxAppService inbox,
    IZaloInboxZnsAppService zns) : BlueDentalController
{
    [HttpGet("conversations")]
    public Task<ZaloInboxListDto> GetListAsync([FromQuery] GetZaloConversationsInput input) => inbox.GetListAsync(input);

    [HttpGet("counts")]
    public Task<ZaloInboxCountsDto> GetCountsAsync() => inbox.GetCountsAsync();

    [HttpGet("conversations/{id:guid}")]
    public Task<ZaloConversationDetailDto> GetAsync(Guid id) => inbox.GetAsync(id);

    [HttpGet("conversations/{id:guid}/messages")]
    public Task<List<ZaloChatEntryDto>> GetMessagesAsync(Guid id) => inbox.GetMessagesAsync(id);

    [HttpPost("sync")]
    public Task<ZaloChatSyncResultDto> SyncRecentAsync() => inbox.SyncRecentAsync();

    [HttpPost("conversations/{id:guid}/sync")]
    public Task<ZaloChatSyncResultDto> SyncConversationAsync(Guid id, [FromBody] SyncZaloConversationInput input) =>
        inbox.SyncConversationAsync(id, input);

    [HttpPost("conversations/{id:guid}/claim")]
    public Task<ZaloConversationDetailDto> ClaimAsync(Guid id) => inbox.ClaimAsync(id);

    [HttpPost("conversations/{id:guid}/release")]
    public Task<ZaloConversationDetailDto> ReleaseAsync(Guid id) => inbox.ReleaseAsync(id);

    [HttpPost("conversations/{id:guid}/transfer")]
    public Task<ZaloConversationDetailDto> TransferAsync(Guid id, [FromBody] TransferZaloConversationInput input) =>
        inbox.TransferAsync(id, input);

    [HttpGet("assignees")]
    public Task<List<ZaloInboxAssigneeDto>> GetAssigneesAsync() => inbox.GetAssigneesAsync();

    [HttpPost("conversations/{id:guid}/messages")]
    public Task<ZaloChatEntryDto> SendMessageAsync(Guid id, [FromBody] SendZaloChatMessageInput input) =>
        inbox.SendMessageAsync(id, input);

    [HttpPut("conversations/{id:guid}/tags")]
    public Task<List<string>> SetTagsAsync(Guid id, [FromBody] SetZaloConversationTagsInput input) =>
        inbox.SetTagsAsync(id, input);

    [HttpGet("tags")]
    public Task<List<string>> GetTagSuggestionsAsync() => inbox.GetTagSuggestionsAsync();

    [HttpPut("conversations/{id:guid}/patient")]
    public Task<ZaloConversationDetailDto> LinkPatientAsync(Guid id, [FromBody] LinkZaloConversationPatientInput input) =>
        inbox.LinkPatientAsync(id, input);

    [HttpGet("patients")]
    public Task<List<ZaloInboxPatientDto>> FindPatientsAsync([FromQuery] FindZaloInboxPatientsInput input) =>
        inbox.FindPatientsAsync(input);

    [HttpGet("zns-templates")]
    public Task<List<ZaloInboxTemplateDto>> GetTemplatesAsync() => zns.GetTemplatesAsync();

    [HttpPost("conversations/{id:guid}/zns/preview")]
    public Task<ZaloZnsPreviewDto> PreviewZnsAsync(Guid id, [FromBody] ZaloZnsInput input) => zns.PreviewAsync(id, input);

    [HttpPost("conversations/{id:guid}/zns")]
    public Task<ZaloChatEntryDto> SendZnsAsync(Guid id, [FromBody] ZaloZnsInput input) => zns.SendAsync(id, input);
}
