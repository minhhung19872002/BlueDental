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

    /// <summary>
    /// The caller sent it, it is not recalled and the edit window is still open
    /// by the server clock (R-1159).
    /// </summary>
    public bool CanEdit { get; set; }

    /// <summary>When the edit window closes; null when the caller may never edit it.</summary>
    public DateTime? EditableUntil { get; set; }

    public List<ChatAttachmentDto> Attachments { get; set; } = [];

    /// <summary>
    /// The patients tagged with # (R-1161), in the order tagged, built for this
    /// viewer when read. Empty on a recalled message.
    /// </summary>
    public List<ChatPatientCardDto> Patients { get; set; } = [];
}

/// <summary>
/// A patient card under a message (R-1161). Never carries the phone number,
/// medical history, allergies or diagnosis. Without Patients.View only the
/// name and Mã KH are filled and <see cref="CanOpen"/> is false.
/// </summary>
public class ChatPatientCardDto
{
    public Guid Id { get; set; }

    /// <summary>The patient was deleted or is no longer in the conversation's branch; nothing else is filled.</summary>
    public bool Missing { get; set; }

    public string? Name { get; set; }

    public string? PatientCode { get; set; }

    public int? YearOfBirth { get; set; }

    /// <summary>The viewer may open the patient record.</summary>
    public bool CanOpen { get; set; }

    /// <summary>Today's appointment (clinic day), the earliest one still standing.</summary>
    public DateTimeOffset? AppointmentAt { get; set; }

    public string? DentistName { get; set; }

    public ChatPatientVisitStatus? VisitStatus { get; set; }

    /// <summary>Nội dung đặt lịch of today's appointment.</summary>
    public string? BookingContent { get; set; }
}

/// <summary>What # suggests while typing (R-1161).</summary>
public class SuggestChatPatientsInput
{
    /// <summary>Name or Mã KH, accent-blind; empty lists today's patients only.</summary>
    [DisableAuditing]
    [StringLength(ChatConsts.MaxPatientSuggestionTextLength)]
    public string? Text { get; set; }
}

public class ChatPatientSuggestionDto
{
    public Guid Id { get; set; }

    public string Name { get; set; } = default!;

    public string PatientCode { get; set; } = default!;

    public int? YearOfBirth { get; set; }

    /// <summary>Today's appointment time, when there is one.</summary>
    public DateTimeOffset? TodayAt { get; set; }

    /// <summary>Received today (has an appointment today or was checked in today).</summary>
    public bool IsToday { get; set; }
}

public class ChatConversationDto
{
    public Guid Id { get; set; }

    public Guid ClinicBranchId { get; set; }

    public ChatConversationKind Kind { get; set; }

    /// <summary>The group name, or the other person's name in a two-person chat.</summary>
    public string Title { get; set; } = default!;

    public string? Name { get; set; }

    /// <summary>The group member who may remove others; null for a two-person chat.</summary>
    public Guid? OwnerId { get; set; }

    /// <summary>The caller owns this group, so the members list offers removing people.</summary>
    public bool IsOwnedByMe { get; set; }

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
    // Room for the # tags' ids; the domain checks the length the reader sees.
    [StringLength(ChatConsts.MaxMessageInputLength)]
    public string? Content { get; set; }

    /// <summary>Files uploaded beforehand by the sender, in the order to show them.</summary>
    public List<Guid> AttachmentIds { get; set; } = [];

    /// <summary>
    /// The patients tagged with # (R-1161), in the order tagged: at most
    /// <see cref="ChatConsts.MaxPatientsPerMessage"/>, all of the conversation's branch.
    /// </summary>
    public List<Guid> PatientIds { get; set; } = [];
}

public class EditChatMessageInput
{
    /// <summary>
    /// Encrypted at rest, so it must never reach the audit log in clear. Empty
    /// is allowed on a message that carries files; the domain decides.
    /// </summary>
    [DisableAuditing]
    // Room for the # tags' ids; the domain checks the length the reader sees.
    [StringLength(ChatConsts.MaxMessageInputLength)]
    public string? Content { get; set; }

