using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Timekeeping;

public class WorkShiftDto
{
    public WorkShiftKind Kind { get; set; }
    public TimeOnly PlannedStart { get; set; }
    public TimeOnly PlannedEnd { get; set; }
    public DateTimeOffset? CheckedInAt { get; set; }
    public DateTimeOffset? CheckedOutAt { get; set; }
    public int PlannedMinutes { get; set; }
    public int WorkedMinutes { get; set; }
    public bool IsOpen { get; set; }
}

public class TimeKeepingRecordDto : FullAuditedEntityDto<Guid>
{
    public Guid StaffId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public DateOnly WorkDate { get; set; }
    public WorkRegistration Registration { get; set; }
    public AttendanceStatus Status { get; set; }
    public WorkShiftDto MorningShift { get; set; } = new();
    public WorkShiftDto AfternoonShift { get; set; } = new();
    public int OvertimeMinutes { get; set; }
    public int TotalWorkedMinutes { get; set; }
    public string? LeaveReason { get; set; }
    public LeaveShift? LeaveShift { get; set; }
    public TimeOnly? LeaveStart { get; set; }
    public TimeOnly? LeaveEnd { get; set; }
    public string? Note { get; set; }
    public Guid? RecordedByStaffId { get; set; }

    public string? StaffName { get; set; }
    public string? StaffPosition { get; set; }
}

public class GetTimeKeepingListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public Guid? StaffId { get; set; }
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }
    public WorkRegistration? Registration { get; set; }
    public AttendanceStatus? Status { get; set; }
}

/// <summary>KPI bar above the "BE:Perm:WorkSchedule" board.</summary>
public class TimeKeepingSummaryDto
{
    public DateOnly WorkDate { get; set; }

    /// <summary>Tổng CBNV — staff with a record for the day.</summary>
    public int TotalStaff { get; set; }

    /// <summary>Đăng kí làm.</summary>
    public int RegisteredWorking { get; set; }

    /// <summary>Đăng kí nghỉ.</summary>
    public int RegisteredDayOff { get; set; }

    /// <summary>Đang làm việc.</summary>
    public int CurrentlyWorking { get; set; }

    /// <summary>Nghỉ ngang.</summary>
    public int Abandoned { get; set; }

    /// <summary>Giờ tăng ca, in minutes.</summary>
    public int TotalOvertimeMinutes { get; set; }
}

public class OpenWorkDayDto
{
    public Guid StaffId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public DateOnly WorkDate { get; set; }
    public TimeOnly? MorningStart { get; set; }
    public TimeOnly? MorningEnd { get; set; }
    public TimeOnly? AfternoonStart { get; set; }
    public TimeOnly? AfternoonEnd { get; set; }
}

public class AttendanceInput
{
    public WorkShiftKind Shift { get; set; }
    public DateTimeOffset? At { get; set; }

    /// <summary>
    /// Set when a supervisor clocks the staff member in or out
    /// (permission <c>workSchedule.attendanceOthers</c>).
    /// </summary>
    public Guid? RecordedByStaffId { get; set; }
}

public class RegisterDayOffInput
{
    public string? Reason { get; set; }
}

public class AddOvertimeInput
{
    public int Minutes { get; set; }
}

public class UpdateInfoInput
{
    public string? Note { get; set; }
    public TimeOnly? MorningStart { get; set; }
    public TimeOnly? MorningEnd { get; set; }
    public TimeOnly? AfternoonStart { get; set; }
    public TimeOnly? AfternoonEnd { get; set; }
    public bool MorningEnabled { get; set; } = true;
    public bool AfternoonEnabled { get; set; } = true;
    public int? OvertimeMinutes { get; set; }
}

public class BulkRegisterItem
{
    public Guid StaffId { get; set; }
    public DateOnly WorkDate { get; set; }
    public WorkRegistration Registration { get; set; }
}

public class BulkRegisterInput
{
    public List<BulkRegisterItem> Items { get; set; } = new();
}

/// <summary>One day of the "Đăng ký nghỉ" popup.</summary>
public class RegisterLeaveDayInput
{
    public DateOnly WorkDate { get; set; }
    public LeaveShift Shift { get; set; }

    /// <summary>Defaults to the start of the chosen shift.</summary>
    public TimeOnly? Start { get; set; }

    /// <summary>Defaults to the end of the chosen shift.</summary>
    public TimeOnly? End { get; set; }
}

/// <summary>Đăng ký nghỉ nhiều ngày cho một nhân viên.</summary>
public class RegisterLeaveInput
{
    public Guid StaffId { get; set; }

    [StringLength(500)]
    public string? Reason { get; set; }

    [Required]
    [MinLength(1)]
    [MaxLength(62)]
    public List<RegisterLeaveDayInput> Days { get; set; } = new();
}
