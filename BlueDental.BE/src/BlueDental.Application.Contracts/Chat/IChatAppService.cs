using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;

namespace BlueDental.Chat;

/// <summary>Chat nội bộ (F-89): staff talk to each other, one by one or in groups.</summary>
public interface IChatAppService : IApplicationService
{
    Task<List<ChatContactDto>> GetContactsAsync(GetChatContactsInput input);

    Task<List<ChatConversationDto>> GetConversationsAsync(GetChatConversationsInput input);

    Task<ChatConversationDto> GetConversationAsync(Guid id);

    /// <summary>The existing two-person chat with this person, or a new one.</summary>
    Task<ChatConversationDto> OpenDirectAsync(CreateDirectChatInput input);

    Task<ChatConversationDto> CreateGroupAsync(CreateGroupChatInput input);

    Task<ChatConversationDto> RenameAsync(Guid id, RenameChatInput input);

    Task<ChatConversationDto> AddMembersAsync(Guid id, AddChatMembersInput input);

    Task LeaveAsync(Guid id);

    /// <summary>The group owner takes someone out; they stop seeing the group at once.</summary>
    Task RemoveMemberAsync(Guid id, Guid userId);

    Task MarkReadAsync(Guid id);

    Task<ChatMessagePageDto> GetMessagesAsync(Guid id, GetChatMessagesInput input);

    /// <summary>Messages of the thread whose text holds every word, accents ignored.</summary>
    Task<ChatMessageSearchResultDto> SearchMessagesAsync(Guid id, SearchChatMessagesInput input);

    /// <summary>Kho lưu trữ (R-1160): pictures or other files sent in the thread, newest first.</summary>
    Task<ChatSharedFilePageDto> GetSharedFilesAsync(Guid id, GetChatSharedFilesInput input);

    /// <summary>Kho lưu trữ (R-1160): web links written in the thread, newest first.</summary>
    Task<ChatSharedLinkResultDto> GetSharedLinksAsync(Guid id, GetChatSharedLinksInput input);

    Task<ChatAttachmentDto> UploadAttachmentAsync(Guid id, IRemoteStreamContent file);

    Task<ChatMessageDto> SendAsync(Guid id, SendChatMessageInput input);

    Task<ChatMessageDto> EditMessageAsync(Guid messageId, EditChatMessageInput input);

    Task<ChatMessageDto> RecallMessageAsync(Guid messageId);

    /// <summary>Earlier wordings of a message, newest first; none once it is recalled (R-1159).</summary>
    Task<List<ChatMessageRevisionDto>> GetMessageRevisionsAsync(Guid messageId);

    Task<IRemoteStreamContent> GetAttachmentAsync(Guid messageId, Guid attachmentId);

    Task<ChatUnreadCountDto> GetUnreadCountAsync();
}

/// <summary>
/// Tells the members' open screens that a conversation changed, so they
/// refetch; nothing about the message travels over the push.
/// </summary>
public interface IChatNotifier
{
    Task NotifyAsync(Guid conversationId, IReadOnlyCollection<Guid> userIds);
}
