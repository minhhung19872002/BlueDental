using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments.Values;
using BlueDental.Timekeeping;
using BlueDental.Timekeeping.Values;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Appointments;

/// <summary>
/// Domain service: whether a slot sits inside the dentist's shifts that day.
///
/// The shifts are the dentist's Lịch làm việc at the branch: the planned
/// morning and afternoon windows less any leave registered through "Đăng ký
/// nghỉ". With nothing registered the clinic's default 08:00-12:00 and
/// 13:00-17:00 apply. A slot outside them is refused outright, with no
/// override (QA bug row 3; BA: "ngoài giờ làm việc khóa luôn, không cho book").
/// </summary>
public class DentistShiftChecker : ITransientDependency
{
    private readonly IRepository<TimeKeepingRecord, Guid> _timeKeepingRepository;

    public DentistShiftChecker(IRepository<TimeKeepingRecord, Guid> timeKeepingRepository)
    {
        _timeKeepingRepository = timeKeepingRepository;
    }

    /// <summary>Throws Appointment:0008 (or 0009 on a day off) unless the slot fits.</summary>
    public async Task EnsureWithinShiftAsync(
        Guid dentistId,
        Guid branchId,
        AppointmentSlot slot)
    {
        var start = ClinicCalendar.ToLocal(slot.Start);
        var day = DateOnly.FromDateTime(start.DateTime);
        var records = await _timeKeepingRepository.GetListAsync(r =>
            r.StaffId == dentistId && r.ClinicBranchId == branchId && r.WorkDate == day);

        var windows = WorkingWindows(records.FirstOrDefault());
        if (Fits(windows, start, ClinicCalendar.ToLocal(slot.End)))
        {
            return;
        }

        if (windows.Count == 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Appointments.DentistOffDuty);
        }

        throw new BusinessException(BlueDentalDomainErrorCodes.Appointments.OutsideWorkingHours)
            .WithData("Shifts", Describe(windows));
    }

    /// <summary>
    /// The hours the dentist works that day, earliest first, with touching
    /// windows joined. Empty on a day off.
    /// </summary>
    public static IReadOnlyList<ShiftWindow> WorkingWindows(TimeKeepingRecord? record)
    {
        if (record?.Registration == WorkRegistration.DayOff)
        {
            return [];
        }

        var morning = record?.MorningShift ?? WorkShift.DefaultMorning();
        var afternoon = record?.AfternoonShift ?? WorkShift.DefaultAfternoon();
        IEnumerable<ShiftWindow> windows =
        [
            new(morning.PlannedStart, morning.PlannedEnd),
            new(afternoon.PlannedStart, afternoon.PlannedEnd),
        ];

        if (record?.LeaveStart is { } leaveStart && record.LeaveEnd is { } leaveEnd)
        {
            windows = windows.SelectMany(w => w.Without(leaveStart, leaveEnd));
        }

        return Merge(windows.OrderBy(w => w.Start));
    }

    /// <summary>Whether [start, end) on the clinic's wall clock lies inside one window of its own day.</summary>
    public static bool Fits(IReadOnlyList<ShiftWindow> windows, DateTimeOffset localStart, DateTimeOffset localEnd)
    {
        if (DateOnly.FromDateTime(localStart.DateTime) != DateOnly.FromDateTime(localEnd.DateTime))
        {
            return false;
        }

        var start = TimeOnly.FromDateTime(localStart.DateTime);
        var end = TimeOnly.FromDateTime(localEnd.DateTime);
        return windows.Any(w => w.Start <= start && end <= w.End);
    }

    /// <summary>"08:00-12:00, 13:00-17:00".</summary>
    public static string Describe(IEnumerable<ShiftWindow> windows)
        => string.Join(", ", windows.Select(w => $"{w.Start:HH\\:mm}-{w.End:HH\\:mm}"));

    private static List<ShiftWindow> Merge(IEnumerable<ShiftWindow> sorted)
    {
        var merged = new List<ShiftWindow>();
        foreach (var window in sorted)
        {
            if (merged.Count > 0 && merged[^1].End >= window.Start)
            {
                var last = merged[^1];
                merged[^1] = last with { End = window.End > last.End ? window.End : last.End };
            }
            else
            {
                merged.Add(window);
            }
        }

        return merged;
    }
}

/// <summary>One stretch of working hours on the clinic's wall clock.</summary>
public readonly record struct ShiftWindow(TimeOnly Start, TimeOnly End)
{
    /// <summary>What is left of this window once [from, to) is taken out of it.</summary>
    public IEnumerable<ShiftWindow> Without(TimeOnly from, TimeOnly to)
    {
        if (to <= Start || from >= End)
        {
            yield return this;
            yield break;
        }

        if (from > Start)
        {
            yield return new ShiftWindow(Start, from);
        }

        if (to < End)
        {
            yield return new ShiftWindow(to, End);
        }
    }
}
