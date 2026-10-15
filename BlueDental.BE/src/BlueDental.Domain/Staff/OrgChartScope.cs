using System;
using System.Collections.Generic;
using System.Linq;

namespace BlueDental.Staff;

/// <summary>A unit as the scope rule needs it: where it hangs and who heads it.</summary>
public sealed record OrgScopeUnit(Guid Id, Guid? ParentId, OrgUnitKind Kind, Guid? HeadStaffId);

/// <summary>
/// Whose Lịch làm việc / Chấm công a user may see, from the org chart (BA
/// 2026-10-10):
/// <list type="bullet">
/// <item>not a dentist → everyone their permissions already allow;</item>
/// <item>the Tổng giám đốc (head of the root) → everyone;</item>
/// <item>a dentist heading a Phòng ban or Team → themselves and every member of
/// that unit and of the units under it;</item>
/// <item>any other dentist, in a team or in none → only themselves.</item>
/// </list>
/// </summary>
public static class OrgChartScope
{
    /// <returns><c>null</c> when nothing is hidden; otherwise the staff ids the viewer may see.</returns>
    public static IReadOnlySet<Guid>? VisibleStaff(
        Guid viewerId,
        bool viewerIsDentist,
        IReadOnlyCollection<OrgScopeUnit> units,
        IReadOnlyCollection<(Guid OrgUnitId, Guid StaffId)> members)
    {
        if (!viewerIsDentist)
        {
            return null;
        }

        var headed = units.FirstOrDefault(u => u.HeadStaffId == viewerId);
        if (headed?.Kind == OrgUnitKind.Root)
        {
            return null;
        }

        var visible = new HashSet<Guid> { viewerId };
        if (headed is null)
        {
            return visible;
        }

        var subtree = Subtree(headed.Id, units);
        foreach (var member in members.Where(m => subtree.Contains(m.OrgUnitId)))
        {
            visible.Add(member.StaffId);
        }

        foreach (var unit in units.Where(u => subtree.Contains(u.Id) && u.HeadStaffId is not null))
        {
            visible.Add(unit.HeadStaffId!.Value);
        }

        return visible;
    }

    /// <summary>
    /// Whom a user may name as "Bác sĩ tư vấn" on "Thêm dịch vụ" (BA 2026-10-15,
    /// "trước mắt"). Heads see what <see cref="VisibleStaff"/> gives them, but a
    /// dentist who heads nothing sees their whole unit — the root's direct
    /// members included — rather than only themselves.
    /// </summary>
    /// <returns><c>null</c> when nothing is hidden; otherwise the staff ids the viewer may pick.</returns>
    public static IReadOnlySet<Guid>? VisibleAdvisors(
        Guid viewerId,
        bool viewerIsDentist,
        IReadOnlyCollection<OrgScopeUnit> units,
        IReadOnlyCollection<(Guid OrgUnitId, Guid StaffId)> members)
    {
        if (!viewerIsDentist || units.Any(u => u.HeadStaffId == viewerId))
        {
            return VisibleStaff(viewerId, viewerIsDentist, units, members);
        }

        var visible = new HashSet<Guid> { viewerId };
        var ownUnits = members.Where(m => m.StaffId == viewerId).Select(m => m.OrgUnitId).ToHashSet();
        foreach (var member in members.Where(m => ownUnits.Contains(m.OrgUnitId)))
        {
            visible.Add(member.StaffId);
        }

        return visible;
    }

    /// <summary>The unit and every unit below it.</summary>
    public static IReadOnlySet<Guid> Subtree(Guid unitId, IReadOnlyCollection<OrgScopeUnit> units)
    {
        var found = new HashSet<Guid> { unitId };
        var frontier = new Queue<Guid>([unitId]);
        while (frontier.Count > 0)
        {
            var current = frontier.Dequeue();
            foreach (var child in units.Where(u => u.ParentId == current))
            {
                if (found.Add(child.Id))
                {
                    frontier.Enqueue(child.Id);
                }
            }
        }

        return found;
    }
}
