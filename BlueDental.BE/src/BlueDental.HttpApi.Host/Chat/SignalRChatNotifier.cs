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

    public Task NotifyAsync(Guid conversationId, IReadOnlyCollection<Guid> userIds) =>
        userIds.Count == 0
            ? Task.CompletedTask
            : hub.Clients.Groups(userIds.Distinct().Select(NotificationHub.UserGroupOf).ToList())
                .SendAsync(EventName, conversationId);
}
