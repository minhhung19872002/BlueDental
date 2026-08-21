using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace BlueDental.Hubs;

[Authorize]
public class NotificationHub(ILogger<NotificationHub> logger) : Hub
{
    public override Task OnConnectedAsync()
    {
        logger.LogInformation(
            "SignalR client connected: {ConnectionId}, User: {UserId}",
            Context.ConnectionId,
            Context.UserIdentifier);

        return base.OnConnectedAsync();
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
