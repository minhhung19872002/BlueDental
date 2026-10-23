using System;
using System.Collections.Generic;
using BlueDental.Tools;
using BlueDental.ZaloInbox;

namespace BlueDental.CustomerCare;

/// <summary>What a line of "Lịch sử chăm sóc khách hàng" is.</summary>
public enum CareHistoryKind
{
    /// <summary>A Zalo OA chat message, the customer's or the clinic's.</summary>
    ZaloChat = 1,

    /// <summary>A ZNS / SMS / e-mail the clinic sent the customer.</summary>
    Message = 2,

    /// <summary>A call from Công cụ › Gọi thoại to the record's phone.</summary>
    Call = 3,

    /// <summary>A care note, from the record or from the Zalo chat.</summary>
    Note = 4,

    /// <summary>A CSKH task changed state (Lịch sử liên hệ).</summary>
    Status = 5,
}

/// <summary>The chips over the history: Tất cả · Chat Zalo · ZNS / SMS · Gọi điện · Ghi chú.</summary>
public enum CareHistoryFilter
{
    All = 0,
    ZaloChat = 1,
    Message = 2,
    Call = 3,
    Note = 4,
}

public class GetPatientCareHistoryInput
{
    /// <summary>BA P2210: the period filter applies to the whole history and defaults to all time (both null).</summary>
    public DateTimeOffset? FromDate { get; set; }
    public DateTimeOffset? ToDate { get; set; }
    public CareHistoryFilter Kind { get; set; }
}

/// <summary>One line, newest first. The screen words it from the kind and the fields that kind fills.</summary>
public class CareHistoryEntryDto
{
    public string Key { get; set; } = string.Empty;
    public CareHistoryKind Kind { get; set; }
    public DateTime At { get; set; }
    public string? Text { get; set; }

    /// <summary>Who did it: the staff member, or null for the customer / the system.</summary>
    public string? ActorName { get; set; }

    public ZaloChatDirection? Direction { get; set; }
    public MessageChannelType? Channel { get; set; }
    public string? TemplateName { get; set; }
    public ZaloZnsState? MessageState { get; set; }

    /// <summary>BlueDental.Tools.CallLogStatus as a number, like the call list's DTO: 0 nghe máy, 1 nhỡ, 2 bận.</summary>
    public int? CallStatus { get; set; }
    public CareStatus? CareStatus { get; set; }
    public CareType? CareType { get; set; }

    /// <summary>The note itself, so it can be changed or struck from the history.</summary>
    public CareNoteDto? Note { get; set; }
}

public enum PatientContactState
{
    /// <summary>"Chưa liên hệ": no CSKH message reached the customer in the last 90 days.</summary>
    NotContacted = 0,

    /// <summary>"Đã liên hệ": a CSKH message (one by one or from a send) went out in the last 90 days.</summary>
    Contacted = 1,
}

/// <summary>The right column: Trạng thái chăm sóc and the year's summary.</summary>
public class PatientCareOverviewDto
{
    public PatientContactState ContactState { get; set; }

    /// <summary>BA P2210: 90 days.</summary>
    public int ContactWindowDays { get; set; }

    /// <summary>"Ngày chăm sóc gần nhất": the last CSKH message that went out.</summary>
    public DateTime? LastContactAt { get; set; }

    /// <summary>The Hộp thư Zalo conversation linked to the record, for "Mở chat Zalo".</summary>
    public Guid? ConversationId { get; set; }
    public ZaloConversationStatus? ZaloStatus { get; set; }

    public PatientCareCostSummaryDto Year { get; set; } = new();
}

/// <summary>"Tóm tắt chi phí trong 1 năm": what caring for the customer cost this calendar year.</summary>
public class PatientCareCostSummaryDto
{
    public int Year { get; set; }
    public int ZnsSent { get; set; }
    public int ZnsFailed { get; set; }
    public int SmsSent { get; set; }
    public int ZaloChatMessages { get; set; }
    public int Calls { get; set; }

    /// <summary>What the providers charged for the messages, in VND, where they said.</summary>
    public decimal MessageCost { get; set; }
}
