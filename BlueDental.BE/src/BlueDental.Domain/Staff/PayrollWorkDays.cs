using System.Collections.Generic;
using System.Linq;
using BlueDental.Timekeeping;

namespace BlueDental.Staff;

/// <summary>
/// Cụm 11 mục 6 — what one staff member's chấm công of a month comes to for
/// Bảng lương: ngày công, ngày nghỉ phép and minutes of tăng ca.
/// </summary>
public sealed record PayrollWorkDays(decimal WorkedDays, decimal LeaveDays, int OvertimeMinutes)
{
    public static readonly PayrollWorkDays None = new(0m, 0m, 0);

    /// <summary>
    /// A shift clocked in and out is half a day — an abandoned shift (no
    /// check-out) and a no-show count nothing. A full-day "Đăng ký nghỉ" is one
    /// day of leave, a half-day one half of one. Tăng ca is the minutes recorded on
    /// the day, whatever else happened.
    /// </summary>
    public static PayrollWorkDays Of(IEnumerable<TimeKeepingRecord> records)
    {
        var list = records.ToList();
        if (list.Count == 0) return None;

        var worked = list.Sum(r =>
            (r.MorningShift.IsClosed ? 0.5m : 0m) + (r.AfternoonShift.IsClosed ? 0.5m : 0m));

        // Only "Đăng ký nghỉ" is leave: a day simply registered off (the
        // rota's day off) is neither worked nor leave.
        var leave = list.Sum(r => r.LeaveShift switch
        {
            LeaveShift.FullDay => 1m,
            LeaveShift.Morning or LeaveShift.Afternoon => 0.5m,
            _ => 0m,
        });

        return new PayrollWorkDays(worked, leave, list.Sum(r => r.OvertimeMinutes));
    }
}
