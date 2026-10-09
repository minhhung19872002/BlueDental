using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Timekeeping;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Appointments;

/// <summary>
/// Domain service: lays a "Lặp lại lịch hẹn" rule out as sessions and marks
/// each one that cannot be booked ("Trùng lịch"). Every session keeps the
/// first one's clinic wall-clock time and length. A session clashes on the
/// same grounds a single booking is refused: the dentist or the patient is
/// already booked then, or it falls outside the dentist's shifts that day.
/// The whole series is checked in three queries, not three per session.
/// </summary>
public class AppointmentSeriesPlanner : ITransientDependency
{
    private readonly IRepository<Appointment, Guid> _appointmentRepository;
    private readonly IRepository<TimeKeepingRecord, Guid> _timeKeepingRepository;

    public AppointmentSeriesPlanner(
        IRepository<Appointment, Guid> appointmentRepository,
        IRepository<TimeKeepingRecord, Guid> timeKeepingRepository)
    {
        _appointmentRepository = appointmentRepository;
        _timeKeepingRepository = timeKeepingRepository;
    }

    public async Task<IReadOnlyList<PlannedSession>> PlanAsync(
        Guid branchId,
        Guid patientId,
        Guid dentistId,
        DateTimeOffset firstStart,
        DateTimeOffset firstEnd,
        AppointmentRecurrence rule)
    {
        var localStart = ClinicCalendar.ToLocal(firstStart);
        var time = TimeOnly.FromDateTime(localStart.DateTime);
        var length = firstEnd - firstStart;
        var sessions = rule.DatesFrom(DateOnly.FromDateTime(localStart.DateTime))
            .Select(day => (Day: day, Start: ClinicCalendar.AtLocal(day, time)))
            .ToList();

        var from = sessions[0].Start;
        var to = sessions[^1].Start + length;
        var busy = await BlockingAsync(patientId, dentistId, from, to);
        var firstDay = sessions[0].Day;
        var lastDay = sessions[^1].Day;
        var records = (await _timeKeepingRepository.GetListAsync(r =>
                r.StaffId == dentistId && r.ClinicBranchId == branchId
                && r.WorkDate >= firstDay && r.WorkDate <= lastDay))
            .GroupBy(r => r.WorkDate)
            .ToDictionary(g => g.Key, g => g.First());

        // The minute already under way still counts, as for a single booking.
        var utcNow = DateTimeOffset.UtcNow;
        var nowMinute = new DateTimeOffset(utcNow.Ticks - utcNow.Ticks % TimeSpan.TicksPerMinute, TimeSpan.Zero);
        return sessions.Select((s, i) =>
        {
            var end = s.Start + length;
            var reason = ReasonFor(s.Day, s.Start, end, nowMinute, records, busy, patientId, dentistId);
            return new PlannedSession(i + 1, s.Start, end, reason);
        }).ToList();
    }

    private static SeriesConflictReason? ReasonFor(
        DateOnly day,
        DateTimeOffset start,
        DateTimeOffset end,
        DateTimeOffset nowMinute,
        IReadOnlyDictionary<DateOnly, TimeKeepingRecord> records,
        IReadOnlyList<Appointment> busy,
        Guid patientId,
        Guid dentistId)
    {
        if (start < nowMinute) return SeriesConflictReason.InThePast;

        var windows = DentistShiftChecker.WorkingWindows(records.GetValueOrDefault(day));
        if (windows.Count == 0) return SeriesConflictReason.DentistOff;
        if (!DentistShiftChecker.Fits(windows, ClinicCalendar.ToLocal(start), ClinicCalendar.ToLocal(end)))
        {
            return SeriesConflictReason.OutsideShift;
        }

        var overlapping = busy.Where(a => a.Slot.Start < end && a.Slot.End > start).ToList();
        if (overlapping.Any(a => a.DentistId == dentistId)) return SeriesConflictReason.DentistBusy;
        if (overlapping.Any(a => a.PatientId == patientId)) return SeriesConflictReason.PatientBusy;
        return null;
    }

    /// <summary>
    /// The dentist's and the patient's bookings in the series' span that hold
    /// their slot — the rule <see cref="AppointmentConflictChecker"/> applies.
    /// </summary>
    private async Task<List<Appointment>> BlockingAsync(
        Guid patientId, Guid dentistId, DateTimeOffset from, DateTimeOffset to)
    {
        return await _appointmentRepository.GetListAsync(a =>
            (a.DentistId == dentistId || a.PatientId == patientId)
            && a.Status != AppointmentStatus.Cancelled
            && a.Status != AppointmentStatus.NoShow
            && a.Outcome != AppointmentOutcome.Revisit
            && a.Slot.Start < to
            && a.Slot.End > from);
    }
}

/// <summary>One session a recurring rule lays out; <see cref="Conflict"/> says why it cannot be booked.</summary>
public sealed record PlannedSession(int Index, DateTimeOffset Start, DateTimeOffset End, SeriesConflictReason? Conflict);
