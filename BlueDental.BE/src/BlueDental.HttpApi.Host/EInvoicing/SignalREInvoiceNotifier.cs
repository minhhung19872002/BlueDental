using System;
using System.Threading.Tasks;
using BlueDental.Hubs;
using Microsoft.AspNetCore.SignalR;
using Volo.Abp.DependencyInjection;

namespace BlueDental.EInvoicing;

/// <summary>
/// Broadcasts on the signed-in notification hub. Only the branch id rides the
/// socket — no invoice number, buyer or amount.
/// </summary>
public class SignalREInvoiceNotifier(IHubContext<NotificationHub> hubContext)
    : IEInvoiceNotifier, ITransientDependency
{
    public Task NotifyChangedAsync(Guid branchId) =>
        hubContext.Clients.All.SendAsync("EInvoicesChanged", branchId);
}
