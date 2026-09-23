using System;
using System.Threading.Tasks;
using BlueDental.Hubs;
using Microsoft.AspNetCore.SignalR;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Queue;

public class SignalRQueueNotifier(IHubContext<QueueHub> hubContext)
    : IQueueNotifier, ITransientDependency
{
    public async Task NotifyQueueUpdatedAsync(Guid branchId)
    {
        await hubContext.Clients.Group($"queue:{branchId}")
            .SendAsync("QueueUpdated", branchId);
    }

    public async Task NotifyTicketCalledAsync(
        Guid ticketId, string displayNumber, Guid branchId, int callCount)
    {
        var payload = new { Id = ticketId, DisplayNumber = displayNumber, BranchId = branchId, CallCount = callCount };
        await hubContext.Clients.Group($"queue:{branchId}")
            .SendAsync("TicketCalled", payload);
    }

    public async Task NotifyWaitingTimeWarningAsync(Guid branchId, int warningCount, int dangerCount)
    {
        var payload = new { BranchId = branchId, WarningCount = warningCount, DangerCount = dangerCount };
        await hubContext.Clients.Group($"queue:{branchId}")
            .SendAsync("WaitingTimeWarning", payload);
    }
}
