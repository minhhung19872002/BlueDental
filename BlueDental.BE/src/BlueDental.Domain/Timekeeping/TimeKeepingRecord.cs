using System;
using BlueDental.Timekeeping.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Timekeeping;

/// <summary>
/// One staff member's attendance for one working day at one branch
/// (Chấm công / Lịch làm việc).
///
/// Reference: <c>/api/v1/time-keepings/list</c> and the "BE:Perm:WorkSchedule" tab of
/// the calendar screen, where each staff card shows an ON/OFF registration
/// toggle, the planned shifts and the actual VÀO CA - RA CA times.
/// </summary>
public class TimeKeepingRecord : FullAuditedAggregateRoot<Guid>
{
    public Guid StaffId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>The working day this record covers.</summary>
    public DateOnly WorkDate { get; private set; }

    public WorkRegistration Registration { get; private set; }
    public AttendanceStatus Status { get; private set; }

    public WorkShift MorningShift { get; private set; } = default!;
    public WorkShift AfternoonShift { get; private set; } = default!;

    /// <summary>Giờ tăng ca, in minutes.</summary>
    public int OvertimeMinutes { get; private set; }

    /// <summary>Reason supplied when the staff member registers a day off.</summary>
    public string? LeaveReason { get; private set; }

    /// <summary>
    /// Shift covered by a leave registered through "Đăng ký nghỉ"; null for a
    /// plain day off toggled on the schedule grid.
    /// </summary>
    public LeaveShift? LeaveShift { get; private set; }

    public TimeOnly? LeaveStart { get; private set; }
    public TimeOnly? LeaveEnd { get; private set; }

    public string? Note { get; private set; }

    /// <summary>
    /// Set when someone other than the staff member clocked them in or out
    /// (permission <c>workSchedule.attendanceOthers</c> in the reference).
    /// </summary>
    public Guid? RecordedByStaffId { get; private set; }

    protected TimeKeepingRecord() { }

    public static TimeKeepingRecord OpenDay(
        Guid id,
        Guid staffId,
        Guid clinicBranchId,
        DateOnly workDate,
        WorkShift? morningShift = null,
        WorkShift? afternoonShift = null)
    {
        return new TimeKeepingRecord
        {
            Id = id,
            StaffId = staffId,
            ClinicBranchId = clinicBranchId,
            WorkDate = workDate,
            MorningShift = morningShift ?? WorkShift.DefaultMorning(),
            AfternoonShift = afternoonShift ?? WorkShift.DefaultAfternoon(),
            Registration = WorkRegistration.NotRegistered,
            Status = AttendanceStatus.NotStarted,
            OvertimeMinutes = 0
        };
    }

