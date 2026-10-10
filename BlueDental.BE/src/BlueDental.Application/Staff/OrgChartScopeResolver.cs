using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

namespace BlueDental.Staff;

/// <summary>
/// Applies <see cref="OrgChartScope"/> to the signed-in user: whose Lịch làm
/// việc / Chấm công they may see (F-67). It narrows what the permissions
/// already allow and never widens it.
/// </summary>
public class OrgChartScopeResolver(
    IRepository<OrgUnit, Guid> unitRepository,
    IRepository<OrgUnitMember, Guid> memberRepository,
    IIdentityUserRepository userRepository,
    ICurrentUser currentUser) : ITransientDependency
{
    /// <returns><c>null</c> when nothing is hidden from the caller.</returns>
    public virtual async Task<IReadOnlySet<Guid>?> VisibleScheduleStaffAsync()
    {
        if (currentUser.Id is not { } viewerId)
        {
            return null;
        }

        var viewer = await userRepository.FindAsync(viewerId, includeDetails: false);
        var isDentist = viewer?.ExtraProperties.GetOrDefault("IsDentist") is true;
        if (!isDentist)
        {
            return null;
        }

        var units = (await unitRepository.GetListAsync())
            .Select(u => new OrgScopeUnit(u.Id, u.ParentId, u.Kind, u.HeadStaffId))
            .ToList();
        var members = (await memberRepository.GetListAsync())
            .Select(m => (m.OrgUnitId, m.StaffId))
            .ToList();

        return OrgChartScope.VisibleStaff(viewerId, isDentist, units, members);
    }

    /// <summary>Refuses when any of <paramref name="staffIds"/> lies outside the caller's scope.</summary>
    public virtual async Task EnsureVisibleAsync(IEnumerable<Guid> staffIds)
    {
        var visible = await VisibleScheduleStaffAsync();
        if (visible is not null && staffIds.Any(id => !visible.Contains(id)))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.OutsideScheduleScope);
        }
    }
}
