using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.PatientManagement;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Linq;
using Volo.Abp.Timing;
using Volo.Abp.Uow;

namespace BlueDental.CustomerCare;

/// <summary>
/// Gives the generated CSKH tabs a care task for every row they should list
/// in the window being viewed (owner, 2026-10-05), so the row has somewhere to
/// keep its contact state, note and contact log:
///
/// - Chúc mừng sinh nhật: one task per patient per birthday — every patient
///   with a date of birth, old or newly booked, whatever became of the booking.
/// - Nhắc lịch hẹn / Đặt lịch không đến: one task per appointment.
///
/// A task once written is never written again, even after it was deleted.
/// The work runs in its own committed unit of work behind a process-wide gate,
/// because the board asks for the list and the stats at the same moment and
/// both arrive here; the API runs as a single instance.
/// </summary>
public class CareTaskSync : ITransientDependency
{
    /// <summary>The board's widest window is a month; anything wider is not the board.</summary>
    private const int MaxWindowDays = 62;

    private static readonly SemaphoreSlim Gate = new(1, 1);

    private readonly IRepository<CareRecord, Guid> _careRepository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IRepository<Appointment, Guid> _appointmentRepository;
    private readonly IUnitOfWorkManager _unitOfWorkManager;
    private readonly IDataFilter _dataFilter;
    private readonly IGuidGenerator _guidGenerator;
    private readonly IAsyncQueryableExecuter _executer;
    private readonly IClock _clock;

    public CareTaskSync(
        IRepository<CareRecord, Guid> careRepository,
        IRepository<Patient, Guid> patientRepository,
        IRepository<Appointment, Guid> appointmentRepository,
        IUnitOfWorkManager unitOfWorkManager,
        IDataFilter dataFilter,
        IGuidGenerator guidGenerator,
        IAsyncQueryableExecuter executer,
        IClock clock)
    {
        _careRepository = careRepository;
        _patientRepository = patientRepository;
        _appointmentRepository = appointmentRepository;
        _unitOfWorkManager = unitOfWorkManager;
        _dataFilter = dataFilter;
        _guidGenerator = guidGenerator;
        _executer = executer;
        _clock = clock;
    }

    public static bool Generates(CareType? type) =>
        type is CareType.Birthday || CareAppointmentRules.IsAppointmentDriven(type);

    public async Task EnsureAsync(
        CareType type, IReadOnlyList<Guid> branchFilter, DateTimeOffset from, DateTimeOffset to)
    {
        if (!Generates(type) || to < from || (to - from).TotalDays > MaxWindowDays)
        {
            return;
        }

        await Gate.WaitAsync();
        try
        {
            using var uow = _unitOfWorkManager.Begin(requiresNew: true, isTransactional: false);
            if (type == CareType.Birthday)
            {
                await EnsureBirthdaysAsync(branchFilter, ClinicCalendar.DateOf(from), ClinicCalendar.DateOf(to));
            }
            else
            {
                await EnsureAppointmentTasksAsync(type, branchFilter, from, to);
            }

            await uow.CompleteAsync();
        }
        finally
        {
            Gate.Release();
        }
    }

    private async Task EnsureBirthdaysAsync(IReadOnlyList<Guid> branchFilter, DateOnly fromDay, DateOnly toDay)
    {
        var birthdays = new List<(Patient Patient, DateOnly Day)>();
        for (var segment = fromDay; segment <= toDay;)
        {
            var monthEnd = new DateOnly(segment.Year, segment.Month, DateTime.DaysInMonth(segment.Year, segment.Month));
            var segmentEnd = monthEnd < toDay ? monthEnd : toDay;
            birthdays.AddRange(await BirthdaysInAsync(branchFilter, segment, segmentEnd));
            segment = segmentEnd.AddDays(1);
        }

        if (birthdays.Count == 0)
        {
            return;
        }

        var patientIds = birthdays.Select(b => b.Patient.Id).Distinct().ToList();
        var windowStart = ClinicCalendar.StartOfDay(fromDay);
        var windowEnd = ClinicCalendar.StartOfDay(toDay.AddDays(1));

        HashSet<(Guid PatientId, DateOnly Day)> written;
        using (_dataFilter.Disable<ISoftDelete>())
        {
            var query = (await _careRepository.GetQueryableAsync())
                .Where(r => r.Type == CareType.Birthday
                    && patientIds.Contains(r.PatientId)
                    && r.DueAt >= windowStart
                    && r.DueAt < windowEnd)
                .Select(r => new { r.PatientId, r.DueAt });
            written = (await _executer.ToListAsync(query))
                .Select(r => (r.PatientId, ClinicCalendar.DateOf(r.DueAt!.Value)))
                .ToHashSet();
        }

        var fresh = birthdays
            .Where(b => !written.Contains((b.Patient.Id, b.Day)))
            .Select(b => new CareRecord(
                _guidGenerator.Create(),
                b.Patient.Id,
                b.Patient.BranchId,
                CareType.Birthday,
                "Chúc mừng sinh nhật",
                dueAt: ClinicCalendar.StartOfDay(b.Day)))
            .ToList();

        if (fresh.Count > 0)
        {
            await _careRepository.InsertManyAsync(fresh, autoSave: true);
        }
    }

