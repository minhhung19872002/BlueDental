using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Notifications;

/// <summary>
/// Aggregate root for in-app/email/SMS notifications sent to clinic staff or patients.
/// </summary>
public class Notification : AuditedAggregateRoot<Guid>
{
    public Guid? RecipientUserId { get; private set; }
    public string? RecipientEmail { get; private set; }
    public NotificationType Type { get; private set; }
    public NotificationChannel Channel { get; private set; }
    public string Subject { get; private set; } = default!;
    public string Body { get; private set; } = default!;
    public DeliveryStatus DeliveryStatus { get; private set; }
    public string? FailureReason { get; private set; }
    public DateTimeOffset? SentAt { get; private set; }
    public DateTimeOffset? ReadAt { get; private set; }
    public string? ReferenceEntityType { get; private set; }
    public Guid? ReferenceEntityId { get; private set; }

    protected Notification() { }

    public Notification(
        Guid id,
        NotificationType type,
        NotificationChannel channel,
        string subject,
        string body,
        Guid? recipientUserId = null,
        string? recipientEmail = null,
        string? referenceEntityType = null,
        Guid? referenceEntityId = null)
        : base(id)
    {
        Type = type;
        Channel = channel;
        Subject = subject;
        Body = body;
        RecipientUserId = recipientUserId;
        RecipientEmail = recipientEmail;
        ReferenceEntityType = referenceEntityType;
        ReferenceEntityId = referenceEntityId;
        DeliveryStatus = DeliveryStatus.Pending;
    }

    public Notification MarkSent()
    {
        DeliveryStatus = DeliveryStatus.Sent;
        SentAt = DateTimeOffset.UtcNow;
        return this;
    }

    public Notification MarkDelivered()
    {
        DeliveryStatus = DeliveryStatus.Delivered;
        return this;
    }

    public Notification MarkRead()
    {
        DeliveryStatus = DeliveryStatus.Read;
        ReadAt = DateTimeOffset.UtcNow;
        return this;
    }

    public Notification MarkFailed(string reason)
    {
        DeliveryStatus = DeliveryStatus.Failed;
        FailureReason = reason;
        return this;
    }
}
