using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BlueDental.Appointments;
using Microsoft.EntityFrameworkCore;
using Volo.Abp.Domain.Repositories.EntityFrameworkCore;
using Volo.Abp.EntityFrameworkCore;

namespace BlueDental.EntityFrameworkCore.Repositories;

public class EfCoreAppointmentRepository :
    EfCoreRepository<BlueDentalDbContext, Appointment, Guid>,
    IAppointmentRepository
{
    public EfCoreAppointmentRepository(IDbContextProvider<BlueDentalDbContext> dbContextProvider)
        : base(dbContextProvider)
    {
    }

    public async Task<List<Appointment>> GetByDentistAndDateAsync(
        Guid dentistId,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        var dbContext = await GetDbContextAsync();
        var startOfDay = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endOfDay = date.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        return await dbContext.Appointments
            .Where(a =>
                a.DentistId == dentistId
                && a.Slot.Start >= startOfDay
                && a.Slot.Start <= endOfDay)
            .OrderBy(a => a.Slot.Start)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<Appointment>> GetByPatientAsync(
        Guid patientId,
        AppointmentStatus? status = null,
        CancellationToken cancellationToken = default)
    {
        var dbContext = await GetDbContextAsync();
        var query = dbContext.Appointments.Where(a => a.PatientId == patientId);

        if (status.HasValue) query = query.Where(a => a.Status == status.Value);

        return await query.OrderByDescending(a => a.Slot.Start).ToListAsync(cancellationToken);
    }

    public async Task<bool> HasConflictAsync(
        Guid dentistId,
        DateTimeOffset slotStart,
        DateTimeOffset slotEnd,
        Guid? excludeId = null,
        CancellationToken cancellationToken = default)
    {
        var dbContext = await GetDbContextAsync();

        return await dbContext.Appointments
            .Where(a =>
                a.DentistId == dentistId
                && a.Id != (excludeId ?? Guid.Empty)
                && a.Status != AppointmentStatus.Cancelled
                && a.Status != AppointmentStatus.NoShow
                && a.Slot.Start < slotEnd
                && a.Slot.End > slotStart)
            .AnyAsync(cancellationToken);
    }
}