    /// <summary>
    /// The message's <c>editedAt</c> when the editor opened (null if never edited);
    /// a different value now means it was edited elsewhere meanwhile (R-1159).
    /// </summary>
    public DateTime? ExpectedEditedAt { get; set; }

    /// <summary>
    /// The patients tagged with # (R-1161), in the order tagged: at most
    /// <see cref="ChatConsts.MaxPatientsPerMessage"/>, all of the conversation's branch.
    /// </summary>
    public List<Guid> PatientIds { get; set; } = [];
}

public class SearchChatMessagesInput
{
    /// <summary>
    /// What to look for in the thread. Sent in a POST body and kept out of the
    /// audit log, because the words people search for are message content too.
    /// </summary>
    [DisableAuditing]
    [Required]
    [StringLength(ChatConsts.MaxSearchTextLength)]
    public string Text { get; set; } = default!;
}

public class ChatMessageSearchResultDto
{
    /// <summary>Newest first, at most <see cref="ChatConsts.MaxSearchResults"/>.</summary>
    public List<ChatMessageDto> Items { get; set; } = [];

    /// <summary>
    /// False when the thread is longer than <see cref="ChatConsts.MaxSearchScan"/>
    /// messages and older ones were not looked at, or when more matched than were returned.
    /// </summary>
    public bool IsComplete { get; set; }
}

/// <summary>An earlier wording of a message (R-1159).</summary>
public class ChatMessageRevisionDto
{
    /// <summary>Null when the message carried only files at that point.</summary>
    public string? Content { get; set; }

    /// <summary>When this wording was replaced.</summary>
    public DateTime EditedAt { get; set; }

    /// <summary>The patients tagged in this wording (R-1161), as cards for the viewer.</summary>
    public List<ChatPatientCardDto> Patients { get; set; } = [];
}

/// <summary>Narrows Kho lưu trữ (R-1160) to one person and/or a span of clinic days.</summary>
public abstract class ChatSharedFilterInput
{
    public Guid? SenderId { get; set; }

    /// <summary>First clinic-local day, inclusive.</summary>
    public DateOnly? SentFrom { get; set; }

    /// <summary>Last clinic-local day, inclusive.</summary>
    public DateOnly? SentTo { get; set; }
}

public class GetChatSharedFilesInput : ChatSharedFilterInput
{
    public ChatSharedFileKind Kind { get; set; } = ChatSharedFileKind.Media;

    [Range(0, int.MaxValue)]
    public int SkipCount { get; set; }

    [Range(1, ChatConsts.MaxSharedFilePageSize)]
    public int MaxResultCount { get; set; } = ChatConsts.DefaultSharedFilePageSize;
}

public class GetChatSharedLinksInput : ChatSharedFilterInput;

/// <summary>Who sent a shared item and when; the item opens the message it came in.</summary>
public abstract class ChatSharedItemDto
{
    public Guid MessageId { get; set; }

    public Guid SenderId { get; set; }

    public string SenderName { get; set; } = default!;

    public DateTime SentAt { get; set; }
}

public class ChatSharedFileDto : ChatSharedItemDto
{
    public ChatAttachmentDto Attachment { get; set; } = default!;
}

public class ChatSharedFilePageDto
{
    /// <summary>Newest message first.</summary>
    public List<ChatSharedFileDto> Items { get; set; } = [];

    public bool HasMore { get; set; }
}

public class ChatSharedLinkDto : ChatSharedItemDto
{
    /// <summary>Always http(s); a bare "www." link gets "https://" in front.</summary>
    public string Url { get; set; } = default!;
}

public class ChatSharedLinkResultDto
{
    /// <summary>Newest first, at most <see cref="ChatConsts.MaxSharedLinks"/>.</summary>
    public List<ChatSharedLinkDto> Items { get; set; } = [];

    /// <summary>False when older messages were not read or more links were found than returned.</summary>
    public bool IsComplete { get; set; }
}
