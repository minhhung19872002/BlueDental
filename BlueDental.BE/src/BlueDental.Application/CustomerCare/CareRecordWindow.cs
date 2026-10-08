using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.PatientManagement;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Timing;

namespace BlueDental.CustomerCare;

/// <summary>The care records a type's window holds, plus the bookings that decided it.</summary>
public sealed record CareWindowedQuery(IQueryable<CareRecord> Records, IQueryable<Appointment>? Appointments);

/// <summary>
/// Which care records a CSKH tab lists for a date window. Shared by the board
/// (/cskh-grouping) and Báo cáo CSKH (16.11) so the report adds up to the tabs.
/// </summary>
public class CareRecordWindow(
    IRepository<Patient, Guid> patientRepository,
    IRepository<Appointment, Guid> appointmentRepository,
    CareTaskSync taskSync,
    IClock clock) : ITransientDependency
{
    public async Task<CareWindowedQuery> ApplyAsync(
        IQueryable<CareRecord> query,
        CareType? type,
        IReadOnlyList<Guid> branchFilter,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate)
    {
        // Sinh nhật / Nhắc lịch hẹn / Đặt lịch không đến list rows the clinic
        // never filed by hand; make sure each has its task before reading.
        if (type.HasValue && fromDate.HasValue && toDate.HasValue)
            await taskSync.EnsureAsync(type.Value, branchFilter, fromDate.Value, toDate.Value);

        // Sau điều trị has no care date until someone calls, so it is windowed
        // by the clinic day of the treatment instead (owner, 2026-10-05).
        if (type == CareType.AfterTreatment)
        {
            if (fromDate.HasValue)
            {
                var fromDay = ClinicCalendar.DateOf(fromDate.Value);
                query = query.Where(r => r.TreatmentDate >= fromDay);
            }

            if (toDate.HasValue)
            {
                var toDay = ClinicCalendar.DateOf(toDate.Value);
                query = query.Where(r => r.TreatmentDate <= toDay);
            }

            return new CareWindowedQuery(query, null);
        }

        // Chúc mừng sinh nhật is about real birthdays only: a task whose
        // patient has no date of birth, or was not born in the window (say one
        // filed by hand through the API), stays off the tab.
        if (type == CareType.Birthday && fromDate.HasValue && toDate.HasValue)
        {
            var bornInWindow = CareBirthdayRules.PatientIdsBornIn(
                await patientRepository.GetQueryableAsync(),
                ClinicCalendar.DateOf(fromDate.Value),
                ClinicCalendar.DateOf(toDate.Value));
            query = query.Where(r => bornInWindow.Contains(r.PatientId));
        }

        // Nhắc lịch hẹn / Đặt lịch không đến / Lịch hẹn hủy read the window and the rule off
        // the live appointment, so a moved, cancelled or late-arrived booking
        // leaves the tab at once (owner, 2026-10-05).
        if (CareAppointmentRules.IsAppointmentDriven(type))
        {
            var appointments = CareAppointmentRules.Matching(
                await appointmentRepository.GetQueryableAsync(),
                type!.Value, fromDate, toDate, clock.Now);
            var appointmentIds = appointments.Select(a => a.Id);
            query = query.Where(r => r.AppointmentId.HasValue && appointmentIds.Contains(r.AppointmentId.Value));

            return new CareWindowedQuery(query, appointments);
        }

        // The reference windows periodic/special by the care-appointment slot
        // and every other tab by the care date.
        // Npgsql requires UTC offset for timestamptz parameters.
        var bySchedule = type is CareType.Periodic or CareType.Special;
        if (fromDate.HasValue)
        {
            var from = fromDate.Value.ToUniversalTime();
            query = bySchedule
                ? query.Where(r => r.ScheduledStart >= from)
                : query.Where(r => r.DueAt >= from);
        }

        if (toDate.HasValue)
        {
            var to = toDate.Value.ToUniversalTime();
            query = bySchedule
                ? query.Where(r => r.ScheduledStart <= to)
                : query.Where(r => r.DueAt <= to);
        }

        return new CareWindowedQuery(query, null);
    }
}