    /// <summary>Đăng kí làm.</summary>
    public TimeKeepingRecord RegisterWorking(bool force = false)
    {
        if (!force && HasAnyAttendance)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.RegistrationLocked,
                "Registration can no longer change once a shift has been checked in.");
        }

        Registration = WorkRegistration.Working;
        LeaveReason = null;
        ClearLeaveWindow();

        if (Status == AttendanceStatus.OnLeave)
        {
            Status = AttendanceStatus.NotStarted;
        }

        return this;
    }

    /// <summary>Đăng kí nghỉ.</summary>
    public TimeKeepingRecord RegisterDayOff(string? reason = null, bool force = false)
    {
        if (!force && HasAnyAttendance)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.RegistrationLocked,
                "A day off cannot be registered after a shift has been checked in.");
        }

        Registration = WorkRegistration.DayOff;
        LeaveReason = reason;
        Status = AttendanceStatus.OnLeave;
        ClearLeaveWindow();

        if (force && HasAnyAttendance)
        {
            MorningShift = new WorkShift(MorningShift.Kind, MorningShift.PlannedStart, MorningShift.PlannedEnd);
            AfternoonShift = new WorkShift(AfternoonShift.Kind, AfternoonShift.PlannedStart, AfternoonShift.PlannedEnd);
        }

        return this;
    }

    /// <summary>
    /// Đăng ký nghỉ theo ca. A full-day leave is a day off; a half-day leave
    /// keeps the day registered as working, since the other shift is still worked.
    /// The hours must sit inside the planned window of the shift they cover.
    /// </summary>
    public TimeKeepingRecord RegisterLeave(LeaveWindow leave, string? reason = null)
    {
        if (HasAnyAttendance)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.RegistrationLocked,
                "A leave cannot be registered after a shift has been checked in.");
        }

        var (windowStart, windowEnd) = leave.Shift switch
        {
            Timekeeping.LeaveShift.Morning => (MorningShift.PlannedStart, MorningShift.PlannedEnd),
            Timekeeping.LeaveShift.Afternoon => (AfternoonShift.PlannedStart, AfternoonShift.PlannedEnd),
            _ => (MorningShift.PlannedStart, AfternoonShift.PlannedEnd)
        };

        if (leave.Start < windowStart || leave.End > windowEnd)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.InvalidLeaveWindow,
                "The leave must fall inside the planned window of its shift.");
        }

        var isFullDay = leave.Shift == Timekeeping.LeaveShift.FullDay;
        Registration = isFullDay ? WorkRegistration.DayOff : WorkRegistration.Working;
        Status = isFullDay ? AttendanceStatus.OnLeave : AttendanceStatus.NotStarted;
        LeaveReason = reason;
        LeaveShift = leave.Shift;
        LeaveStart = leave.Start;
        LeaveEnd = leave.End;
        return this;
    }

    /// <summary>Vào ca.</summary>
    public TimeKeepingRecord CheckIn(WorkShiftKind shift, DateTimeOffset at, Guid? recordedByStaffId = null)
    {
        if (Registration == WorkRegistration.DayOff)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.CheckInOnDayOff,
                "Cannot check in on a day registered as off.");
        }

        ApplyToShift(shift, s => s.CheckIn(at));

        Registration = WorkRegistration.Working;
        Status = AttendanceStatus.Working;
        RecordedByStaffId = recordedByStaffId;
        return this;
    }

    /// <summary>Ra ca.</summary>
    public TimeKeepingRecord CheckOut(WorkShiftKind shift, DateTimeOffset at, Guid? recordedByStaffId = null)
    {
        ApplyToShift(shift, s => s.CheckOut(at));

        Status = HasOpenShift ? AttendanceStatus.Working : AttendanceStatus.Completed;
        RecordedByStaffId = recordedByStaffId;
        return this;
    }

    /// <summary>
    /// Nghỉ ngang — closes the day when a shift was started but never checked out.
    /// Applied by the end-of-day job.
    /// </summary>
    public TimeKeepingRecord MarkAbandoned(string? note = null)
    {
        if (!HasOpenShift)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.NoOpenShift,
                "There is no open shift to mark as abandoned.");
        }

        Status = AttendanceStatus.Abandoned;
        Note = note;
        return this;
    }

    /// <summary>
    /// Vắng không báo trước — registered Working but never checked in.
    /// Applied by the end-of-day job for no-show staff.
    /// </summary>
    public TimeKeepingRecord MarkNoShow(string? note = null)
    {
        if (HasAnyAttendance)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.RegistrationLocked,
                "Cannot mark as no-show after attendance has been recorded.");
        }

        Status = AttendanceStatus.Abandoned;
        Note = note;
        return this;
    }

    public TimeKeepingRecord ResetRegistration(bool force = false)
    {
        if (!force && HasAnyAttendance)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.RegistrationLocked,
                "Cannot reset registration after attendance has been recorded.");
        }

        Registration = WorkRegistration.NotRegistered;
        LeaveReason = null;
        ClearLeaveWindow();
        Status = AttendanceStatus.NotStarted;

        if (force && HasAnyAttendance)
        {
            MorningShift = new WorkShift(MorningShift.Kind, MorningShift.PlannedStart, MorningShift.PlannedEnd);
            AfternoonShift = new WorkShift(AfternoonShift.Kind, AfternoonShift.PlannedStart, AfternoonShift.PlannedEnd);
        }

        return this;
    }

    public TimeKeepingRecord AddOvertime(int minutes)
    {
        if (minutes < 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.InvalidOvertime,
                "Overtime minutes must not be negative.");
        }

        OvertimeMinutes += minutes;
        return this;
    }

    public TimeKeepingRecord RescheduleShifts(WorkShift morningShift, WorkShift afternoonShift)
    {
        if (HasAnyAttendance)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.RegistrationLocked,
                "Shifts cannot be rescheduled after attendance has been recorded.");
        }

        MorningShift = morningShift;
        AfternoonShift = afternoonShift;
        return this;
    }

    public TimeKeepingRecord UpdateNote(string? note)
    {
        Note = note;
        return this;
    }

    public bool HasAnyAttendance => MorningShift.IsStarted || AfternoonShift.IsStarted;

    public bool HasOpenShift => MorningShift.IsOpen || AfternoonShift.IsOpen;

    /// <summary>Total minutes actually worked across both shifts, overtime included.</summary>
    public int TotalWorkedMinutes =>
        MorningShift.WorkedMinutes + AfternoonShift.WorkedMinutes + OvertimeMinutes;

    private void ClearLeaveWindow()
    {
        LeaveShift = null;
        LeaveStart = null;
        LeaveEnd = null;
    }

    private void ApplyToShift(WorkShiftKind kind, Func<WorkShift, WorkShift> transition)
    {
        if (kind == WorkShiftKind.Morning)
        {
            MorningShift = transition(MorningShift);
        }
        else
        {
            AfternoonShift = transition(AfternoonShift);
        }
    }
}
