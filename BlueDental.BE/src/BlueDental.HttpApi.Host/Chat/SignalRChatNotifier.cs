using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Hubs;
using Microsoft.AspNetCore.SignalR;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Chat;

/// <summary>
/// Pokes the members' open screens that a conversation changed. Only the id
/// travels; each screen refetches what its account may read.
/// </summary>
[Dependency(ReplaceServices = true)]
[ExposeServices(typeof(IChatNotifier))]
public class SignalRChatNotifier(IHubContext<NotificationHub> hub) : IChatNotifier, ITransientDependency
{
    public const string EventName = "ChatChanged";

    /// <summary>Someone read the thread (R-1178); only "Đã xem" needs refetching.</summary>
    public const string ReadEventName = "ChatRead";

    public Task NotifyAsync(Guid conversationId, IReadOnlyCollection<Guid> userIds) =>
        SendAsync(EventName, conversationId, userIds);

    public Task NotifyReadAsync(Guid conversationId, IReadOnlyCollection<Guid> userIds) =>
        SendAsync(ReadEventName, conversationId, userIds);

    private Task SendAsync(string eventName, Guid conversationId, IReadOnlyCollection<Guid> userIds) =>
        userIds.Count == 0
            ? Task.CompletedTask
            : hub.Clients.Groups(userIds.Distinct().Select(NotificationHub.UserGroupOf).ToList())
                .SendAsync(eventName, conversationId);
}
