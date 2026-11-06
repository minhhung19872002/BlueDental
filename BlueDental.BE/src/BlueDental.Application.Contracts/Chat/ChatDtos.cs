using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Auditing;

namespace BlueDental.Chat;

/// <summary>Someone the caller can start a chat with in the selected branch.</summary>
public class ChatContactDto
{
    public Guid Id { get; set; }

    public string FullName { get; set; } = default!;

    public string UserName { get; set; } = default!;
}

public class ChatMemberDto
{
    public Guid UserId { get; set; }

    public string FullName { get; set; } = default!;
}

public class ChatAttachmentDto
{
    public Guid Id { get; set; }

    public string FileName { get; set; } = default!;

    public string ContentType { get; set; } = default!;

    public long SizeInBytes { get; set; }

    public bool IsImage { get; set; }
}

/// <summary>
/// A message as the thread shows it. A recalled one keeps its place but comes
/// without its text or files.
/// </summary>
public class ChatMessageDto
{
    public Guid Id { get; set; }

    public Guid ConversationId { get; set; }

    public Guid SenderId { get; set; }

    public string SenderName { get; set; } = default!;

    public bool IsMine { get; set; }

    public string? Content { get; set; }

    public DateTime SentAt { get; set; }

    public DateTime? EditedAt { get; set; }

    public bool IsRecalled { get; set; }

    public List<ChatAttachmentDto> Attachments { get; set; } = [];
}

public class ChatConversationDto
{
    public Guid Id { get; set; }

    public Guid ClinicBranchId { get; set; }

    public ChatConversationKind Kind { get; set; }

    /// <summary>The group name, or the other person's name in a two-person chat.</summary>
    public string Title { get; set; } = default!;

    public string? Name { get; set; }

    public List<ChatMemberDto> Members { get; set; } = [];

    public ChatMessageDto? LastMessage { get; set; }

    public DateTime LastActivityAt { get; set; }

    public int UnreadCount { get; set; }
}

public class ChatMessagePageDto
{
    /// <summary>Newest first.</summary>
    public List<ChatMessageDto> Items { get; set; } = [];

    public bool HasMore { get; set; }
}

public class ChatUnreadCountDto
{
    public int Count { get; set; }
}

public class GetChatContactsInput
{
    [StringLength(100)]
    public string? Filter { get; set; }
}

public class GetChatConversationsInput
{
    [StringLength(100)]
    public string? Filter { get; set; }
}

public class CreateDirectChatInput
{
    [Required]
    public Guid UserId { get; set; }
}

public class CreateGroupChatInput
{
    [Required]
    [StringLength(ChatConsts.MaxGroupNameLength)]
    public string Name { get; set; } = default!;

    [Required]
    public List<Guid> MemberIds { get; set; } = [];
}

public class RenameChatInput
{
    [Required]
    [StringLength(ChatConsts.MaxGroupNameLength)]
    public string Name { get; set; } = default!;
}

public class AddChatMembersInput
{
    [Required]
    public List<Guid> UserIds { get; set; } = [];
}

public class GetChatMessagesInput
{
    /// <summary>Older than this message; null for the newest page.</summary>
    public Guid? BeforeId { get; set; }

    [Range(1, ChatConsts.MaxMessagePageSize)]
    public int MaxResultCount { get; set; } = ChatConsts.DefaultMessagePageSize;
}

public class SendChatMessageInput
{
    /// <summary>Encrypted at rest, so it must never reach the audit log in clear.</summary>
    [DisableAuditing]
    [StringLength(ChatConsts.MaxMessageLength)]
    public string? Content { get; set; }

    /// <summary>Files uploaded beforehand by the sender, in the order to show them.</summary>
    public List<Guid> AttachmentIds { get; set; } = [];
}

public class EditChatMessageInput
{
    /// <summary>Encrypted at rest, so it must never reach the audit log in clear.</summary>
    [DisableAuditing]
    [Required]
    [StringLength(ChatConsts.MaxMessageLength)]
    public string Content { get; set; } = default!;
}
