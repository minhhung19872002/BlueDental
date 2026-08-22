using System;
using BlueDental.Timekeeping.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Timekeeping;

/// <summary>
/// One staff member's attendance for one working day at one branch
/// (Chấm công / Lịch làm việc).
///
/// Reference: <c>/api/v1/time-keepings/list</c> and the "Lịch làm việc" tab of
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
    public TimeKeepingRecord RegisterWorking()
    {
        if (HasAnyAttendance)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.RegistrationLocked,
                "Registration can no longer change once a shift has been checked in.");
        }

        Registration = WorkRegistration.Working;
        LeaveReason = null;

        if (Status == AttendanceStatus.OnLeave)
        {
            Status = AttendanceStatus.NotStarted;
        }

        return this;
    }

    /// <summary>Đăng kí nghỉ.</summary>
    public TimeKeepingRecord RegisterDayOff(string? reason = null)
    {
        if (HasAnyAttendance)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.RegistrationLocked,
                "A day off cannot be registered after a shift has been checked in.");
        }

        Registration = WorkRegistration.DayOff;
        LeaveReason = reason;
        Status = AttendanceStatus.OnLeave;
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
