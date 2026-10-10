using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Timekeeping.Values;
using BlueDental.Permissions;
using BlueDental.Staff;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

namespace BlueDental.Timekeeping;

/// <summary>
/// Chấm công / Lịch làm việc.
/// </summary>
[Authorize(BlueDentalPermissions.Timekeeping.Default)]
public class TimeKeepingAppService : ApplicationService, ITimeKeepingAppService
{
    private readonly IRepository<TimeKeepingRecord, Guid> _repository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly IRepository<StaffBranchAssignment, Guid> _assignmentRepository;
    private readonly OrgChartScopeResolver _scopeResolver;

    public TimeKeepingAppService(
        IRepository<TimeKeepingRecord, Guid> repository,
        IIdentityUserRepository userRepository,
        ICurrentClinicBranchResolver branchResolver,
        IRepository<StaffBranchAssignment, Guid> assignmentRepository,
        OrgChartScopeResolver scopeResolver)
    {
        _repository = repository;
        _userRepository = userRepository;
        _branchResolver = branchResolver;
        _assignmentRepository = assignmentRepository;
        _scopeResolver = scopeResolver;
    }

    /// <summary>
    /// A record stores the staff id; the board shows a person. Nothing filled
    /// this in, so every card on a full roster read "BE:Perm:Staff".
    /// </summary>
    private async Task FillStaffNamesAsync(List<TimeKeepingRecordDto> dtos)
    {
        if (dtos.Count == 0)
        {
            return;
        }

        var staffIds = dtos.Select(d => d.StaffId).Distinct().ToList();
        var users = await _userRepository.GetListByIdsAsync(staffIds);
        // Same shape as StaffDto.FullName, which the board's not-yet-opened
        // cards show — otherwise a card's name changes the moment the day opens.
        var names = users.ToDictionary(
            u => u.Id,
            u => $"{u.Name} {u.Surname}".Trim() is { Length: > 0 } fullName ? fullName : u.UserName);

        foreach (var dto in dtos)
        {
            dto.StaffName = names.GetValueOrDefault(dto.StaffId);
        }
    }

