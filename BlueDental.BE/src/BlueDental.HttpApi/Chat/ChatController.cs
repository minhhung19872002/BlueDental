using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Volo.Abp;
using Volo.Abp.Auditing;
using Volo.Abp.Content;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Chat;

/// <summary>Chat nội bộ (F-89).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/chat")]
public sealed class ChatController(IChatAppService service) : BlueDentalController
{
    /// <summary>One file plus the multipart envelope around it.</summary>
    private const long UploadRequestLimit = ChatConsts.MaxAttachmentBytes + 1024 * 1024;

    [HttpGet("contacts")]
    public Task<List<ChatContactDto>> GetContactsAsync([FromQuery] GetChatContactsInput input) =>
        service.GetContactsAsync(input);

    [HttpGet("unread-count")]
    public Task<ChatUnreadCountDto> GetUnreadCountAsync() => service.GetUnreadCountAsync();

    [HttpGet("conversations")]
    public Task<List<ChatConversationDto>> GetConversationsAsync([FromQuery] GetChatConversationsInput input) =>
        service.GetConversationsAsync(input);

    [HttpGet("conversations/{id:guid}")]
    public Task<ChatConversationDto> GetConversationAsync(Guid id) => service.GetConversationAsync(id);

    [HttpPost("conversations/direct")]
    public Task<ChatConversationDto> OpenDirectAsync([FromBody] CreateDirectChatInput input) =>
        service.OpenDirectAsync(input);

    [HttpPost("conversations/group")]
    public Task<ChatConversationDto> CreateGroupAsync([FromBody] CreateGroupChatInput input) =>
        service.CreateGroupAsync(input);

    [HttpPut("conversations/{id:guid}/name")]
    public Task<ChatConversationDto> RenameAsync(Guid id, [FromBody] RenameChatInput input) =>
        service.RenameAsync(id, input);

    [HttpPost("conversations/{id:guid}/members")]
    public Task<ChatConversationDto> AddMembersAsync(Guid id, [FromBody] AddChatMembersInput input) =>
        service.AddMembersAsync(id, input);

    [HttpPost("conversations/{id:guid}/leave")]
    public Task LeaveAsync(Guid id) => service.LeaveAsync(id);

    [HttpDelete("conversations/{id:guid}/members/{userId:guid}")]
    public Task RemoveMemberAsync(Guid id, Guid userId) => service.RemoveMemberAsync(id, userId);

    [HttpPost("conversations/{id:guid}/read")]
    public Task MarkReadAsync(Guid id) => service.MarkReadAsync(id);

    [HttpGet("conversations/{id:guid}/messages")]
    public Task<ChatMessagePageDto> GetMessagesAsync(Guid id, [FromQuery] GetChatMessagesInput input) =>
        service.GetMessagesAsync(id, input);

    /// <remarks>POST, so the words looked for stay out of the URL and the proxy's access log.</remarks>
    [HttpPost("conversations/{id:guid}/messages/search")]
    [EnableRateLimiting(ChatRateLimitPolicies.Search)]
    public Task<ChatMessageSearchResultDto> SearchMessagesAsync(Guid id, [FromBody] SearchChatMessagesInput input) =>
        service.SearchMessagesAsync(id, input);

    [HttpGet("conversations/{id:guid}/shared/files")]
    public Task<ChatSharedFilePageDto> GetSharedFilesAsync(Guid id, [FromQuery] GetChatSharedFilesInput input) =>
        service.GetSharedFilesAsync(id, input);

    /// <remarks>Opens up to 5,000 sealed messages like a search, so it counts as one.</remarks>
    [HttpGet("conversations/{id:guid}/shared/links")]
    [EnableRateLimiting(ChatRateLimitPolicies.Search)]
    public Task<ChatSharedLinkResultDto> GetSharedLinksAsync(Guid id, [FromQuery] GetChatSharedLinksInput input) =>
        service.GetSharedLinksAsync(id, input);

    [HttpPost("conversations/{id:guid}/attachments")]
    [EnableRateLimiting(ChatRateLimitPolicies.Upload)]
    [DisableAuditing] // the multipart headers carry the file name in clear
    [RequestSizeLimit(UploadRequestLimit)]
    [RequestFormLimits(MultipartBodyLengthLimit = UploadRequestLimit)]
    public Task<ChatAttachmentDto> UploadAttachmentAsync(Guid id, [FromForm] IFormFile file) =>
        service.UploadAttachmentAsync(id, new RemoteStreamContent(file.OpenReadStream(), file.FileName, file.ContentType));

    [HttpPost("conversations/{id:guid}/messages")]
    [EnableRateLimiting(ChatRateLimitPolicies.Send)]
    public Task<ChatMessageDto> SendAsync(Guid id, [FromBody] SendChatMessageInput input) =>
        service.SendAsync(id, input);

    [HttpPut("messages/{messageId:guid}")]
    [EnableRateLimiting(ChatRateLimitPolicies.Send)]
    public Task<ChatMessageDto> EditMessageAsync(Guid messageId, [FromBody] EditChatMessageInput input) =>
        service.EditMessageAsync(messageId, input);

    [HttpPost("messages/{messageId:guid}/recall")]
    public Task<ChatMessageDto> RecallMessageAsync(Guid messageId) => service.RecallMessageAsync(messageId);

    [HttpGet("messages/{messageId:guid}/revisions")]
    public Task<List<ChatMessageRevisionDto>> GetMessageRevisionsAsync(Guid messageId) =>
        service.GetMessageRevisionsAsync(messageId);

    [HttpGet("messages/{messageId:guid}/attachments/{attachmentId:guid}")]
    public async Task<IActionResult> GetAttachmentAsync(Guid messageId, Guid attachmentId)
    {
        // A file action is not an object result, so ABP's filter only maps the
        // exception when the caller asked for JSON; a plain link (<a>, <img>)
        // would see a 500 for a recalled or foreign file instead of a 404.
        try
        {
            var content = await service.GetAttachmentAsync(messageId, attachmentId);
            return File(content.GetStream(), content.ContentType ?? "application/octet-stream", content.FileName);
        }
        catch (EntityNotFoundException)
        {
            return NotFound();
        }
    }
}
