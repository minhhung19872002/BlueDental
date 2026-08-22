using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Timekeeping.Values;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Timekeeping;

/// <summary>
/// Chấm công / Lịch làm việc.
/// </summary>
[Authorize]
public class TimeKeepingAppService : ApplicationService, ITimeKeepingAppService
{
    private readonly IRepository<TimeKeepingRecord, Guid> _repository;

    public TimeKeepingAppService(IRepository<TimeKeepingRecord, Guid> repository)
    {
        _repository = repository;
    }

    [Authorize(BlueDentalAbilityPermissions.WorkSchedule.Read)]
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

        return new PagedResultDto<TimeKeepingRecordDto>(totalCount, items.Select(MapToDto).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.WorkSchedule.Read)]
    public async Task<TimeKeepingRecordDto> GetAsync(Guid id)
    {
        return MapToDto(await _repository.GetAsync(id));
    }

    [Authorize(BlueDentalAbilityPermissions.WorkSchedule.Read)]
    public async Task<TimeKeepingSummaryDto> GetSummaryAsync(Guid clinicBranchId, DateOnly workDate)
    {
        var query = await _repository.GetQueryableAsync();
        var records = query
            .Where(x => x.ClinicBranchId == clinicBranchId && x.WorkDate == workDate)
            .ToList();

        return new TimeKeepingSummaryDto
        {
            WorkDate = workDate,
            TotalStaff = records.Count,
            RegisteredWorking = records.Count(x => x.Registration == WorkRegistration.Working),
            RegisteredDayOff = records.Count(x => x.Registration == WorkRegistration.DayOff),
            CurrentlyWorking = records.Count(x => x.Status == AttendanceStatus.Working),
            Abandoned = records.Count(x => x.Status == AttendanceStatus.Abandoned),
            TotalOvertimeMinutes = records.Sum(x => x.OvertimeMinutes)
        };
    }

    [Authorize(BlueDentalAbilityPermissions.WorkSchedule.Update)]
    public async Task<TimeKeepingRecordDto> OpenWorkDayAsync(OpenWorkDayDto input)
    {
        var query = await _repository.GetQueryableAsync();
        var existing = query.FirstOrDefault(x =>
            x.ClinicBranchId == input.ClinicBranchId &&
            x.StaffId == input.StaffId &&
            x.WorkDate == input.WorkDate);

        if (existing != null)
        {
            return MapToDto(existing);
        }

        var record = TimeKeepingRecord.OpenDay(
            GuidGenerator.Create(),
            input.StaffId,
            input.ClinicBranchId,
            input.WorkDate,
            BuildShift(WorkShiftKind.Morning, input.MorningStart, input.MorningEnd),
            BuildShift(WorkShiftKind.Afternoon, input.AfternoonStart, input.AfternoonEnd));

        await _repository.InsertAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalAbilityPermissions.WorkSchedule.Update)]
    public async Task<TimeKeepingRecordDto> RegisterWorkingAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        record.RegisterWorking();
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalAbilityPermissions.WorkSchedule.Update)]
    public async Task<TimeKeepingRecordDto> RegisterDayOffAsync(Guid id, RegisterDayOffInput input)
    {
        var record = await _repository.GetAsync(id);
        record.RegisterDayOff(input.Reason);
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    public async Task<TimeKeepingRecordDto> CheckInAsync(Guid id, AttendanceInput input)
    {
        var record = await _repository.GetAsync(id);
        await CheckAttendancePermissionAsync(record, input.RecordedByStaffId);
        record.CheckIn(input.Shift, input.At ?? Clock.Now, input.RecordedByStaffId);
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    public async Task<TimeKeepingRecordDto> CheckOutAsync(Guid id, AttendanceInput input)
    {
        var record = await _repository.GetAsync(id);
        await CheckAttendancePermissionAsync(record, input.RecordedByStaffId);
        record.CheckOut(input.Shift, input.At ?? Clock.Now, input.RecordedByStaffId);
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalAbilityPermissions.WorkSchedule.Update)]
    public async Task<TimeKeepingRecordDto> AddOvertimeAsync(Guid id, AddOvertimeInput input)
    {
        var record = await _repository.GetAsync(id);
        record.AddOvertime(input.Minutes);
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalAbilityPermissions.WorkSchedule.Update)]
    public async Task<int> CloseAbandonedShiftsAsync(Guid clinicBranchId, DateOnly workDate)
    {
        var query = await _repository.GetQueryableAsync();
        var records = query
            .Where(x => x.ClinicBranchId == clinicBranchId && x.WorkDate == workDate)
            .ToList()
            .Where(x => x.HasOpenShift)
            .ToList();

        foreach (var record in records)
        {
            record.MarkAbandoned("Tự động đóng cuối ngày.");
            await _repository.UpdateAsync(record);
        }

        return records.Count;
    }

    /// <summary>
    /// Clocking yourself in or out needs <c>workSchedule.update</c>; doing it for
    /// somebody else needs <c>workSchedule.attendanceOthers</c>, exactly as the
    /// reference splits the two.
    /// </summary>
    private async Task CheckAttendancePermissionAsync(TimeKeepingRecord record, Guid? recordedByStaffId)
    {
        var isSelf = recordedByStaffId is null || recordedByStaffId == record.StaffId;

        await AuthorizationService.CheckAsync(isSelf
            ? BlueDentalAbilityPermissions.WorkSchedule.Update
            : BlueDentalAbilityPermissions.WorkSchedule.AttendanceOthers);
    }

    private async Task<IQueryable<TimeKeepingRecord>> BuildQueryAsync(GetTimeKeepingListInput input)
    {
        var query = await _repository.GetQueryableAsync();

        if (input.ClinicBranchId.HasValue)
            query = query.Where(x => x.ClinicBranchId == input.ClinicBranchId.Value);
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
