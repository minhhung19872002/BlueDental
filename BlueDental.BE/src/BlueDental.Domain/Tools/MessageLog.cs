using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Tools;

public class MessageLog : CreationAuditedEntity<Guid>
{
    public const int MaxExternalIdLength = 100;
    public const int MaxExternalTemplateIdLength = 50;
    public const int MaxErrorLength = 500;

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

    /// <summary>What the provider charged, in VND, when it says.</summary>
    public decimal? Cost { get; private set; }

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
        Content = content;
        Channel = channel;
        Status = status;
        SentAt = sentAt;
        ErrorMessage = Clip(errorMessage, MaxErrorLength);
    }

    public MessageLog SetExternalTemplate(string? externalTemplateId)
    {
        ExternalTemplateId = Clip(externalTemplateId, MaxExternalTemplateIdLength);
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
}
