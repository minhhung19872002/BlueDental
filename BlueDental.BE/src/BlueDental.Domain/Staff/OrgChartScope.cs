using System;
using System.Collections.Generic;
using System.Linq;

namespace BlueDental.Staff;

/// <summary>A unit as the scope rule needs it: where it hangs and who heads it.</summary>
public sealed record OrgScopeUnit(Guid Id, Guid? ParentId, OrgUnitKind Kind, Guid? HeadStaffId);

/// <summary>
/// The slips <see cref="OrgChartScope.VisibleSlips"/> leaves visible: those
/// received by one of <paramref name="Staff"/> ("Bác sĩ tiếp nhận"), shown
/// whole, and those with a line assigned to one of them (Bác sĩ điều trị or
/// Bác sĩ tư vấn), shown with only those lines' money — or, when
/// <paramref name="ShowsLineMoney"/> is off, with no money at all (BA bug 40,
/// 2026-10-21: "Dc assign mà ko có quyền xem thì masking lại hết").
/// </summary>
/// <param name="ShowsLineMoney">Whether the lines assigned in scope show their money; off without "Chi phí › Xem".</param>
public sealed record SlipScope(IReadOnlySet<Guid> Staff, bool ShowsLineMoney = true)
{
    /// <param name="lineAssignees">Everyone the slip's lines are assigned to.</param>
    public bool Covers(Guid slipDentistId, IEnumerable<Guid?> lineAssignees) =>
        SeesWhole(slipDentistId) || lineAssignees.Any(Includes);

    /// <summary>The slip was received inside the scope, so every line and all its money show.</summary>
    public bool SeesWhole(Guid slipDentistId) => Staff.Contains(slipDentistId);

    /// <summary>Whether the person is inside the scope; nobody (an unassigned field) never is.</summary>
    public bool Includes(Guid? staffId) => staffId is { } id && Staff.Contains(id);
}

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

    /// <summary>
    /// Which slips a user sees on the patient record's "Kế hoạch điều trị" tab
    /// and its slip pages (R-961, reshaped by BA P2010 "Tài chính / Kế toán ›
    /// Chi phí › Xem", then by BA bug 40):
    /// <list type="bullet">
    /// <item>an admin → every slip;</item>
    /// <item>without the permission → themselves only, whatever their place on
    /// the chart;</item>
    /// <item>with it, not a dentist → every slip;</item>
    /// <item>with it, a dentist → what <see cref="VisibleStaff"/> gives them —
    /// their own, the whole subtree of a unit they head, everyone as head of the
    /// root.</item>
    /// </list>
    /// A slip one of those people received shows whole; one where a line is only
    /// assigned to them shows with that line's money alone, and without the
    /// permission with every amount masked (<see cref="SlipScope"/>).
    /// </summary>
    /// <returns><c>null</c> when nothing is hidden; otherwise the people whose slips and lines show.</returns>
    public static SlipScope? VisibleSlips(
        Guid viewerId,
        bool viewerIsAdmin,
        bool viewerSeesCosts,
        bool viewerIsDentist,
        IReadOnlyCollection<OrgScopeUnit> units,
        IReadOnlyCollection<(Guid OrgUnitId, Guid StaffId)> members)
    {
        if (viewerIsAdmin)
        {
            return null;
        }

        if (!viewerSeesCosts)
        {
            return new SlipScope(new HashSet<Guid> { viewerId }, ShowsLineMoney: false);
        }

        return VisibleStaff(viewerId, viewerIsDentist, units, members) is { } staff
            ? new SlipScope(staff)
            : null;
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
