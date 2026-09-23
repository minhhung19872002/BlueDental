using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace BlueDental.Hubs;

/// <summary>
/// SignalR hub for the queue display.
/// TV clients join a branch group and receive live updates.
/// No [Authorize] — the TV display is a public screen.
/// </summary>
public class QueueHub(ILogger<QueueHub> logger) : Hub
{
    /// <summary>
    /// TV display calls this on connect to subscribe to a branch's queue.
    /// </summary>
    public async Task JoinBranch(Guid branchId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"queue:{branchId}");
        logger.LogInformation(
            "QueueHub: {ConnectionId} joined branch {BranchId}",
            Context.ConnectionId, branchId);
    }

    /// <summary>
    /// Leave a branch group (e.g., when switching branches on the display).
    /// </summary>
    public async Task LeaveBranch(Guid branchId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"queue:{branchId}");
        logger.LogInformation(
            "QueueHub: {ConnectionId} left branch {BranchId}",
            Context.ConnectionId, branchId);
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception is not null)
        {
            logger.LogWarning(exception,
                "QueueHub: {ConnectionId} disconnected with error",
                Context.ConnectionId);
        }

        return base.OnDisconnectedAsync(exception);
    }
}
