using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments.Values;
using BlueDental.Timekeeping;
using BlueDental.Timekeeping.Values;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Appointments;

/// <summary>
/// Domain service: whether the dentist has registered the slot's time off.
///
/// Time off comes from the Lịch nghỉ board (F-90, R-1210): S nghỉ sáng, C nghỉ
/// chiều, SC nghỉ cả ngày — and, for a day from before the board, the old
/// "Đăng ký nghỉ" (see <see cref="TimeKeepingRecord.OffShift"/>). The day splits
/// at midday: nghỉ sáng refuses a slot starting before the afternoon shift
/// starts, nghỉ chiều one ending after the morning shift ends, evenings
/// included. A day with nothing off can be booked at any hour — the profile
/// hours no longer fence a booking (owner, 2026-11-11).
/// </summary>
public class DentistShiftChecker : ITransientDependency
{
    private readonly IRepository<TimeKeepingRecord, Guid> _timeKeepingRepository;
    private readonly IIdentityUserRepository _userRepository;

    public DentistShiftChecker(
        IRepository<TimeKeepingRecord, Guid> timeKeepingRepository,
        IIdentityUserRepository userRepository)
    {
        _timeKeepingRepository = timeKeepingRepository;
        _userRepository = userRepository;
    }

    /// <summary>
    /// Throws Appointment:0009 when the dentist is off that whole day, 0019
    /// when off that morning and the slot starts before the afternoon, 0020
    /// when off that afternoon and the slot ends after the morning.
    /// </summary>
    public async Task EnsureWithinShiftAsync(
        Guid dentistId,
        Guid branchId,
        AppointmentSlot slot)
    {
        var start = ClinicCalendar.ToLocal(slot.Start);
        var day = DateOnly.FromDateTime(start.DateTime);
        var record = (await _timeKeepingRepository.GetListAsync(r =>
            r.StaffId == dentistId && r.ClinicBranchId == branchId && r.WorkDate == day)).FirstOrDefault();
        if (record is null || record.OffShift == WorkScheduleShift.None)
        {
            return;
        }

        var (morning, afternoon) = PlannedShifts(record);
        switch (OffConflict(record, start, ClinicCalendar.ToLocal(slot.End)))
        {
            case WorkScheduleShift.FullDay:
                throw new BusinessException(BlueDentalDomainErrorCodes.Appointments.DentistOffDuty);
            case WorkScheduleShift.Morning:
                throw new BusinessException(BlueDentalDomainErrorCodes.Appointments.DentistOffMorning)
                    .WithData("From", $"{afternoon.Start:HH\\:mm}");
            case WorkScheduleShift.Afternoon:
                throw new BusinessException(BlueDentalDomainErrorCodes.Appointments.DentistOffAfternoon)
                    .WithData("Until", $"{morning.End:HH\\:mm}");
        }
    }

    /// <summary>
    /// The part of the day off that [<paramref name="localStart"/>, <paramref name="localEnd"/>)
    /// runs into, or <see cref="WorkScheduleShift.None"/> when the slot is free to book.
    /// The split is the record's planned shifts, which every record carries.
    /// </summary>
    public static WorkScheduleShift OffConflict(
        TimeKeepingRecord? record, DateTimeOffset localStart, DateTimeOffset localEnd)
    {
        var off = record?.OffShift ?? WorkScheduleShift.None;
        if (off == WorkScheduleShift.None)
        {
            return WorkScheduleShift.None;
        }

        var (morning, afternoon) = PlannedShifts(record);
        return OffConflict(off, morning, afternoon, localStart, localEnd);
    }