    [Authorize(BlueDentalPermissions.Timekeeping.View)]
    public async Task<PagedResultDto<TimeKeepingRecordDto>> GetListAsync(GetTimeKeepingListInput input)
    {
        var query = await BuildQueryAsync(input);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(x => x.WorkDate)
            .ThenBy(x => x.StaffId)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var dtos = items.Select(MapToDto).ToList();
        await FillStaffNamesAsync(dtos);

        return new PagedResultDto<TimeKeepingRecordDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.Timekeeping.View)]
    public async Task<TimeKeepingRecordDto> GetAsync(Guid id)
    {
        return MapToDto(await GetRecordForCurrentBranchAsync(id));
    }

    [Authorize(BlueDentalPermissions.Timekeeping.View)]
    public async Task<TimeKeepingSummaryDto> GetSummaryAsync(Guid clinicBranchId, DateOnly workDate)
    {
        var branchIds = await ResolveBranchIdsAsync();

        var assignments = await _assignmentRepository.GetListAsync(a => branchIds.Contains(a.ClinicBranchId));
        var branchStaffIds = assignments.Select(a => a.StaffId).ToHashSet();

        var workDateTime = workDate.ToDateTime(TimeOnly.MaxValue);
        var allUsers = await _userRepository.GetListAsync(maxResultCount: int.MaxValue, skipCount: 0);
        var eligibleStaffIds = allUsers
            .Where(u => u.IsActive && u.CreationTime <= workDateTime && branchStaffIds.Contains(u.Id))
            .Select(u => u.Id)
            .ToHashSet();

        // Sơ đồ tổ chức (F-67): a dentist counts only the people they may see.
        if (await _scopeResolver.VisibleScheduleStaffAsync() is { } visible)
        {
            eligibleStaffIds.IntersectWith(visible);
        }

        var query = await _repository.GetQueryableAsync();
        var records = query
            .Where(x => branchIds.Contains(x.ClinicBranchId) && x.WorkDate == workDate)
            .ToList()
            .Where(x => eligibleStaffIds.Contains(x.StaffId))
            .ToList();

        return new TimeKeepingSummaryDto
        {
            WorkDate = workDate,
            TotalStaff = eligibleStaffIds.Count,
            RegisteredWorking = records.Count(x => x.Registration == WorkRegistration.Working),
            RegisteredDayOff = records.Count(x => x.Registration == WorkRegistration.DayOff),
            CurrentlyWorking = records.Count(x => x.Status == AttendanceStatus.Working),
            Abandoned = records.Count(x => x.Status == AttendanceStatus.Abandoned),
            TotalOvertimeMinutes = records.Sum(x => x.OvertimeMinutes)
        };
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<TimeKeepingRecordDto> OpenWorkDayAsync(OpenWorkDayDto input)
    {
        await _scopeResolver.EnsureVisibleAsync([input.StaffId]);
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        if (input.WorkDate != ClinicToday &&
            !await AuthorizationService.IsGrantedAsync(BlueDentalAbilityPermissions.WorkSchedule.AttendanceOthers))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.PastDayAttendance,
                "Opening a work day is only allowed for today. A manager can override.");
        }

        var query = await _repository.GetQueryableAsync();
        var existing = query.FirstOrDefault(x =>
            x.ClinicBranchId == clinicBranchId &&
            x.StaffId == input.StaffId &&
            x.WorkDate == input.WorkDate);

        if (existing != null)
        {
            return MapToDto(existing);
        }

        var record = TimeKeepingRecord.OpenDay(
            GuidGenerator.Create(),
            input.StaffId,
            clinicBranchId,
            input.WorkDate,
            BuildShift(WorkShiftKind.Morning, input.MorningStart, input.MorningEnd),
            BuildShift(WorkShiftKind.Afternoon, input.AfternoonStart, input.AfternoonEnd));

        await _repository.InsertAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<TimeKeepingRecordDto> RegisterWorkingAsync(Guid id)
    {
        var record = await GetRecordForCurrentBranchAsync(id);
        EnsureClinicToday(record);
        record.RegisterWorking();
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<TimeKeepingRecordDto> RegisterDayOffAsync(Guid id, RegisterDayOffInput input)
    {
        var record = await GetRecordForCurrentBranchAsync(id);
        EnsureClinicToday(record);
        record.RegisterDayOff(input.Reason);
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<TimeKeepingRecordDto> CheckInAsync(Guid id, AttendanceInput input)
    {
        var record = await GetRecordForCurrentBranchAsync(id);
        EnsureClinicToday(record);
        record.CheckIn(input.Shift, input.At ?? Clock.Now, input.RecordedByStaffId);
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<TimeKeepingRecordDto> CheckOutAsync(Guid id, AttendanceInput input)
    {
        var record = await GetRecordForCurrentBranchAsync(id);
        EnsureClinicToday(record);
        record.CheckOut(input.Shift, input.At ?? Clock.Now, input.RecordedByStaffId);
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<TimeKeepingRecordDto> AddOvertimeAsync(Guid id, AddOvertimeInput input)
    {
        var record = await GetRecordForCurrentBranchAsync(id);
        await EnsureSameDayOrManagerAsync(record);
        record.AddOvertime(input.Minutes);
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<TimeKeepingRecordDto> UpdateInfoAsync(Guid id, UpdateInfoInput input)
    {
        var record = await GetRecordForCurrentBranchAsync(id);

        record.UpdateNote(input.Note);

        if (!record.HasAnyAttendance)
        {
            var ms = input.MorningStart ?? record.MorningShift.PlannedStart;
            var me = input.MorningEnd ?? record.MorningShift.PlannedEnd;
            var afs = input.AfternoonStart ?? record.AfternoonShift.PlannedStart;
            var afe = input.AfternoonEnd ?? record.AfternoonShift.PlannedEnd;

            record.RescheduleShifts(
                new Values.WorkShift(WorkShiftKind.Morning, ms, me),
                new Values.WorkShift(WorkShiftKind.Afternoon, afs, afe));
        }

        if (input.OvertimeMinutes.HasValue && input.OvertimeMinutes.Value > 0)
        {
            var delta = input.OvertimeMinutes.Value - record.OvertimeMinutes;
            if (delta > 0) record.AddOvertime(delta);
        }

        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<int> CloseAbandonedShiftsAsync(Guid clinicBranchId, DateOnly workDate)
    {
        var resolvedBranchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();
        var dayRecords = query
            .Where(x => x.ClinicBranchId == resolvedBranchId && x.WorkDate == workDate)
            .ToList();

        var count = 0;

        // 1) Staff who started a shift but never checked out
        foreach (var record in dayRecords.Where(x => x.HasOpenShift))
        {
            record.MarkAbandoned("Tự động đóng cuối ngày.");
            await _repository.UpdateAsync(record);
            count++;
        }

        // 2) Staff registered Working but never checked in (no-shows)
        foreach (var record in dayRecords.Where(x =>
            x.Registration == WorkRegistration.Working &&
            x.Status == AttendanceStatus.NotStarted &&
            !x.HasAnyAttendance))
        {
            record.MarkNoShow("Đã đăng ký nhưng không chấm công.");
            await _repository.UpdateAsync(record);
            count++;
        }

        return count;
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<int> BulkRegisterAsync(BulkRegisterInput input)
    {
        if (input.Items is not { Count: > 0 })
            return 0;

        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();

        var staffIds = input.Items.Select(i => i.StaffId).Distinct().ToList();
        var dates = input.Items.Select(i => i.WorkDate).Distinct().ToList();

        var query = await _repository.GetQueryableAsync();
        var existing = query
            .Where(x => x.ClinicBranchId == clinicBranchId
                        && staffIds.Contains(x.StaffId)
                        && dates.Contains(x.WorkDate))
            .ToList();

        var lookup = existing.ToDictionary(r => (r.StaffId, r.WorkDate));

        // The grid only lets a staff member mark or clear their own day off (X) on a
        // day that has not passed, has not been clocked in and is not planned as
        // working (L). Any role, admin included; one bad cell refuses the whole
        // batch before anything is written (BA 2026-10-02).
        var currentUserId = CurrentUser.GetId();
        var touchesLockedCell = input.Items.Any(i =>
            i.StaffId != currentUserId ||
            i.WorkDate < ClinicToday ||
            i.Registration == WorkRegistration.Working ||
            (lookup.TryGetValue((i.StaffId, i.WorkDate), out var r) &&
             (r.HasAnyAttendance || r.Registration == WorkRegistration.Working)));
        if (touchesLockedCell)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.ScheduleCellLocked,
                "Only your own day off can be set or cleared, on a day not yet passed or clocked in.");
        }

        var count = 0;
        foreach (var item in input.Items)
        {
            if (lookup.TryGetValue((item.StaffId, item.WorkDate), out var record))
            {
                if (item.Registration == WorkRegistration.DayOff)
                    record.RegisterDayOff();
                else
                    record.ResetRegistration();

                await _repository.UpdateAsync(record);
            }
            else
            {
                var newRecord = TimeKeepingRecord.OpenDay(
                    GuidGenerator.Create(),
                    item.StaffId,
                    clinicBranchId,
                    item.WorkDate);

                if (item.Registration == WorkRegistration.DayOff)
                    newRecord.RegisterDayOff();

                await _repository.InsertAsync(newRecord);
            }

            count++;
        }

        await CurrentUnitOfWork!.SaveChangesAsync();
        return count;
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<List<TimeKeepingRecordDto>> RegisterLeaveAsync(RegisterLeaveInput input)
    {
        if (input.Days is not { Count: > 0 })
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.LeaveDaysRequired,
                "Pick at least one day off.");
        }

        // Like the X cells on the grid: one's own leave only, every role (BA 2026-10-02).
        if (input.StaffId != CurrentUser.GetId())
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.ScheduleCellLocked,
                "Only your own leave can be registered.");
        }

        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var isAssigned = await _assignmentRepository.AnyAsync(a =>
            a.StaffId == input.StaffId && a.ClinicBranchId == clinicBranchId);
        if (!isAssigned)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.StaffNotInBranch,
                "The staff member does not belong to the current branch.");
        }

        if (input.Days.Any(d => d.WorkDate < ClinicToday))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.LeaveInPast,
                "A day off cannot be registered for a past day.");
        }

        // A day picked twice keeps its last shift, as the popup itself would.
        var days = input.Days
            .GroupBy(d => d.WorkDate)
            .Select(g => g.Last())
            .OrderBy(d => d.WorkDate)
            .ToList();
        var dates = days.Select(d => d.WorkDate).ToList();

        var query = await _repository.GetQueryableAsync();
        var lookup = query
            .Where(x => x.ClinicBranchId == clinicBranchId
                        && x.StaffId == input.StaffId
                        && dates.Contains(x.WorkDate))
            .ToList()
            .ToDictionary(x => x.WorkDate);

        var staff = await _userRepository.GetAsync(input.StaffId);
        var reason = input.Reason.IsNullOrWhiteSpace() ? null : input.Reason!.Trim();

        var records = new List<TimeKeepingRecord>();
        foreach (var day in days)
        {
            var isNew = !lookup.TryGetValue(day.WorkDate, out var record);
            record ??= TimeKeepingRecord.OpenDay(
                GuidGenerator.Create(),
                input.StaffId,
                clinicBranchId,
                day.WorkDate,
                StaffShift(staff, WorkShiftKind.Morning),
                StaffShift(staff, WorkShiftKind.Afternoon));

            record.RegisterLeave(BuildLeaveWindow(record, day), reason);

            if (isNew) await _repository.InsertAsync(record);
            else await _repository.UpdateAsync(record);
            records.Add(record);
        }

        await CurrentUnitOfWork!.SaveChangesAsync();

        var dtos = records.Select(MapToDto).ToList();
        await FillStaffNamesAsync(dtos);
        return dtos;
    }

    /// <summary>Hours left empty default to the whole window of the chosen shift.</summary>
    private static LeaveWindow BuildLeaveWindow(TimeKeepingRecord record, RegisterLeaveDayInput day)
    {
        var (defaultStart, defaultEnd) = day.Shift switch
        {
            LeaveShift.Morning => (record.MorningShift.PlannedStart, record.MorningShift.PlannedEnd),
            LeaveShift.Afternoon => (record.AfternoonShift.PlannedStart, record.AfternoonShift.PlannedEnd),
            _ => (record.MorningShift.PlannedStart, record.AfternoonShift.PlannedEnd)
        };

        return new LeaveWindow(day.Shift, day.Start ?? defaultStart, day.End ?? defaultEnd);
    }

    /// <summary>The staff member's own shift hours from Nhân viên, when set.</summary>
    private static WorkShift? StaffShift(IdentityUser staff, WorkShiftKind kind)
    {
        var prefix = kind == WorkShiftKind.Morning ? "Morning" : "Afternoon";
        var start = staff.ExtraProperties.GetOrDefault($"{prefix}StartTime") as string;
        var end = staff.ExtraProperties.GetOrDefault($"{prefix}EndTime") as string;

        if (!TimeOnly.TryParse(start, out var s) || !TimeOnly.TryParse(end, out var e) || e <= s)
        {
            return null;
        }

        return new WorkShift(kind, s, e);
    }

    private async Task<TimeKeepingRecord> GetRecordForCurrentBranchAsync(Guid id)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var record = await _repository.GetAsync(id);
        if (record.ClinicBranchId != branchId)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Authorization.CrossBranchAccess,
                "Record does not belong to the current branch.");
        }

        // Out of sight on the Sơ đồ tổ chức means out of reach too (F-67).
        await _scopeResolver.EnsureVisibleAsync([record.StaffId]);
        return record;
    }

    private async Task EnsureSameDayOrManagerAsync(TimeKeepingRecord record)
    {
        if (record.WorkDate == ClinicToday) return;

        if (!await AuthorizationService.IsGrantedAsync(BlueDentalAbilityPermissions.WorkSchedule.AttendanceOthers))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.PastDayAttendance,
                "This change is only allowed on the current day. A manager can override.");
        }
    }

    /// <summary>
    /// The clinic's calendar day (UTC+7, no DST). <c>Clock.Now</c> is UTC, so its
    /// own date runs a day behind between 00:00 and 07:00 local time.
    /// </summary>
    private DateOnly ClinicToday =>
        DateOnly.FromDateTime(DateTime.SpecifyKind(Clock.Now, DateTimeKind.Utc).AddHours(7));

    /// <summary>
    /// The OFF/ON registration toggle and check-in / check-out only work on the
    /// clinic's current day (UTC+7, no DST) — no manager override (BA 2026-10-02).
    /// </summary>
    private void EnsureClinicToday(TimeKeepingRecord record)
    {
        if (record.WorkDate == ClinicToday) return;

        throw new BusinessException(
            BlueDentalDomainErrorCodes.Timekeeping.AttendanceNotToday,
            "Attendance can only be changed on the current day.");
    }

    private async Task<HashSet<Guid>> ResolveBranchIdsAsync()
    {
        var selected = _branchResolver.ClinicBranchId;
        if (selected.HasValue)
            return [selected.Value];

        return await _branchResolver.GetAccessibleBranchIdsAsync();
    }

    private async Task<IQueryable<TimeKeepingRecord>> BuildQueryAsync(GetTimeKeepingListInput input)
    {
        var branchIds = await ResolveBranchIdsAsync();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(x => branchIds.Contains(x.ClinicBranchId));
        if (await _scopeResolver.VisibleScheduleStaffAsync() is { } visible)
        {
            var visibleIds = visible.ToList();
            query = query.Where(x => visibleIds.Contains(x.StaffId));
        }
        if (input.StaffId.HasValue)
            query = query.Where(x => x.StaffId == input.StaffId.Value);
        if (input.FromDate.HasValue)
            query = query.Where(x => x.WorkDate >= input.FromDate.Value);
        if (input.ToDate.HasValue)
            query = query.Where(x => x.WorkDate <= input.ToDate.Value);
        if (input.Registration.HasValue)
            query = query.Where(x => x.Registration == input.Registration.Value);
        if (input.Status.HasValue)
            query = query.Where(x => x.Status == input.Status.Value);

        return query;
    }

    private static WorkShift? BuildShift(WorkShiftKind kind, TimeOnly? start, TimeOnly? end)
    {
        if (!start.HasValue || !end.HasValue)
        {
            return null;
        }

        return new WorkShift(kind, start.Value, end.Value);
    }

    private static WorkShiftDto MapShift(WorkShift shift) => new()
    {
        Kind = shift.Kind,
        PlannedStart = shift.PlannedStart,
        PlannedEnd = shift.PlannedEnd,
        CheckedInAt = shift.CheckedInAt,
        CheckedOutAt = shift.CheckedOutAt,
        PlannedMinutes = shift.PlannedMinutes,
        WorkedMinutes = shift.WorkedMinutes,
        IsOpen = shift.IsOpen
    };

    private static TimeKeepingRecordDto MapToDto(TimeKeepingRecord entity) => new()
    {
        Id = entity.Id,
        StaffId = entity.StaffId,
        ClinicBranchId = entity.ClinicBranchId,
        WorkDate = entity.WorkDate,
        Registration = entity.Registration,
        Status = entity.Status,
        MorningShift = MapShift(entity.MorningShift),
        AfternoonShift = MapShift(entity.AfternoonShift),
        OvertimeMinutes = entity.OvertimeMinutes,
        TotalWorkedMinutes = entity.TotalWorkedMinutes,
        LeaveReason = entity.LeaveReason,
        LeaveShift = entity.LeaveShift,
        LeaveStart = entity.LeaveStart,
        LeaveEnd = entity.LeaveEnd,
        Note = entity.Note,
        RecordedByStaffId = entity.RecordedByStaffId,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
