using System;
using System.Collections.Generic;
using BlueDental.Timekeeping.Values;
using Volo.Abp.Data;

namespace BlueDental.Timekeeping;

/// <summary>
/// The working hours set on a staff member's profile (Nhân viên → giờ làm),
/// stored as "HH:mm" extra properties on the user. A day with no Chấm công
/// record takes these hours, and the clinic default only where they are unset.
/// </summary>
public static class StaffWorkingHours
{
    /// <summary>The profile's shift of that kind, or null when unset or malformed.</summary>
    public static WorkShift? FromProfile(IHasExtraProperties? staff, WorkShiftKind kind)
    {
        if (staff is null)
        {
            return null;
        }

        var prefix = kind == WorkShiftKind.Morning ? "Morning" : "Afternoon";
        var start = staff.ExtraProperties.GetOrDefault($"{prefix}StartTime") as string;
        var end = staff.ExtraProperties.GetOrDefault($"{prefix}EndTime") as string;

        if (!TimeOnly.TryParse(start, out var s) || !TimeOnly.TryParse(end, out var e) || e <= s)
        {
            return null;
        }

        return new WorkShift(kind, s, e);
    }

    /// <summary>The profile's shift of that kind, else the clinic default.</summary>
    public static WorkShift PlannedOrDefault(IHasExtraProperties? staff, WorkShiftKind kind)
        => FromProfile(staff, kind)
           ?? (kind == WorkShiftKind.Morning ? WorkShift.DefaultMorning() : WorkShift.DefaultAfternoon());
}
