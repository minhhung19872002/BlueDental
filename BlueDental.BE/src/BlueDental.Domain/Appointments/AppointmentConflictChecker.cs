using System;
using System.Threading;
using System.Threading.Tasks;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Appointments;

/// <summary>
/// Domain service: checks whether a new appointment slot conflicts with an existing
/// confirmed or in-progress appointment for the same dentist or patient.
/// </summary>
public class AppointmentConflictChecker : ITransientDependency
{
    private readonly IRepository<Appointment, Guid> _repository;

    public AppointmentConflictChecker(IRepository<Appointment, Guid> repository)
    {
        _repository = repository;
    }

    /// <summary>
    /// Returns true when the proposed slot causes a conflict for the given dentist.
    /// </summary>
    public async Task<bool> HasDentistConflictAsync(
        Guid dentistId,
        Values.AppointmentSlot slot,
        Guid? excludeAppointmentId = null,
        CancellationToken cancellationToken = default)
    {
        var query = await _repository.GetQueryableAsync();
        return query.Any(a =>
            a.DentistId == dentistId
            && a.Id != (excludeAppointmentId ?? Guid.Empty)
            && a.Status != AppointmentStatus.Cancelled
            && a.Status != AppointmentStatus.NoShow
            && a.Slot.Start < slot.End
            && a.Slot.End > slot.Start);
    }

    /// <summary>
    /// Returns true when the patient already has a confirmed appointment overlapping the slot.
    /// </summary>
    public async Task<bool> HasPatientConflictAsync(
        Guid patientId,
        Values.AppointmentSlot slot,
        Guid? excludeAppointmentId = null,
        CancellationToken cancellationToken = default)
    {
        var query = await _repository.GetQueryableAsync();
        return query.Any(a =>
            a.PatientId == patientId
            && a.Id != (excludeAppointmentId ?? Guid.Empty)
            && a.Status != AppointmentStatus.Cancelled
            && a.Status != AppointmentStatus.NoShow
            && a.Slot.Start < slot.End
            && a.Slot.End > slot.Start);
    }
}