    /// <summary>Patients whose birthday falls on [from, to] of one month.</summary>
    private async Task<IEnumerable<(Patient Patient, DateOnly Day)>> BirthdaysInAsync(
        IReadOnlyList<Guid> branchFilter, DateOnly from, DateOnly to)
    {
        var month = from.Month;
        var firstDay = from.Day;
        var lastDay = to.Day;

        // A 29 February birthday is greeted on the 28th in a common year.
        var leapDayFolds = month == 2 && !DateTime.IsLeapYear(from.Year) && lastDay == 28;
        if (leapDayFolds)
        {
            lastDay = 29;
        }

        var query = (await _patientRepository.GetQueryableAsync())
            .Where(p => p.DateOfBirth.HasValue
                && p.DateOfBirth.Value.Month == month
                && p.DateOfBirth.Value.Day >= firstDay
                && p.DateOfBirth.Value.Day <= lastDay);
        if (branchFilter.Count > 0)
        {
            query = query.Where(p => branchFilter.Contains(p.BranchId));
        }

        var daysInMonth = DateTime.DaysInMonth(from.Year, month);
        return (await _executer.ToListAsync(query))
            .Select(p => (p, new DateOnly(from.Year, month, Math.Min(p.DateOfBirth!.Value.Day, daysInMonth))));
    }

    private async Task EnsureAppointmentTasksAsync(
        CareType type, IReadOnlyList<Guid> branchFilter, DateTimeOffset from, DateTimeOffset to)
    {
        var appointmentQuery = CareAppointmentRules.Matching(
            await _appointmentRepository.GetQueryableAsync(), type, from, to, _clock.Now);
        if (branchFilter.Count > 0)
        {
            appointmentQuery = appointmentQuery.Where(a => branchFilter.Contains(a.BranchId));
        }

        var appointments = await _executer.ToListAsync(appointmentQuery);
        if (appointments.Count == 0)
        {
            return;
        }

        var appointmentIds = appointments.Select(a => a.Id).ToList();
        List<CareRecord> existing;
        using (_dataFilter.Disable<ISoftDelete>())
        {
            existing = await _executer.ToListAsync((await _careRepository.GetQueryableAsync())
                .Where(r => r.Type == type
                    && r.AppointmentId.HasValue
                    && appointmentIds.Contains(r.AppointmentId.Value)));
        }

        var byAppointment = existing
            .GroupBy(r => r.AppointmentId!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        var fresh = new List<CareRecord>();
        foreach (var appointment in appointments)
        {
            var dentistId = appointment.DentistId == Guid.Empty ? (Guid?)null : appointment.DentistId;
            if (byAppointment.TryGetValue(appointment.Id, out var record))
            {
                if (!record.IsDeleted && (record.DueAt != appointment.Slot.Start || record.AssignedStaffId != dentistId))
                {
                    await _careRepository.UpdateAsync(record.FollowAppointment(appointment.Slot.Start, dentistId));
                }

                continue;
            }

            // A Lịch tạm has no patient profile yet: the board shows the
            // booking's own name and phone (PatientId stays empty).
            fresh.Add(new CareRecord(
                _guidGenerator.Create(),
                appointment.PatientId,
                appointment.BranchId,
                type,
                type == CareType.MissedAppointment ? "Đặt lịch không đến" : "Nhắc lịch hẹn",
                dentistId,
                dueAt: appointment.Slot.Start,
                appointmentId: appointment.Id));
        }

        if (fresh.Count > 0)
        {
            await _careRepository.InsertManyAsync(fresh);
        }
    }
}
