using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Tools;

public class MessageLog : CreationAuditedEntity<Guid>
{
    public const int MaxExternalIdLength = 100;
    public const int MaxExternalTemplateIdLength = 50;
    public const int MaxTemplateNameLength = 200;
    public const int MaxErrorLength = 500;
    public const int MaxContentLength = 2000;

    public Guid ClinicBranchId { get; private set; }
    public Guid? PatientId { get; private set; }
    public Guid? TemplateId { get; private set; }
    public string RecipientName { get; private set; } = string.Empty;
    public string RecipientPhone { get; private set; } = string.Empty;
    public string Content { get; private set; } = string.Empty;
    public MessageChannelType Channel { get; private set; }
    public MessageSendStatus Status { get; private set; }
    public DateTime? SentAt { get; private set; }
    public string? ErrorMessage { get; private set; }

    /// <summary>The provider's id for the message (Zalo <c>msg_id</c>); what a delivery webhook quotes.</summary>
    public string? ExternalMessageId { get; private set; }

    /// <summary>The provider's template id (Zalo ZNS template) when the message came from one.</summary>
    public string? ExternalTemplateId { get; private set; }

    /// <summary>The human-readable template name at the time the message was sent.</summary>
    public string? TemplateName { get; private set; }

    /// <summary>What the provider charged, in VND, when it says.</summary>
    public decimal? Cost { get; private set; }

    /// <summary>The CSKH ▸ Gửi tin nhắn batch this message belongs to (F-77).</summary>
    public Guid? SendBatchId { get; private set; }

    /// <summary>The CSKH list row the customer was sent from, when the batch came off a list.</summary>
    public Guid? CareRecordId { get; private set; }

    /// <summary>Why a <see cref="MessageSendStatus.Skipped"/> customer got no message (F-79).</summary>
    public MessageSkipReason? SkipReason { get; private set; }

    /// <summary>The message of the same send that went to this customer's phone instead (R05 "Gộp trùng số").</summary>
    public Guid? MergedIntoMessageId { get; private set; }

    private MessageLog() { }

    public MessageLog(
        Guid id, Guid clinicBranchId, Guid? patientId, Guid? templateId,
        string recipientName, string recipientPhone,
        string content, MessageChannelType channel,
        MessageSendStatus status, DateTime? sentAt,
        string? errorMessage)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        PatientId = patientId;
        TemplateId = templateId;
        RecipientName = recipientName;
        RecipientPhone = recipientPhone;
        Content = Clip(content, MaxContentLength) ?? string.Empty;
        Channel = channel;
        Status = status;
        SentAt = sentAt;
        ErrorMessage = Clip(errorMessage, MaxErrorLength);
    }

    /// <summary>
    /// A customer of a send left out before it went (BA P2210, F-79), kept so
    /// "Kết quả lần gửi" can list them with the reason. Never sent, never retried.
    /// </summary>
    public static MessageLog Skip(
        Guid id, Guid clinicBranchId, Guid? patientId, Guid? templateId,
        string recipientName, string? recipientPhone, MessageChannelType channel,
        MessageSkipReason reason, Guid? mergedIntoMessageId = null)
    {
        if ((reason == MessageSkipReason.MergedPhone) != mergedIntoMessageId.HasValue)
        {
            throw new ArgumentException("A merged customer, and only one, names the message it went into.", nameof(mergedIntoMessageId));
        }

        return new MessageLog(id, clinicBranchId, patientId, templateId, recipientName, recipientPhone ?? string.Empty,
            string.Empty, channel, MessageSendStatus.Skipped, null, null)
        {
            SkipReason = reason,
            MergedIntoMessageId = mergedIntoMessageId,
        };
    }

    public MessageLog SetExternalTemplate(string? externalTemplateId, string? templateName = null)
    {
        ExternalTemplateId = Clip(externalTemplateId, MaxExternalTemplateIdLength);
        TemplateName = Clip(templateName, MaxTemplateNameLength);
        return this;
    }

    public MessageLog ForBatch(Guid sendBatchId, Guid? careRecordId)
    {
        SendBatchId = sendBatchId;
        CareRecordId = careRecordId;
        return this;
    }

    /// <summary>
    /// The text actually sent and the number it goes to, worked out again when
    /// the job sends it: a scheduled message picks up the data as it is then,
    /// not when it was booked — a phone changed since goes to the new number (R-1019).
    /// </summary>
    public MessageLog Fill(string content, string recipientPhone)
    {
        if (Status == MessageSendStatus.Pending)
        {
            Content = Clip(content, MaxContentLength) ?? string.Empty;
            RecipientPhone = recipientPhone;
        }

        return this;
    }

    public MessageLog MarkSent(string? externalMessageId, DateTime at, decimal? cost)
    {
        Status = MessageSendStatus.Sent;
        SentAt = at;
        ExternalMessageId = Clip(externalMessageId, MaxExternalIdLength);
        Cost = cost;
        ErrorMessage = null;
        return this;
    }

    public MessageLog MarkFailed(string? error)
    {
        Status = MessageSendStatus.Failed;
        ErrorMessage = Clip(string.IsNullOrWhiteSpace(error) ? "Send failed." : error, MaxErrorLength);
        return this;
    }

    /// <summary>A provider webhook said the recipient got it. Only a sent message can be delivered.</summary>
    public MessageLog MarkDelivered(DateTime at)
    {
        if (Status == MessageSendStatus.Sent)
        {
            Status = MessageSendStatus.Delivered;
            SentAt ??= at;
        }

        return this;
    }

    private static string? Clip(string? value, int max) =>
        value == null || value.Length <= max ? value : value[..max];
}

public enum MessageSendStatus
{
    Pending = 0,
    Sent = 1,
    Failed = 2,
    Delivered = 3,

    /// <summary>Left out of the send before it went — see <see cref="MessageLog.SkipReason"/> (F-79).</summary>
    Skipped = 4,

    /// <summary>Was waiting when the send was stopped or called off; never goes (F-79).</summary>
    Stopped = 5,
}

public static class MessageSendStatuses
{
    /// <summary>
    /// The rows that are messages — waiting, or tried. Skipped and stopped
    /// customers belong only to their send's "Kết quả lần gửi", so counts,
    /// logs and stats read through this.
    /// </summary>
    public static readonly MessageSendStatus[] Messages =
        [MessageSendStatus.Pending, MessageSendStatus.Sent, MessageSendStatus.Failed, MessageSendStatus.Delivered];
}
