using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using BlueDental.CustomerCare;
using BlueDental.PatientManagement;

namespace BlueDental.ZaloInbox;

/// <summary>The four chips over the list: Chưa trả lời · Tôi đang giữ · Đã trả lời · Tất cả.</summary>
public enum ZaloInboxTab
{
    Unreplied = 0,
    Mine = 1,
    Cared = 2,
    All = 3,
}

public class GetZaloConversationsInput
{
    /// <summary>Tên, số điện thoại — name, shared phone, linked record's name / code / phone; marks ignored.</summary>
    [StringLength(100)]
    public string? Filter { get; set; }

    public ZaloInboxTab Tab { get; set; } = ZaloInboxTab.Unreplied;
}

public class ZaloInboxListDto
{
    /// <summary>False: the branch has no live Zalo OA link, so nothing new comes in or goes out.</summary>
    public bool Connected { get; set; }

    public string? OaName { get; set; }

    public List<ZaloConversationSummaryDto> Items { get; set; } = [];

    public ZaloInboxCountsDto Counts { get; set; } = new();
}

public class ZaloInboxCountsDto
{
    public int Unreplied { get; set; }
    public int Mine { get; set; }
    public int Cared { get; set; }
    public int All { get; set; }
}

public class ZaloConversationSummaryDto
{
    public Guid Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }

    [PatientPhone]
    public string? SharedPhone { get; set; }

    public Guid? PatientId { get; set; }
    public string? PatientCode { get; set; }
    public string? PatientName { get; set; }

    [PatientPhone]
    public string? PatientPhone { get; set; }

    public ZaloConversationStatus Status { get; set; }
    public DateTime? LastMessageAt { get; set; }

    [PatientPhone(Embedded = true)]
    public string? LastMessagePreview { get; set; }
    public ZaloChatDirection? LastMessageDirection { get; set; }
    public DateTime? LastCustomerMessageAt { get; set; }

    /// <summary>Only a hold still running; a lapsed one reads as nobody.</summary>
    public Guid? HolderId { get; set; }
    public string? HolderName { get; set; }
    public DateTime? HeldUntil { get; set; }

    public List<string> Tags { get; set; } = [];
}

public class ZaloConversationDetailDto : ZaloConversationSummaryDto
{
    /// <summary>48 hours after the customer last wrote; past it Zalo takes no "tin tư vấn".</summary>
    public DateTime? ReplyWindowEndsAt { get; set; }

    public bool CanReplyFreely { get; set; }

    /// <summary>The linked record's side panel; null while no record is linked.</summary>
    public ZaloCustomerPanelDto? Customer { get; set; }
}

/// <summary>The right column: Lịch hẹn, Dịch vụ đang điều trị, Công nợ of the linked record, in this branch.</summary>
public class ZaloCustomerPanelDto
{
    public Guid PatientId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    [PatientPhone]
    public string? Phone { get; set; }

    /// <summary>"Sắp tới": the next visit still going ahead.</summary>
    public DateTime? NextAppointmentAt { get; set; }

    /// <summary>"Lần khám cuối": the last visit that took place.</summary>
    public DateTime? LastVisitAt { get; set; }

    public List<string> ActiveServices { get; set; } = [];
    public string? DentistName { get; set; }

    /// <summary>False without "Chi phí › Xem": the three amounts are left out.</summary>
    public bool SeesMoney { get; set; }
    public decimal? TotalAmount { get; set; }
    public decimal? PaidAmount { get; set; }
    public decimal? DueAmount { get; set; }
}

public enum ZaloChatEntrySource
{
    /// <summary>A message of the OA chat.</summary>
    Chat = 0,

    /// <summary>A ZNS the branch sent to the linked record's phone (BA P2210: "hiển thị cả tin nhắn gửi từ ZNS").</summary>
    Zns = 1,
}

/// <summary>One bubble of the chat: a chat message, or a ZNS sent to the customer.</summary>
public class ZaloChatEntryDto
{
    public string Key { get; set; } = string.Empty;
    public ZaloChatEntrySource Source { get; set; }
    public ZaloChatDirection Direction { get; set; }
    public ZaloChatKind Kind { get; set; }

