using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Notifications;

public interface INotificationAppService : IApplicationService
{
    Task<PagedResultDto<NotificationDto>> GetMyNotificationsAsync(GetNotificationListInput input);
    Task MarkReadAsync(Guid id);
    Task MarkAllReadAsync();
}
