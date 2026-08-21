using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Users;

namespace BlueDental.Notifications;

[Authorize]
public class NotificationAppService : ApplicationService, INotificationAppService
{
    private readonly IRepository<Notification, Guid> _repository;
    private readonly ICurrentUser _currentUser;

    public NotificationAppService(
        IRepository<Notification, Guid> repository,
        ICurrentUser currentUser)
    {
        _repository = repository;
        _currentUser = currentUser;
    }

    public async Task<PagedResultDto<NotificationDto>> GetMyNotificationsAsync(
        GetNotificationListInput input)
    {
        var userId = _currentUser.GetId();
        var query = await _repository.GetQueryableAsync();
        query = query.Where(n => n.RecipientUserId == userId);

        if (input.Status.HasValue) query = query.Where(n => n.DeliveryStatus == input.Status.Value);
        if (input.Type.HasValue) query = query.Where(n => n.Type == input.Type.Value);

        var totalCount = query.Count();
        var items = query.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<NotificationDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<Notification>, System.Collections.Generic.List<NotificationDto>>(items));
    }

    public async Task MarkReadAsync(Guid id)
    {
        var notification = await _repository.GetAsync(id);
        notification.MarkRead();
        await _repository.UpdateAsync(notification, autoSave: true);
    }

    public async Task MarkAllReadAsync()
    {
        var userId = _currentUser.GetId();
        var query = await _repository.GetQueryableAsync();
        var unread = query
            .Where(n => n.RecipientUserId == userId
                        && n.DeliveryStatus != DeliveryStatus.Read)
            .ToList();

        foreach (var n in unread) n.MarkRead();
        await _repository.UpdateManyAsync(unread, autoSave: true);
    }
}
