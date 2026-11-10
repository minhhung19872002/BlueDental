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
    /// The half of the day signed up for on the Lịch làm việc board (BA P0911,
    /// F-90) — Morning or Afternoon; FullDay for SC. Null for a day registered
    /// before the board, or by the old toggles, which keeps its whole plan.
    /// </summary>
    public WorkScheduleShift? ScheduledShift { get; private set; }

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
        ScheduledShift = null;

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
        ScheduledShift = null;

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
        ScheduledShift = null;
        return this;
    }

    /// <summary>
    /// Đăng ký ca on the Lịch làm việc board (F-90): S, C or SC registers the day
    /// as working that half or whole; <see cref="WorkScheduleShift.None"/> takes
    /// the sign-up back. A leave or day off on the day is replaced.
    /// </summary>
    public TimeKeepingRecord ScheduleShift(WorkScheduleShift shift)
    {
        if (HasAnyAttendance)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.RegistrationLocked,
                "The schedule can no longer change once a shift has been checked in.");
        }

        LeaveReason = null;
        ClearLeaveWindow();
        Status = AttendanceStatus.NotStarted;
        Registration = shift == WorkScheduleShift.None ? WorkRegistration.NotRegistered : WorkRegistration.Working;
        ScheduledShift = shift == WorkScheduleShift.None ? null : shift;
        return this;
    }

    /// <summary>
    /// The shift the board shows for the day. A day registered before the board
    /// reads from its leave: working with the afternoon off is Ca sáng, with the
    /// morning off Ca chiều, otherwise Cả ngày. A day off reads as none.
    /// </summary>
    public WorkScheduleShift CurrentScheduledShift => Registration != WorkRegistration.Working
        ? WorkScheduleShift.None
        : ScheduledShift ?? LeaveShift switch
        {
            Timekeeping.LeaveShift.Afternoon => WorkScheduleShift.Morning,
            Timekeeping.LeaveShift.Morning => WorkScheduleShift.Afternoon,
            _ => WorkScheduleShift.FullDay
        };

    /// <summary>Vào ca.</summary>
    public TimeKeepingRecord CheckIn(WorkShiftKind shift, DateTimeOffset at, Guid? recordedByStaffId = null)
    {
        if (Registration == WorkRegistration.DayOff)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.CheckInOnDayOff,
                "Cannot check in on a day registered as off.");
        }

        var dueAt = ClinicCalendar.AtLocal(WorkDate, DueStartOf(shift));
        ApplyToShift(shift, s => s.CheckIn(at, dueAt));

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
        ScheduledShift = null;
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

    /// <summary>
    /// Moves the planned windows. Allowed after a check-in too (owner 2026-10-13:
    /// a dentist kept on to 19:00 is edited the same day) — the clock in/out
    /// already recorded stays on its shift; only the plan moves.
    /// </summary>
    public TimeKeepingRecord RescheduleShifts(WorkShift morningShift, WorkShift afternoonShift)
    {
        MorningShift = MorningShift.Reschedule(morningShift.PlannedStart, morningShift.PlannedEnd);
        AfternoonShift = AfternoonShift.Reschedule(afternoonShift.PlannedStart, afternoonShift.PlannedEnd);
        return this;
    }

    public TimeKeepingRecord UpdateNote(string? note)
    {
        Note = note;
        return this;
    }

    /// <summary>
    /// The clinic-local time a shift is due to start: its planned start, or the
    /// end of a leave that opens the shift (nghỉ 08:00-10:00 → due at 10:00).
    /// The board flips a card to OFF at the same moment (BA 2026-10-14).
    /// </summary>
    public TimeOnly DueStartOf(WorkShiftKind kind)
    {
        var shift = kind == WorkShiftKind.Morning ? MorningShift : AfternoonShift;
        var leaveCoversShift = LeaveShift == (kind == WorkShiftKind.Morning
            ? Timekeeping.LeaveShift.Morning
            : Timekeeping.LeaveShift.Afternoon);

        return leaveCoversShift && LeaveStart <= shift.PlannedStart && LeaveEnd > shift.PlannedStart
            ? LeaveEnd!.Value
            : shift.PlannedStart;
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
