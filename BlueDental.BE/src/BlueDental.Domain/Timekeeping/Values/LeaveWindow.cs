using System;
using System.Collections.Generic;
using BlueDental.Values;
using Volo.Abp;

namespace BlueDental.Timekeeping.Values;

/// <summary>
/// The part of one working day a staff member takes off: which shift, and the
/// hours inside it (popup "Đăng ký nghỉ" — "Có thể chỉnh giờ trong phạm vi ca").
/// </summary>
public class LeaveWindow : ComparableValueObject
{
    public LeaveShift Shift { get; }
    public TimeOnly Start { get; }
    public TimeOnly End { get; }

    public LeaveWindow(LeaveShift shift, TimeOnly start, TimeOnly end)
    {
        if (!Enum.IsDefined(shift) || end <= start)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Timekeeping.InvalidLeaveWindow,
                "A leave must end after it starts.");
        }

        Shift = shift;
        Start = start;
        End = end;
    }

    public int Minutes => (int)(End - Start).TotalMinutes;

    protected override IEnumerable<object> GetAtomicValues()
    {
        yield return Shift;
        yield return Start;
        yield return End;
    }
}
