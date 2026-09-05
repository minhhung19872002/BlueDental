using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.PatientManagement;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Identity;

namespace BlueDental.Data;

/// <summary>
/// Gives every appointment that predates the change history its opening
/// "Tạo mới" row, dated at the appointment's real creation time and signed
/// by whoever created it. Without this the history of an old appointment
/// starts in the middle, with an update to something it never saw created.
///
/// Idempotent: an appointment that already has a row is left alone, so it
/// is safe to run on every migration, in every environment.
/// </summary>
public class BlueDentalAppointmentChangeLogBackfillSeeder(
    IRepository<Appointment, Guid> appointmentRepository,
    IRepository<AppointmentChangeLog, Guid> logRepository,
    IRepository<Patient, Guid> patientRepository,
    IIdentityUserRepository userRepository,
    IGuidGenerator guidGenerator) : IDataSeedContributor, ITransientDependency
{
    private static readonly AppointmentChangeClient SystemClient =
        new(AppointmentChangeSource.System, null, null, null, null);

    public Task SeedAsync(DataSeedContext context) => BackfillAsync();

    public async Task<int> BackfillAsync()
    {
        var logged = (await logRepository.GetListAsync()).Select(l => l.AppointmentId).ToHashSet();
        var appointments = (await appointmentRepository.GetListAsync())
            .Where(a => !logged.Contains(a.Id))
            .ToList();

        if (appointments.Count == 0)
        {
            return 0;
        }

        var userIds = appointments.Select(a => a.DentistId)
            .Concat(appointments.Where(a => a.CreatorId.HasValue).Select(a => a.CreatorId!.Value))
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();
        var users = (await userRepository.GetListByIdsAsync(userIds)).ToDictionary(u => u.Id);

        var patientIds = appointments.Where(a => !a.IsTemporary).Select(a => a.PatientId).Distinct().ToList();
        var patients = (await patientRepository.GetListAsync(p => patientIds.Contains(p.Id)))
            .ToDictionary(p => p.Id);

        var logs = new List<AppointmentChangeLog>(appointments.Count);
        foreach (var appointment in appointments)
        {
            var dentist = users.GetValueOrDefault(appointment.DentistId);
            var patient = appointment.IsTemporary ? null : patients.GetValueOrDefault(appointment.PatientId);
            var creator = appointment.CreatorId.HasValue ? users.GetValueOrDefault(appointment.CreatorId.Value) : null;

            var snapshot = AppointmentSnapshot.From(
                appointment,
                dentist?.Name ?? dentist?.UserName,
                patient is null ? null : (patient.LastName + " " + patient.FirstName).Trim(),
                patient?.Contact.PhoneNumber);

            var actor = new AppointmentChangeActor(
                creator?.Id,
                creator?.Name ?? creator?.UserName,
                creator?.UserName,
                null);

            logs.Add(AppointmentChangeLog.Record(
                guidGenerator.Create(),
                AppointmentChangeAction.Created,
                appointment.Id,
                appointment.PatientId == Guid.Empty ? null : appointment.PatientId,
                appointment.BranchId,
                null,
                snapshot,
                actor,
                SystemClient,
                DateTime.SpecifyKind(appointment.CreationTime, DateTimeKind.Utc)));
        }

        await logRepository.InsertManyAsync(logs, autoSave: true);
        return logs.Count;
    }
}
