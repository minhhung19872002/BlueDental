using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Hubs;
using Microsoft.AspNetCore.SignalR;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Appointments;

/// <summary>
/// Broadcasts on the signed-in notification hub. The message is only a branch
/// id and booking ids: each screen refetches through the API, which applies
/// its own branch and permission checks, so no patient data rides the socket.
/// </summary>
public class SignalRAppointmentNotifier(IHubContext<NotificationHub> hubContext)
    : IAppointmentNotifier, ITransientDependency
{
    public async Task NotifyMarkedLateAsync(IReadOnlyCollection<LateAppointmentBatch> batches)
    {
        foreach (var batch in batches)
        {
            await hubContext.Clients.All.SendAsync("AppointmentsMarkedLate", batch.BranchId, batch.AppointmentIds);
        }
    }
}
