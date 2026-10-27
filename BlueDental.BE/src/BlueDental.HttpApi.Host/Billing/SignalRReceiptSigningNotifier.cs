using System;
using System.Threading.Tasks;
using BlueDental.Hubs;
using Microsoft.AspNetCore.SignalR;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Billing;

/// <summary>
/// Tells the branch's iPad and every open receipt page that a signing session
/// moved. Ids only — each screen reloads what it is allowed to see.
/// </summary>
[Dependency(ReplaceServices = true)]
[ExposeServices(typeof(IReceiptSigningNotifier))]
public class SignalRReceiptSigningNotifier(
    IHubContext<ReceiptSigningHub> stations,
    IHubContext<NotificationHub> staff) : IReceiptSigningNotifier, ITransientDependency
{
    public const string EventName = "ReceiptSigningChanged";

    public async Task NotifyChangedAsync(Guid clinicBranchId, Guid patientPaymentId)
    {
        await stations.Clients.Group(ReceiptSigningHub.GroupOf(clinicBranchId)).SendAsync(EventName);
        await staff.Clients.All.SendAsync(EventName, clinicBranchId, patientPaymentId);
    }
}
