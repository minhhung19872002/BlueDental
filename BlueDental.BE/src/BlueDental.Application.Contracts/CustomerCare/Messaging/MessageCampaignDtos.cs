using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using BlueDental.PatientManagement;
using BlueDental.Tools;
using Volo.Abp.Application.Dtos;

namespace BlueDental.CustomerCare.Messaging;

public class MessageCampaignPagedInput
{
    [Range(0, int.MaxValue)]
    public int SkipCount { get; set; }

    [Range(1, MessageStatsLimits.MaxPageSize)]
    public int MaxResultCount { get; set; } = 10;
}

public class GetMessageCampaignRecipientsInput : MessageCampaignPagedInput
{
    /// <summary>The tab of "Kết quả lần gửi"; none is "Tất cả".</summary>
    public MessageCampaignOutcome? Outcome { get; set; }
}

/// <summary>What became of one customer of a send, as "Kết quả lần gửi" says it.</summary>
public enum MessageCampaignOutcome
{
    /// <summary>"Thành công": the provider took the message.</summary>
    Succeeded = 1,

    /// <summary>"Thất bại".</summary>
    Failed = 2,

    /// <summary>"Bị loại": left out before the send went.</summary>
    Skipped = 3,

    /// <summary>Still waiting to go.</summary>
    Pending = 4,

    /// <summary>"Đã dừng": was waiting when the send was stopped or called off.</summary>
    Stopped = 5,
}

/// <summary>One row of CSKH ▸ Chiến dịch đã gửi (BA P2210, F-79): one press of Gửi or Hẹn gửi.</summary>
public class MessageCampaignDto : EntityDto<Guid>
{
    public MessageChannelType Channel { get; set; }
    public Guid TemplateId { get; set; }

    /// <summary>The template's name when the send was made.</summary>
    public string TemplateName { get; set; } = string.Empty;

    /// <summary>"Tệp khách hàng": a CSKH tab over a period, or customers picked one by one.</summary>
    public MessageRecipientSource Source { get; set; }

    public CareType? CareType { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }

    /// <summary>"Khách hàng": the customer's name when the send was for one customer.</summary>
    public string? CustomerName { get; set; }

    /// <summary>"Khách đã chọn": the messages to go and the customers left out.</summary>
    public int SelectedCount { get; set; }

    /// <summary>Messages the send was to make.</summary>
    public int RecipientCount { get; set; }

    /// <summary>"Bị loại trước khi gửi".</summary>
    public int SkippedCount { get; set; }

    public int SucceededCount { get; set; }
    public int FailedCount { get; set; }
    public int PendingCount { get; set; }

    /// <summary>Messages a stop kept from going.</summary>
    public int StoppedCount { get; set; }

    public MessageSendBatchStatus Status { get; set; }

    /// <summary>"Hẹn giờ gửi"; null for a send made for now.</summary>
    public DateTime? ScheduledAt { get; set; }

    public DateTime CreationTime { get; set; }

    /// <summary>"Lần chạy gần nhất": when it started going, else when it is set to go, else when it was made.</summary>
    public DateTime LastRunAt { get; set; }
}

/// <summary>"Kết quả lần gửi": the send, its figures and why customers did not get it.</summary>
public class MessageCampaignDetailDto : MessageCampaignDto
{
    /// <summary>The Zalo ZNS template id the messages went out with.</summary>
    public string? ExternalTemplateId { get; set; }

    /// <summary>Who pressed Gửi.</summary>
    public string? SenderName { get; set; }

    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    /// <summary>When it was stopped or called off.</summary>
    public DateTime? CancelledAt { get; set; }

    /// <summary>"Đã nhận": messages the provider reported the customer got.</summary>
    public int DeliveredCount { get; set; }

    /// <summary>"Chi phí": what the provider charged for the messages that went, in VND.</summary>
    public decimal Cost { get; set; }

    /// <summary>"4 tin × 300đ": the price of each charged message, when they all cost the same.</summary>
    public decimal? PricePerMessage { get; set; }

    /// <summary>Messages the provider charged for.</summary>
    public int ChargedCount { get; set; }

    /// <summary>Why messages failed and customers were left out, most first.</summary>
    public List<MessageCampaignReasonDto> Reasons { get; set; } = [];

    /// <summary>The rows behind each tab of the table.</summary>
    public MessageCampaignTabsDto Tabs { get; set; } = new();
}

public class MessageCampaignReasonDto
{
    /// <summary><see cref="MessageCampaignOutcome.Failed"/> or <see cref="MessageCampaignOutcome.Skipped"/>.</summary>
    public MessageCampaignOutcome Outcome { get; set; }

    public MessageSkipReason? SkipReason { get; set; }

    /// <summary>The reason in plain words, in the viewer's language.</summary>
    public string Label { get; set; } = string.Empty;

    public int Count { get; set; }
}

/// <summary>
/// "Tất cả · Thành công · Thất bại · Bị loại". A send made before F-79 kept
/// no row for the customers it left out, so its "Bị loại" tab is empty while
/// <see cref="MessageCampaignDto.SkippedCount"/> still says how many there were.
/// </summary>
public class MessageCampaignTabsDto
{
    public int All { get; set; }
    public int Succeeded { get; set; }
    public int Failed { get; set; }
    public int Skipped { get; set; }
}

/// <summary>One customer of a send.</summary>
public class MessageCampaignRecipientDto : EntityDto<Guid>
{
    public Guid? PatientId { get; set; }
    public string Name { get; set; } = string.Empty;

    [PatientPhone]
    public string? Phone { get; set; }

    public MessageCampaignOutcome Outcome { get; set; }

    /// <summary>"Chi tiết": what happened, in the viewer's language.</summary>
    public string Detail { get; set; } = string.Empty;

    /// <summary>"Thời điểm": when it went or was refused; null for a customer it never tried.</summary>
    public DateTime? At { get; set; }

    /// <summary>"Chi phí", in VND: 0 for a message Zalo refused, null for a customer it never tried.</summary>
    public decimal? Cost { get; set; }
}