    /// <summary>
    /// A sent ZNS / SMS is stored filled in, {so_dien_thoai} included, and a
    /// customer may type their number: phones inside are masked under "Ẩn số
    /// điện thoại", as on the message log screens.
    /// </summary>
    [PatientPhone(Embedded = true)]
    public string Text { get; set; } = string.Empty;

    public string? AttachmentUrl { get; set; }
    public DateTime SentAt { get; set; }

    /// <summary>"Gửi bởi …": the staff member who answered or sent the ZNS.</summary>
    public string? SenderName { get; set; }

    public string? TemplateName { get; set; }
    public ZaloZnsState? ZnsState { get; set; }
}

/// <summary>How far a ZNS in the chat got: Zalo took it, the phone got it, or Zalo refused it.</summary>
public enum ZaloZnsState
{
    Sent = 1,
    Delivered = 2,
    Failed = 3,
}

public class ZaloChatSyncResultDto
{
    /// <summary>Messages Zalo had that the inbox did not.</summary>
    public int Added { get; set; }

    /// <summary>Zalo returned a full page: there may be older messages to fetch.</summary>
    public bool HasMore { get; set; }

    /// <summary>Zalo's refusal, when it refused; what the inbox already holds stays.</summary>
    public string? Error { get; set; }
}

public class SyncZaloConversationInput
{
    /// <summary>0 = the newest messages; each "Tải tin cũ hơn" asks 10 further back.</summary>
    [Range(0, 10_000)]
    public int Offset { get; set; }
}

public class SendZaloChatMessageInput
{
    [Required]
    [StringLength(ZaloInboxConsts.MaxMessageLength)]
    public string Text { get; set; } = string.Empty;
}

public class TransferZaloConversationInput
{
    public Guid UserId { get; set; }
}

public class ZaloInboxAssigneeDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class SetZaloConversationTagsInput
{
    [MaxLength(ZaloInboxConsts.MaxTags * 2)]
    public List<string> Tags { get; set; } = [];
}

public class LinkZaloConversationPatientInput
{
    /// <summary>Null unlinks.</summary>
    public Guid? PatientId { get; set; }
}

public class FindZaloInboxPatientsInput
{
    [StringLength(100)]
    public string? Filter { get; set; }
}

public class ZaloInboxPatientDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;

    [PatientPhone]
    public string? Phone { get; set; }
}

/// <summary>A branch Zalo template "Sẵn sàng" to send: the chips show the newest three, "Xem thêm" all.</summary>
public class ZaloInboxTemplateDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public CareType? Purpose { get; set; }
    public string? ExternalTemplateId { get; set; }
    public DateTime CreationTime { get; set; }
}

public class ZaloZnsInput
{
    public Guid TemplateId { get; set; }
}

/// <summary>Why the ZNS cannot go to this customer as it stands.</summary>
public enum ZaloZnsBlock
{
    /// <summary>No patient record is linked to the conversation.</summary>
    NoPatient = 1,

    /// <summary>The linked record has no phone Zalo would take.</summary>
    NoPhone = 2,

    /// <summary>A variable or required ZNS parameter has no value for this customer.</summary>
    MissingData = 3,

    /// <summary>The branch's OA is not linked or switched off.</summary>
    NotConnected = 4,
}

/// <summary>The ZNS filled with the customer in the chat, for checking before it goes.</summary>
public class ZaloZnsPreviewDto
{
    public Guid TemplateId { get; set; }
    public string TemplateName { get; set; } = string.Empty;

    /// <summary>Each ZNS parameter with the value it would carry, masked as the viewer may see it.</summary>
    public List<ZaloZnsParamDto> Params { get; set; } = [];

    /// <summary>Variable keys (or ZNS parameter names) left without a value.</summary>
    public List<string> Missing { get; set; } = [];

    /// <summary>Zalo's image of the template, when it gives one.</summary>
    public string? PreviewUrl { get; set; }

    [PatientPhone]
    public string? Phone { get; set; }

    public decimal? Price { get; set; }

    /// <summary>Null: it can go.</summary>
    public ZaloZnsBlock? Block { get; set; }
}

public class ZaloZnsParamDto
{
    public string Name { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
