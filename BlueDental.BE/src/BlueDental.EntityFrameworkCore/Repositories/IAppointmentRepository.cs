using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using BlueDental.Appointments;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.EntityFrameworkCore.Repositories;

/// <summary>
/// Custom repository interface for appointment-specific queries.
/// </summary>
public interface IAppointmentRepository : IRepository<Appointment, Guid>
{
    Task<List<Appointment>> GetByDentistAndDateAsync(
        Guid dentistId,
        DateOnly date,
        CancellationToken cancellationToken = default);

    Task<List<Appointment>> GetByPatientAsync(
        Guid patientId,
        AppointmentStatus? status = null,
        CancellationToken cancellationToken = default);

    Task<bool> HasConflictAsync(
        Guid dentistId,
        DateTimeOffset slotStart,
        DateTimeOffset slotEnd,
        Guid? excludeId = null,
        CancellationToken cancellationToken = default);
}
