using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Timekeeping;

/// <summary>
/// Chấm công / Lịch làm việc — reference: <c>/api/v1/time-keepings/*</c>.
/// </summary>
public interface ITimeKeepingAppService : IApplicationService
{
    Task<PagedResultDto<TimeKeepingRecordDto>> GetListAsync(GetTimeKeepingListInput input);
    Task<TimeKeepingRecordDto> GetAsync(Guid id);

    /// <summary>KPI bar for one branch and one day.</summary>
    Task<TimeKeepingSummaryDto> GetSummaryAsync(Guid clinicBranchId, DateOnly workDate);

    /// <summary>Creates the day record if it does not exist yet, then returns it.</summary>
    Task<TimeKeepingRecordDto> OpenWorkDayAsync(OpenWorkDayDto input);

    Task<TimeKeepingRecordDto> RegisterWorkingAsync(Guid id);
    Task<TimeKeepingRecordDto> RegisterDayOffAsync(Guid id, RegisterDayOffInput input);
    Task<TimeKeepingRecordDto> CheckInAsync(Guid id, AttendanceInput input);
    Task<TimeKeepingRecordDto> CheckOutAsync(Guid id, AttendanceInput input);
    Task<TimeKeepingRecordDto> AddOvertimeAsync(Guid id, AddOvertimeInput input);
    Task<TimeKeepingRecordDto> UpdateInfoAsync(Guid id, UpdateInfoInput input);

    /// <summary>Closes every shift still open on the given day as "nghỉ ngang".</summary>
    Task<int> CloseAbandonedShiftsAsync(Guid clinicBranchId, DateOnly workDate);

    /// <summary>
    /// Sets or clears the caller's own day off (X) on many days (Work Schedule Builder).
    /// Creates records if they do not exist. Refuses the whole batch if any cell is
    /// another staff member's, a past day, clocked in, or planned as working.
    /// </summary>
    Task<int> BulkRegisterAsync(BulkRegisterInput input);
}
