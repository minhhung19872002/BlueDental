using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Notifications;

public class NotificationDto : EntityDto<Guid>
{
    public NotificationType Type { get; set; }
    public NotificationChannel Channel { get; set; }
    public string Subject { get; set; } = default!;
    public string Body { get; set; } = default!;
    public DeliveryStatus DeliveryStatus { get; set; }
    public DateTimeOffset? SentAt { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
    public string? ReferenceEntityType { get; set; }
    public Guid? ReferenceEntityId { get; set; }
}

public class GetNotificationListInput : PagedAndSortedResultRequestDto
{
    public DeliveryStatus? Status { get; set; }
    public NotificationType? Type { get; set; }
}
