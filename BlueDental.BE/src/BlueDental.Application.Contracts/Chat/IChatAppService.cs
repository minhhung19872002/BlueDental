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

    Task MarkReadAsync(Guid id);

    Task<ChatMessagePageDto> GetMessagesAsync(Guid id, GetChatMessagesInput input);

    Task<ChatAttachmentDto> UploadAttachmentAsync(Guid id, IRemoteStreamContent file);

    Task<ChatMessageDto> SendAsync(Guid id, SendChatMessageInput input);

    Task<ChatMessageDto> EditMessageAsync(Guid messageId, EditChatMessageInput input);

    Task<ChatMessageDto> RecallMessageAsync(Guid messageId);

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
