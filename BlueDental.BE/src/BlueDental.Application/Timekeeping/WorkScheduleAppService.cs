using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.Staff;
using BlueDental.Timekeeping.Values;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

namespace BlueDental.Timekeeping;

/// <summary>
/// Lịch làm việc board (BA P0911, F-90). Who shows and whose days may change
/// come from <see cref="OrgChartScope.WorkScheduleReachOf"/>; the permissions
/// say whether the caller may change their own days ("Sửa") and those of the
/// people they manage ("Quản lý lịch làm việc"). Today and every day before
/// it are locked; a saved day changed the day before is written to
/// <see cref="WorkScheduleChangeLog"/>.
/// </summary>
[Authorize(BlueDentalPermissions.Timekeeping.Default)]
public class WorkScheduleAppService(
    IRepository<TimeKeepingRecord, Guid> recordRepository,
    IRepository<WorkScheduleChangeLog, Guid> changeLogRepository,
    IRepository<StaffBranchAssignment, Guid> assignmentRepository,
    IRepository<OrgUnit, Guid> unitRepository,
    IRepository<OrgUnitMember, Guid> memberRepository,
    IIdentityUserRepository userRepository,
    ICurrentClinicBranchResolver branchResolver,
    OrgChartScopeResolver scopeResolver) : BlueDentalAppService, IWorkScheduleAppService
{
    private static readonly StringComparer VietnameseOrder =
        StringComparer.Create(CultureInfo.GetCultureInfo("vi-VN"), true);

    [Authorize(BlueDentalPermissions.Timekeeping.View)]
    public virtual async Task<WorkScheduleBoardDto> GetBoardAsync(GetWorkScheduleBoardInput input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var reach = await scopeResolver.WorkScheduleReachAsync();
        var rights = await GetEditRightsAsync();

        var branchStaffIds = (await assignmentRepository.GetListAsync(a => a.ClinicBranchId == branchId))
            .Select(a => a.StaffId)
            .ToHashSet();
        var staff = (await userRepository.GetListByIdsAsync(branchStaffIds))
            .Where(u => u.IsActive && reach.Sees(u.Id))
            .ToList();
        var staffIds = staff.Select(u => u.Id).ToList();

        var first = new DateOnly(input.Year, input.Month, 1);
        var last = first.AddMonths(1).AddDays(-1);
        var days = (await recordRepository.GetListAsync(r =>
                r.ClinicBranchId == branchId
                && r.WorkDate >= first && r.WorkDate <= last
                && staffIds.Contains(r.StaffId)
                && r.Registration != WorkRegistration.NotRegistered))
            .Select(r => (r.StaffId, Day: new WorkScheduleDayDto { WorkDate = r.WorkDate, Shift = r.OffShift }))
            .Where(x => x.Day.Shift != WorkScheduleShift.None)
            .ToLookup(x => x.StaffId, x => x.Day);

        var units = await unitRepository.GetListAsync();
        var members = await memberRepository.GetListAsync();
        var groups = BuildGroups(staff, units, members, days, (staffId) => rights.CanEdit(staffId, reach));

        return new WorkScheduleBoardDto
        {
            Year = input.Year,
            Month = input.Month,
            Today = ClinicToday,
            Groups = groups
        };
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public virtual async Task<SaveWorkScheduleResultDto> SaveAsync(SaveWorkScheduleInput input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var today = ClinicToday;

        // A cell painted twice keeps its last shift, as the board shows it.
        var items = input.Items
            .GroupBy(i => (i.StaffId, i.WorkDate))
            .Select(g => g.Last())
            .ToList();

        if (items.Any(i => i.WorkDate <= today))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Timekeeping.ScheduleDayLocked);
        }

        var reach = await scopeResolver.WorkScheduleReachAsync();
        var rights = await GetEditRightsAsync();
        var staffIds = items.Select(i => i.StaffId).Distinct().ToList();
        if (staffIds.Any(id => !rights.CanEdit(id, reach)))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Timekeeping.ScheduleNotEditable);
        }

        var assigned = (await assignmentRepository.GetListAsync(a =>
                a.ClinicBranchId == branchId && staffIds.Contains(a.StaffId)))
            .Select(a => a.StaffId)
            .ToHashSet();
        if (staffIds.Any(id => !assigned.Contains(id)))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Timekeeping.StaffNotInBranch);
        }

        var staff = (await userRepository.GetListByIdsAsync(staffIds)).ToDictionary(u => u.Id);
        var dates = items.Select(i => i.WorkDate).Distinct().ToList();
        var existing = (await recordRepository.GetListAsync(r =>
                r.ClinicBranchId == branchId && staffIds.Contains(r.StaffId) && dates.Contains(r.WorkDate)))
            .ToDictionary(r => (r.StaffId, r.WorkDate));

        var inserted = new List<TimeKeepingRecord>();
        var updated = new List<TimeKeepingRecord>();
        var logs = new List<WorkScheduleChangeLog>();
        foreach (var item in items)
        {
            existing.TryGetValue((item.StaffId, item.WorkDate), out var record);
            var from = record?.OffShift ?? WorkScheduleShift.None;
            if (from == item.Shift)
            {
                continue;
            }

            if (record is null)
            {
                var person = staff.GetValueOrDefault(item.StaffId);
                record = TimeKeepingRecord.OpenDay(
                    GuidGenerator.Create(),
                    item.StaffId,
                    branchId,
                    item.WorkDate,
                    StaffWorkingHours.FromProfile(person, WorkShiftKind.Morning),
                    StaffWorkingHours.FromProfile(person, WorkShiftKind.Afternoon));
                inserted.Add(record);
            }
            else
            {
                updated.Add(record);
            }

            record.ScheduleShift(item.Shift);

            if (WorkScheduleChangeLog.IsLateChange(today, item.WorkDate, from, item.Shift))
            {
                logs.Add(new WorkScheduleChangeLog(
                    GuidGenerator.Create(), branchId, item.StaffId, item.WorkDate, from, item.Shift));
            }
        }

        await recordRepository.InsertManyAsync(inserted);
        await recordRepository.UpdateManyAsync(updated);
        await changeLogRepository.InsertManyAsync(logs);
        await CurrentUnitOfWork!.SaveChangesAsync();

        return new SaveWorkScheduleResultDto { Saved = inserted.Count + updated.Count, Logged = logs.Count };
    }

    /// <summary>The clinic's own date (UTC+7, no DST).</summary>
    private DateOnly ClinicToday =>
        DateOnly.FromDateTime(DateTime.SpecifyKind(Clock.Now, DateTimeKind.Utc).AddHours(7));

    private async Task<EditRights> GetEditRightsAsync() => new(
        CurrentUser.GetId(),
        await AuthorizationService.IsGrantedAsync(BlueDentalAbilityPermissions.WorkSchedule.Update),
        await AuthorizationService.IsGrantedAsync(BlueDentalAbilityPermissions.WorkSchedule.AttendanceOthers));

    /// <summary>"Sửa" covers one's own days; "Quản lý lịch làm việc" those of the people one manages.</summary>
    private sealed record EditRights(Guid ViewerId, bool EditsOwn, bool ManagesOthers)
    {
        public bool CanEdit(Guid staffId, WorkScheduleReach reach) => staffId == ViewerId
            ? EditsOwn
            : ManagesOthers && reach.Manages(staffId);
    }

    /// <summary>
    /// Everyone once: under the unit they head, else the unit they sit in, else
    /// "Chưa phân nhóm" at the end. The root and the director's own units come
    /// first (BA: "filter cho cái nhánh bác Tới lên đầu"), the rest in chart order.
    /// </summary>
    private static List<WorkScheduleGroupDto> BuildGroups(
        List<IdentityUser> staff,
        List<OrgUnit> units,
        List<OrgUnitMember> members,
        ILookup<Guid, WorkScheduleDayDto> days,
        Func<Guid, bool> canEdit)
    {
        var memberOf = members.GroupBy(m => m.StaffId).ToDictionary(g => g.Key, g => g.First().OrgUnitId);
        var headOf = units.Where(u => u.HeadStaffId is not null)
            .GroupBy(u => u.HeadStaffId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderBy(u => u.Kind).First().Id);
        var unitById = units.ToDictionary(u => u.Id);
        var rootHead = units.FirstOrDefault(u => u.Kind == OrgUnitKind.Root)?.HeadStaffId;
        var chartOrder = ChartOrder(units);

        var placed = staff
            .Select(u =>
            {
                Guid? unitId = headOf.TryGetValue(u.Id, out var headed) ? headed
                    : memberOf.TryGetValue(u.Id, out var sits) && unitById.ContainsKey(sits) ? sits
                    : null;
                return (UnitId: unitId, User: u);
            })
            .ToList();

        return placed
            .GroupBy(p => p.UnitId)
            .OrderBy(g => g.Key is null ? 2 : unitById[g.Key.Value].Kind == OrgUnitKind.Root
                                             || unitById[g.Key.Value].HeadStaffId == rootHead ? 0 : 1)
            .ThenBy(g => g.Key is { } id ? chartOrder.GetValueOrDefault(id, int.MaxValue) : int.MaxValue)
            .Select(g =>
            {
                var unit = g.Key is { } id ? unitById[id] : null;
                return new WorkScheduleGroupDto
                {
                    UnitId = unit?.Id,
                    Name = unit?.Name,
                    Kind = unit?.Kind,
                    HeadStaffId = unit?.HeadStaffId,
                    Members = g
                        .Select(p => p.User)
                        .OrderBy(u => u.Id == unit?.HeadStaffId ? 0 : 1)
                        .ThenBy(FullName, VietnameseOrder)
                        .Select(u => new WorkScheduleMemberDto
                        {
                            StaffId = u.Id,
                            FullName = FullName(u),
                            RoleLabel = (u.ExtraProperties.GetOrDefault(StaffJobTitles.Property) as string).NullIfWhiteSpace()
                                        ?? (u.ExtraProperties.GetOrDefault("Position") as string).NullIfWhiteSpace(),
                            IsDentist = u.ExtraProperties.GetOrDefault("IsDentist") is true,
                            IsHead = u.Id == unit?.HeadStaffId,
                            AvatarUrl = u.ExtraProperties.GetOrDefault("AvatarBlobName") is string
                                ? $"/api/v1/app/staff/{u.Id}/avatar"
                                : null,
                            CanEdit = canEdit(u.Id),
                            Days = days[u.Id].OrderBy(d => d.WorkDate).ToList()
                        })
                        .ToList()
                };
            })
            .ToList();
    }

    /// <summary>Depth-first from the root, siblings by kind then age — the Sơ đồ tổ chức order.</summary>
    private static Dictionary<Guid, int> ChartOrder(List<OrgUnit> units)
    {
        var order = new Dictionary<Guid, int>();
        var children = units.ToLookup(u => u.ParentId);

        void Visit(OrgUnit unit)
        {
            if (!order.TryAdd(unit.Id, order.Count))
            {
                return;
            }

            foreach (var child in children[unit.Id].OrderBy(u => u.Kind).ThenBy(u => u.CreationTime))
            {
                Visit(child);
            }
        }

        foreach (var root in children[null].OrderBy(u => u.Kind).ThenBy(u => u.CreationTime))
        {
            Visit(root);
        }

        return order;
    }

    private static string FullName(IdentityUser u) =>
        $"{u.Name} {u.Surname}".Trim() is { Length: > 0 } fullName ? fullName : u.UserName;
}

internal static class WorkScheduleStringExtensions
{
    public static string? NullIfWhiteSpace(this string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
