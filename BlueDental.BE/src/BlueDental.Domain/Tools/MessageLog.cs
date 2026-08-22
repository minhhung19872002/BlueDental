using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Tools;

public class MessageLog : CreationAuditedEntity<Guid>
{
    public Guid? PatientId { get; private set; }
    public Guid? TemplateId { get; private set; }
    public string RecipientName { get; private set; } = string.Empty;
    public string RecipientPhone { get; private set; } = string.Empty;
    public string Content { get; private set; } = string.Empty;
    public MessageChannelType Channel { get; private set; }
    public MessageSendStatus Status { get; private set; }
    public DateTime? SentAt { get; private set; }
    public string? ErrorMessage { get; private set; }

    private MessageLog() { }

    public MessageLog(
        Guid id, Guid? patientId, Guid? templateId,
        string recipientName, string recipientPhone,
        string content, MessageChannelType channel,
        MessageSendStatus status, DateTime? sentAt,
        string? errorMessage)
        : base(id)
    {
        PatientId = patientId;
        TemplateId = templateId;
        RecipientName = recipientName;
        RecipientPhone = recipientPhone;
        Content = content;
        Channel = channel;
        Status = status;
        SentAt = sentAt;
        ErrorMessage = errorMessage;
    }
}

public enum MessageSendStatus
{
    Pending = 0,
    Sent = 1,
    Failed = 2,
    Delivered = 3,
}
