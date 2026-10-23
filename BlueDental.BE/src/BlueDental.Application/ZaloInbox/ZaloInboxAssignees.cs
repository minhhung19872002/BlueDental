using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Volo.Abp;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Security.Claims;

namespace BlueDental.ZaloInbox;

/// <summary>
/// Who a conversation can be handed to (BA P2210: "chọn user có quyền truy
/// cập vào chức năng này"): active staff of the branch granted Hộp thư Zalo ›
/// Xử lý, through a role or on their own — asked of the same permission checker
/// that guards the endpoints, with the colleague's id and roles.
/// </summary>
public class ZaloInboxAssignees(
    IRepository<StaffBranchAssignment, Guid> assignments,
    IIdentityUserRepository users,
    IPermissionChecker permissions) : ITransientDependency
{
    public async Task<List<ZaloInboxAssigneeDto>> ListAsync(Guid branchId, Guid exceptUserId)
    {
        var staffIds = (await assignments.GetListAsync(a => a.ClinicBranchId == branchId))
            .Select(a => a.StaffId)
            .Where(id => id != exceptUserId)
            .Distinct()
            .ToList();
        if (staffIds.Count == 0)
        {
            return [];
        }

        var result = new List<ZaloInboxAssigneeDto>();
        foreach (var user in (await users.GetListByIdsAsync(staffIds)).Where(u => u.IsActive))
        {
            if (await HandlesAsync(user.Id))
            {
                result.Add(new ZaloInboxAssigneeDto { Id = user.Id, Name = ZaloInboxReader.FullName(user) });
            }
        }

        return [.. result.OrderBy(a => a.Name, StringComparer.CurrentCultureIgnoreCase)];
    }

    public async Task CheckAsync(Guid branchId, Guid userId)
    {
        var inBranch = await assignments.AnyAsync(a => a.ClinicBranchId == branchId && a.StaffId == userId);
        var user = inBranch ? await users.FindAsync(userId) : null;
        if (user is not { IsActive: true } || !await HandlesAsync(userId))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.ZaloInbox.InvalidAssignee);
        }
    }

    private async Task<bool> HandlesAsync(Guid userId)
    {
        var claims = new List<Claim> { new(AbpClaimTypes.UserId, userId.ToString()) };
        claims.AddRange((await users.GetRoleNamesAsync(userId)).Select(role => new Claim(AbpClaimTypes.Role, role)));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "ZaloInboxAssignee"));
        return await permissions.IsGrantedAsync(principal, BlueDentalAbilityPermissions.CskhInbox.Update);
    }
}