    /// <summary>
    /// The same split for a day off not yet saved: the Lịch nghỉ board asks it
    /// of an appointment already booked before letting <paramref name="off"/> stand.
    /// </summary>
    public static WorkScheduleShift OffConflict(
        WorkScheduleShift off, ShiftWindow morning, ShiftWindow afternoon,
        DateTimeOffset localStart, DateTimeOffset localEnd)
    {
        var blocked = off switch
        {
            WorkScheduleShift.FullDay => true,
            WorkScheduleShift.Morning => ToMinute(localStart) < afternoon.Start,
            WorkScheduleShift.Afternoon =>
                DateOnly.FromDateTime(localEnd.DateTime) != DateOnly.FromDateTime(localStart.DateTime)
                || ToMinute(localEnd) > morning.End,
            _ => false
        };
        return blocked ? off : WorkScheduleShift.None;
    }

    /// <summary>
    /// The dentist's working day for each date in [<paramref name="from"/>, <paramref name="to"/>]
    /// at the branch, as "Chọn lịch hẹn tiếp theo" draws it: the planned morning and
    /// afternoon, and what of them <see cref="EnsureWithinShiftAsync"/> would accept.
    /// </summary>
    public async Task<List<DentistWorkDay>> GetWorkDaysAsync(Guid dentistId, Guid branchId, DateOnly from, DateOnly to)
    {
        var records = (await _timeKeepingRepository.GetListAsync(r =>
                r.StaffId == dentistId && r.ClinicBranchId == branchId && r.WorkDate >= from && r.WorkDate <= to))
            .GroupBy(r => r.WorkDate)
            .ToDictionary(g => g.Key, g => g.First());
        var dentist = await _userRepository.FindAsync(dentistId, includeDetails: false);

        var days = new List<DentistWorkDay>();
        for (var day = from; day <= to; day = day.AddDays(1))
        {
            var record = records.GetValueOrDefault(day);
            var (morning, afternoon) = PlannedShifts(record, dentist);
            days.Add(new DentistWorkDay(day, morning, afternoon, WorkingWindows(record, dentist)));
        }

        return days;
    }

    /// <summary>
    /// The morning and afternoon the day is planned around: the record's, else
    /// the profile hours, else the clinic default. A day off or leave does not
    /// change them — <see cref="WorkingWindows"/> takes those out.
    /// </summary>
    public static (ShiftWindow Morning, ShiftWindow Afternoon) PlannedShifts(
        TimeKeepingRecord? record, IHasExtraProperties? dentist = null)
    {
        var morning = record?.MorningShift ?? StaffWorkingHours.PlannedOrDefault(dentist, WorkShiftKind.Morning);
        var afternoon = record?.AfternoonShift ?? StaffWorkingHours.PlannedOrDefault(dentist, WorkShiftKind.Afternoon);
        return (new(morning.PlannedStart, morning.PlannedEnd), new(afternoon.PlannedStart, afternoon.PlannedEnd));
    }

    /// <summary>
    /// The planned hours the dentist is not off that day, earliest first, with
    /// touching windows joined: both shifts, the afternoon on nghỉ sáng, the
    /// morning on nghỉ chiều, none on nghỉ cả ngày. <paramref name="dentist"/>
    /// supplies the profile hours for a day with no record.
    /// </summary>
    public static IReadOnlyList<ShiftWindow> WorkingWindows(TimeKeepingRecord? record, IHasExtraProperties? dentist = null)
    {
        var (morning, afternoon) = PlannedShifts(record, dentist);
        IEnumerable<ShiftWindow> windows = (record?.OffShift ?? WorkScheduleShift.None) switch
        {
            WorkScheduleShift.FullDay => [],
            WorkScheduleShift.Morning => [afternoon],
            WorkScheduleShift.Afternoon => [morning],
            _ => [morning, afternoon]
        };

        return Merge(windows.OrderBy(w => w.Start));
    }

    private static TimeOnly ToMinute(DateTimeOffset local)
        => new(local.Hour, local.Minute);

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

/// <summary>
/// One day of a dentist's Lịch làm việc: the planned shifts, and the
/// <see cref="Windows"/> left to book in them — empty on a day off.
/// </summary>
public sealed record DentistWorkDay(
    DateOnly Date,
    ShiftWindow Morning,
    ShiftWindow Afternoon,
    IReadOnlyList<ShiftWindow> Windows);

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
