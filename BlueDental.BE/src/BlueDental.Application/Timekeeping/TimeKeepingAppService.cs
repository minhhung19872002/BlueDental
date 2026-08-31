using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Timekeeping.Values;
using BlueDental.Permissions;
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

    public TimeKeepingAppService(
        IRepository<TimeKeepingRecord, Guid> repository,
        IIdentityUserRepository userRepository,
        ICurrentClinicBranchResolver branchResolver,
        IRepository<StaffBranchAssignment, Guid> assignmentRepository)
    {
        _repository = repository;
        _userRepository = userRepository;
        _branchResolver = branchResolver;
        _assignmentRepository = assignmentRepository;
    }

    /// <summary>
    /// A record stores the staff id; the board shows a person. Nothing filled
    /// this in, so every card on a full roster read "Nhân viên".
    /// </summary>
    private async Task FillStaffNamesAsync(List<TimeKeepingRecordDto> dtos)
    {
        if (dtos.Count == 0)
        {
            return;
        }

        var staffIds = dtos.Select(d => d.StaffId).Distinct().ToList();
        var users = await _userRepository.GetListByIdsAsync(staffIds);
        var names = users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

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
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var today = DateOnly.FromDateTime(Clock.Now);
        if (input.WorkDate != today &&
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
        await EnsureSameDayOrManagerAsync(record);
        record.RegisterWorking();
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<TimeKeepingRecordDto> RegisterDayOffAsync(Guid id, RegisterDayOffInput input)
    {
        var record = await GetRecordForCurrentBranchAsync(id);
        await EnsureSameDayOrManagerAsync(record);
        record.RegisterDayOff(input.Reason);
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<TimeKeepingRecordDto> CheckInAsync(Guid id, AttendanceInput input)
    {
        var record = await GetRecordForCurrentBranchAsync(id);
        await EnsureSameDayOrManagerAsync(record);
        record.CheckIn(input.Shift, input.At ?? Clock.Now, input.RecordedByStaffId);
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalPermissions.Timekeeping.Manage)]
    public async Task<TimeKeepingRecordDto> CheckOutAsync(Guid id, AttendanceInput input)
    {
        var record = await GetRecordForCurrentBranchAsync(id);
        await EnsureSameDayOrManagerAsync(record);
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
            record.MarkNoShow("Đăng ký làm việc nhưng không vào ca.");
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

        var count = 0;
        foreach (var item in input.Items)
        {
            if (lookup.TryGetValue((item.StaffId, item.WorkDate), out var record))
            {
                switch (item.Registration)
                {
                    case WorkRegistration.Working:
                        record.RegisterWorking(force: true);
                        break;
                    case WorkRegistration.DayOff:
                        record.RegisterDayOff(force: true);
                        break;
                    default:
                        record.ResetRegistration(force: true);
                        break;
                }

                await _repository.UpdateAsync(record);
            }
            else
            {
                var newRecord = TimeKeepingRecord.OpenDay(
                    GuidGenerator.Create(),
                    item.StaffId,
                    clinicBranchId,
                    item.WorkDate);

                if (item.Registration == WorkRegistration.Working)
                    newRecord.RegisterWorking();
                else if (item.Registration == WorkRegistration.DayOff)
                    newRecord.RegisterDayOff();

                await _repository.InsertAsync(newRecord);
            }

            count++;
        }

        await CurrentUnitOfWork!.SaveChangesAsync();
        return count;
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
        return record;
    }

    private async Task EnsureSameDayOrManagerAsync(TimeKeepingRecord record)
    {
        var today = DateOnly.FromDateTime(Clock.Now);
        if (record.WorkDate == today) return;

        if (!await AuthorizationService.IsGrantedAsync(BlueDentalAbilityPermissions.WorkSchedule.AttendanceOthers))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.PastDayAttendance,
                "Check-in / check-out is only allowed on the current day. A manager can override.");
        }
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
        Note = entity.Note,
        RecordedByStaffId = entity.RecordedByStaffId,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
