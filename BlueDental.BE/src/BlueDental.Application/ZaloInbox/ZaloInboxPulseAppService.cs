using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.ZaloInbox;

/// <summary>
/// "Nghe chuông tin nhắn Zalo" (R-1194). Its own leaf, not cskhInbox.read: the
/// BA wants reception to ring, not to need the inbox opened to them.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.CskhInbox.Notify)]
public class ZaloInboxPulseAppService(
    IRepository<ZaloConversation, Guid> conversations,
    BranchAccessChecker branchAccess,
    ICurrentClinicBranchResolver branchResolver) : BlueDentalAppService, IZaloInboxPulseAppService
{
    public async Task<ZaloInboxPulseDto> GetAsync()
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        await branchAccess.CheckAsync(branchId);

        var latest = await AsyncExecuter.MaxAsync(
            (await conversations.GetQueryableAsync()).Where(c => c.ClinicBranchId == branchId),
            c => c.LastCustomerMessageAt);
        return new ZaloInboxPulseDto { LastCustomerMessageAt = latest };
    }
}
