using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using BlueDental.PatientManagement;
using BlueDental.Tools;
using Volo.Abp.Application.Dtos;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// The bar over Tổng quan ▸ Thống kê CSKH: a period of clinic-local days, a
/// channel, a template. No period is the current month up to today.
/// </summary>
public class MessageStatsFilterInput
{
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }

    public MessageChannelType? Channel { get; set; }
    public Guid? TemplateId { get; set; }
}

public class MessageStatsOverviewInput : MessageStatsFilterInput
{
    /// <summary>"So sánh kỳ trước": the period the picker puts before the one shown.</summary>
    public DateOnly? CompareFromDate { get; set; }
    public DateOnly? CompareToDate { get; set; }
}

public class MessageStatsPagedInput : MessageStatsFilterInput
{
    [Range(0, int.MaxValue)]
    public int SkipCount { get; set; }

    [Range(1, MessageStatsLimits.MaxPageSize)]
    public int MaxResultCount { get; set; } = 10;
}

public class GetMessageStatsRecipientsInput : MessageStatsPagedInput
{
    /// <summary>Name or phone; accents are ignored.</summary>
    [StringLength(200)]
    public string? Filter { get; set; }

    public MessageStatsOutcome? Outcome { get; set; }

    /// <summary><c>at</c> or <c>name</c>, then <c>asc</c> / <c>desc</c>; newest first otherwise.</summary>
    [StringLength(50)]
    public string? Sorting { get; set; }
}

/// <summary>The Excel takes the bar and the "Người nhận" search with it.</summary>
public class MessageStatsExportInput : MessageStatsFilterInput
{
    [StringLength(200)]
    public string? Filter { get; set; }

    public MessageStatsOutcome? Outcome { get; set; }
}

/// <summary>What became of one message, as "Người nhận" says it.</summary>
public enum MessageStatsOutcome
{
    /// <summary>"Đã nhận": the provider took it (sent or delivered).</summary>
    Succeeded = 1,

    /// <summary>"Thất bại".</summary>
    Failed = 2,

    /// <summary>"Đang gửi" / "Đã hẹn giờ": not tried yet.</summary>
    Pending = 3,
}

public class MessageStatsOverviewDto
{
    public MessageStatsTotalsDto Totals { get; set; } = new();

    /// <summary>The same figures over the compared period, when one was asked for.</summary>
    public MessageStatsTotalsDto? Previous { get; set; }

    /// <summary>"Tin đã gửi theo ngày": every day of the period, empty days included.</summary>
    public List<MessageStatsDayDto> Days { get; set; } = [];

    /// <summary>"Theo kênh": SMS, Zalo, Email, always all three.</summary>
    public List<MessageStatsChannelDto> Channels { get; set; } = [];

    /// <summary>"Hiệu suất theo mẫu", most sent first.</summary>
    public List<MessageStatsTemplateDto> Templates { get; set; } = [];
}

public class MessageStatsTotalsDto
{
    /// <summary>"Tin đã gửi": every message tried, whether it went or not; waiting ones are not counted.</summary>
    public int Sent { get; set; }

    /// <summary>"Gửi thành công".</summary>
    public int Succeeded { get; set; }

    /// <summary>"Thất bại".</summary>
    public int Failed { get; set; }
}

public class MessageStatsDayDto
{
    public DateOnly Date { get; set; }
    public int Sent { get; set; }
    public int Succeeded { get; set; }
    public int Failed { get; set; }
}

public class MessageStatsChannelDto
{
    public MessageChannelType Channel { get; set; }
    public int Sent { get; set; }
    public int Succeeded { get; set; }
}

public class MessageStatsTemplateDto
{
    /// <summary>Null for a message of the older Công cụ screen that named no template.</summary>
    public Guid? TemplateId { get; set; }

    public string Name { get; set; } = string.Empty;
    public MessageChannelType Channel { get; set; }

    /// <summary>"Lần dùng … chiến dịch": the sends that used it; a message sent on its own is one.</summary>
    public int Uses { get; set; }

    public int Sent { get; set; }
    public int Succeeded { get; set; }

    /// <summary>"Lần cuối".</summary>
    public DateTime? LastSentAt { get; set; }
}

/// <summary>One entry of the "Mẫu" select.</summary>
public class MessageStatsTemplateOptionDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public MessageChannelType Channel { get; set; }
}

/// <summary>One row of "Lịch sử gửi": one press of Gửi or Hẹn gửi.</summary>
public class MessageStatsBatchDto : EntityDto<Guid>
{
    /// <summary>"Thời gian": the time it was set for, or when it was sent.</summary>
    public DateTime At { get; set; }

    public MessageChannelType Channel { get; set; }
    public Guid TemplateId { get; set; }
    public string TemplateName { get; set; } = string.Empty;

    /// <summary>"Tệp khách hàng": a CSKH tab over a period, or customers picked one by one.</summary>
    public MessageRecipientSource Source { get; set; }

    public CareType? CareType { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }

    /// <summary>"Người gửi".</summary>
    public string? SenderName { get; set; }

    public int RecipientCount { get; set; }
    public int SentCount { get; set; }
    public int FailedCount { get; set; }
    public int PendingCount { get; set; }
    public MessageSendBatchStatus Status { get; set; }
    public DateTime? ScheduledAt { get; set; }
}

/// <summary>One row of "Người nhận": one message to one customer.</summary>
public class MessageStatsRecipientDto : EntityDto<Guid>
{
    public Guid? PatientId { get; set; }
    public string Name { get; set; } = string.Empty;

    [PatientPhone]
    public string? Phone { get; set; }

    /// <summary>"Mẫu đã nhận".</summary>
    public string? TemplateName { get; set; }

    public MessageChannelType Channel { get; set; }

    /// <summary>When it went, was refused, or is set to go.</summary>
    public DateTime At { get; set; }

    public MessageStatsOutcome Outcome { get; set; }

    /// <summary>What the provider or the sender said when it failed.</summary>
    public string? Error { get; set; }

    /// <summary>A waiting message whose send is set for later ("Đã hẹn giờ").</summary>
    public bool Scheduled { get; set; }
}

public static class MessageStatsLimits
{
    public const int MaxPageSize = 100;

    /// <summary>About five years: a period the day chart and the Excel can still carry.</summary>
    public const int MaxPeriodDays = 1830;
}
