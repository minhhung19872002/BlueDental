using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.PatientManagement;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Linq;

namespace BlueDental.Appointments;

/// <summary>
/// Moves bookings whose start time has passed without an arrival to Trễ hẹn
/// (bug list item 17: a 09:30 booking the patient never came to still read
/// "Đã đặt lịch" the next day; owner 2026-10-06: late as soon as the time
/// passes, no grace). Each move is written to the appointment history with no
/// actor, so it reads as done by the system. Reception can still check the
/// patient in if they turn up late after all.
/// </summary>
public class MissedAppointmentMarker(
    IRepository<Appointment, Guid> repository,
    IRepository<Patient, Guid> patientRepository,
    IIdentityUserRepository userRepository,
    IAsyncQueryableExecuter asyncExecuter,
    AppointmentChangeRecorder changeRecorder) : ITransientDependency
{
    /// <summary>Kept small so one pass stays one short unit of work; the next pass takes the rest.</summary>
    public const int BatchSize = 200;

    /// <returns>The branches whose bookings were moved to Trễ hẹn — empty when none was.</returns>
    public async Task<IReadOnlyCollection<Guid>> MarkAsync(DateTimeOffset now)
    {
        // Npgsql requires UTC offset for timestamptz parameters.
        var cutoff = now.ToUniversalTime();
        var query = await repository.GetQueryableAsync();
        var missed = await asyncExecuter.ToListAsync(query
            .Where(a => (a.Status == AppointmentStatus.Requested || a.Status == AppointmentStatus.Confirmed)
                && a.Slot.Start <= cutoff)
            .OrderBy(a => a.Slot.Start)
            .Take(BatchSize));

        if (missed.Count == 0) return [];

        var patientIds = missed.Where(a => !a.IsTemporary).Select(a => a.PatientId).Distinct().ToList();
        var patientQuery = await patientRepository.GetQueryableAsync();
        var patients = (await asyncExecuter.ToListAsync(patientQuery.Where(p => patientIds.Contains(p.Id))))
            .ToDictionary(p => p.Id, p => (Name: (p.LastName + " " + p.FirstName).Trim(), Phone: p.Contact.PhoneNumber));

        var dentistIds = missed.Where(a => a.DentistId != Guid.Empty).Select(a => a.DentistId).Distinct().ToList();
        var dentists = (await userRepository.GetListByIdsAsync(dentistIds))
            .ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        foreach (var appointment in missed)
        {
            var patient = patients.GetValueOrDefault(appointment.PatientId);
            var dentistName = dentists.GetValueOrDefault(appointment.DentistId);
            var before = AppointmentSnapshot.From(appointment, dentistName, patient.Name, patient.Phone);

            appointment.MarkNoShow();
            await repository.UpdateAsync(appointment, autoSave: true);
            await changeRecorder.RecordAsync(
                AppointmentChangeAction.StatusChanged,
                appointment,
                before,
                AppointmentSnapshot.From(appointment, dentistName, patient.Name, patient.Phone));
        }

        return missed.Select(a => a.BranchId).Distinct().ToList();
    }
}
