using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Hubs;
using Microsoft.AspNetCore.SignalR;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Appointments;

/// <summary>
/// Broadcasts on the signed-in notification hub. The message is only a branch
/// id: each screen refetches through the API, which applies its own branch
/// and permission checks.
/// </summary>
public class SignalRAppointmentNotifier(IHubContext<NotificationHub> hubContext)
    : IAppointmentNotifier, ITransientDependency
{
    public async Task NotifyAppointmentsChangedAsync(IReadOnlyCollection<Guid> branchIds)
    {
        foreach (var branchId in branchIds)
        {
            await hubContext.Clients.All.SendAsync("AppointmentsChanged", branchId);
        }
    }
}
