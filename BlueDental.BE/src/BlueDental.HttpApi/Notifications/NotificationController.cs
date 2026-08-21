using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Notifications;

[RemoteService]
[Authorize]
[Route("api/v1/app/notifications")]
public sealed class NotificationController(INotificationAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<NotificationDto>> GetMyNotificationsAsync(
        [FromQuery] GetNotificationListInput input) => service.GetMyNotificationsAsync(input);

    [HttpPost("{id:guid}/read")]
    public Task MarkReadAsync(Guid id) => service.MarkReadAsync(id);

    [HttpPost("read-all")]
    public Task MarkAllReadAsync() => service.MarkAllReadAsync();
}
