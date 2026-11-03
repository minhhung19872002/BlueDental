using System;
using System.Threading.Tasks;
using BlueDental.Billing;
using Microsoft.AspNetCore.SignalR;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Uow;

namespace BlueDental.Hubs;

/// <summary>
/// The branch's iPad (P2610) listens here for "ReceiptSigningChanged" and
/// reloads its screen. No sign-in: the device token picks the branch, and a
/// revoked or unknown token joins nothing.
/// </summary>
public class ReceiptSigningHub(
    IRepository<SigningDevice, Guid> devices,
    IUnitOfWorkManager unitOfWorkManager) : Hub
{
    public static string GroupOf(Guid clinicBranchId) => $"signing:{clinicBranchId}";

    public async Task<bool> JoinDevice(string token)
    {
        var hash = SigningDevice.HashToken(token?.Trim() ?? string.Empty);
        using var uow = unitOfWorkManager.Begin(requiresNew: true);
        var device = await devices.FirstOrDefaultAsync(d => d.TokenHash == hash && d.RevokedAt == null);
        await uow.CompleteAsync();
        if (device == null)
        {
            return false;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupOf(device.ClinicBranchId));
        return true;
    }
}
