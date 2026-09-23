using System;
using System.Threading.Tasks;

namespace BlueDental.Queue;

public interface IQueueNotifier
{
    Task NotifyQueueUpdatedAsync(Guid branchId);
    Task NotifyTicketCalledAsync(Guid ticketId, string displayNumber, Guid branchId, int callCount);
}
