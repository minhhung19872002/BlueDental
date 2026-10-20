using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Data;
using BlueDental.TreatmentManagement;
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
    ICurrentUser currentUser,
    TreatmentCostAccess costAccess) : ITransientDependency
{
    /// <returns><c>null</c> when nothing is hidden from the caller.</returns>
    public virtual Task<IReadOnlySet<Guid>?> VisibleScheduleStaffAsync() =>
        ApplyAsync(OrgChartScope.VisibleStaff);

    /// <summary>Whom the caller may pick as "Bác sĩ tư vấn" on "Thêm dịch vụ" (R-954).</summary>
    /// <returns><c>null</c> when nothing is hidden from the caller.</returns>
    public virtual Task<IReadOnlySet<Guid>?> VisibleAdvisorStaffAsync() =>
        ApplyAsync(OrgChartScope.VisibleAdvisors);

    /// <summary>
    /// Which slips the caller sees on the patient record's "Kế hoạch điều trị"
    /// and its slip pages — <see cref="OrgChartScope.VisibleSlips"/>.
    /// </summary>
    /// <returns><c>null</c> when nothing is hidden from the caller.</returns>
    public virtual async Task<SlipScope?> VisibleSlipsAsync()
    {
        if (currentUser.Id is not { } viewerId)
        {
            return new SlipScope(new HashSet<Guid>(), ReceivedOnly: true);
        }

        if (currentUser.IsInRole(BlueDentalAbilitySeedContributor.AdminRoleName))
        {
            return null;
        }

        var seesCosts = await costAccess.SeesCostsAsync();
        if (!seesCosts || !await IsDentistAsync(viewerId))
        {
            return OrgChartScope.VisibleSlips(viewerId, viewerIsAdmin: false, seesCosts, viewerIsDentist: false, [], []);
        }

        var (units, members) = await LoadChartAsync();
        return OrgChartScope.VisibleSlips(viewerId, viewerIsAdmin: false, seesCosts, viewerIsDentist: true, units, members);
    }

    /// <summary>Whether the caller is a dentist heading a unit — the root, a Phòng ban or a Team.</summary>
    public virtual async Task<bool> HeadsAUnitAsync()
    {
        if (currentUser.Id is not { } viewerId || !await IsDentistAsync(viewerId))
        {
            return false;
        }

        return await unitRepository.AnyAsync(u => u.HeadStaffId == viewerId);
    }

    private async Task<IReadOnlySet<Guid>?> ApplyAsync(
        Func<Guid, bool, IReadOnlyCollection<OrgScopeUnit>, IReadOnlyCollection<(Guid, Guid)>, IReadOnlySet<Guid>?> rule)
    {
        if (currentUser.Id is not { } viewerId || !await IsDentistAsync(viewerId))
        {
            return null;
        }

        var (units, members) = await LoadChartAsync();
        return rule(viewerId, true, units, members);
    }

    private async Task<bool> IsDentistAsync(Guid userId)
    {
        var user = await userRepository.FindAsync(userId, includeDetails: false);
        return user?.ExtraProperties.GetOrDefault("IsDentist") is true;
    }

    private async Task<(List<OrgScopeUnit> Units, List<(Guid, Guid)> Members)> LoadChartAsync()
    {
        var units = (await unitRepository.GetListAsync())
            .Select(u => new OrgScopeUnit(u.Id, u.ParentId, u.Kind, u.HeadStaffId))
            .ToList();
        var members = (await memberRepository.GetListAsync())
            .Select(m => (m.OrgUnitId, m.StaffId))
            .ToList();
        return (units, members);
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
