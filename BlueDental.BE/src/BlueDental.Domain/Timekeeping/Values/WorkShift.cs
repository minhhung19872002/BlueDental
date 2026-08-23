using System;
using System.Collections.Generic;
using BlueDental.Values;
using Volo.Abp;

namespace BlueDental.Timekeeping.Values;

/// <summary>
/// One half-day shift: the planned window plus the actual clock in/out.
///
/// Reference UI: "LỊCH LÀM VIỆC 08:00 - 12:00" over "VÀO CA - RA CA -- / --".
/// </summary>
public class WorkShift : ComparableValueObject
{
    public WorkShiftKind Kind { get; private set; }

    /// <summary>Planned start of the shift (clinic schedule).</summary>
    public TimeOnly PlannedStart { get; private set; }

    /// <summary>Planned end of the shift.</summary>
    public TimeOnly PlannedEnd { get; private set; }

    /// <summary>Actual clock-in, when the staff member started the shift.</summary>
    public DateTimeOffset? CheckedInAt { get; private set; }

    /// <summary>Actual clock-out.</summary>
    public DateTimeOffset? CheckedOutAt { get; private set; }

    protected WorkShift() { }

    public WorkShift(
        WorkShiftKind kind,
        TimeOnly plannedStart,
        TimeOnly plannedEnd,
        DateTimeOffset? checkedInAt = null,
        DateTimeOffset? checkedOutAt = null)
    {
        if (plannedEnd <= plannedStart)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.InvalidShiftWindow,
                "A shift must end after it starts.");
        }

        if (checkedOutAt.HasValue && !checkedInAt.HasValue)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.CheckOutWithoutCheckIn,
                "A shift cannot be checked out before it is checked in.");
        }

        if (checkedInAt.HasValue && checkedOutAt.HasValue && checkedOutAt.Value < checkedInAt.Value)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.InvalidShiftWindow,
                "Check-out must not be earlier than check-in.");
        }

        Kind = kind;
        PlannedStart = plannedStart;
        PlannedEnd = plannedEnd;
        CheckedInAt = checkedInAt;
        CheckedOutAt = checkedOutAt;
    }

    /// <summary>Default clinic shifts observed in the reference: 08:00-12:00 and 13:00-17:00.</summary>
    public static WorkShift DefaultMorning() =>
        new(WorkShiftKind.Morning, new TimeOnly(8, 0), new TimeOnly(12, 0));

    public static WorkShift DefaultAfternoon() =>
        new(WorkShiftKind.Afternoon, new TimeOnly(13, 0), new TimeOnly(17, 0));

    public bool IsStarted => CheckedInAt.HasValue;
    public bool IsClosed => CheckedInAt.HasValue && CheckedOutAt.HasValue;

    /// <summary>Open shift: clocked in but never clocked out (nghỉ ngang candidate).</summary>
    public bool IsOpen => CheckedInAt.HasValue && !CheckedOutAt.HasValue;

    public int PlannedMinutes => (int)(PlannedEnd - PlannedStart).TotalMinutes;

    public int WorkedMinutes =>
        IsClosed ? (int)(CheckedOutAt!.Value - CheckedInAt!.Value).TotalMinutes : 0;

    public WorkShift CheckIn(DateTimeOffset at)
    {
        if (IsStarted)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.ShiftAlreadyCheckedIn,
                $"The {Kind} shift has already been checked in.");
        }

        return new WorkShift(Kind, PlannedStart, PlannedEnd, at);
    }

    public WorkShift CheckOut(DateTimeOffset at)
    {
        if (!IsStarted)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.CheckOutWithoutCheckIn,
                $"The {Kind} shift has not been checked in.");
        }

        if (IsClosed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.ShiftAlreadyCheckedOut,
                $"The {Kind} shift has already been checked out.");
        }

        return new WorkShift(Kind, PlannedStart, PlannedEnd, CheckedInAt, at);
    }

    public WorkShift Reschedule(TimeOnly plannedStart, TimeOnly plannedEnd)
        => new(Kind, plannedStart, plannedEnd, CheckedInAt, CheckedOutAt);

    protected override IEnumerable<object?> GetAtomicValues()
    {
        yield return Kind;
        yield return PlannedStart;
        yield return PlannedEnd;
        yield return CheckedInAt;
        yield return CheckedOutAt;
    }
}
