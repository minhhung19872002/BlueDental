using System;
using System.Security.Principal;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace BlueDental.Hubs;

[Authorize]
public class NotificationHub(ILogger<NotificationHub> logger) : Hub
{
    /// <summary>Every connection of one account, so a push can reach just that person (Chat nội bộ, F-89).</summary>
    public static string UserGroupOf(Guid userId) => $"user:{userId}";

    public override async Task OnConnectedAsync()
    {
        logger.LogInformation(
            "SignalR client connected: {ConnectionId}, User: {UserId}",
            Context.ConnectionId,
            Context.UserIdentifier);

        if (Context.User?.FindUserId() is { } userId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, UserGroupOf(userId));
        }

        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception is not null)
        {
            logger.LogWarning(
                exception,
                "SignalR client disconnected with error: {ConnectionId}, User: {UserId}",
                Context.ConnectionId,
                Context.UserIdentifier);
        }
        else
        {
            logger.LogInformation(
                "SignalR client disconnected: {ConnectionId}, User: {UserId}",
                Context.ConnectionId,
                Context.UserIdentifier);
        }

        return base.OnDisconnectedAsync(exception);
    }
}
