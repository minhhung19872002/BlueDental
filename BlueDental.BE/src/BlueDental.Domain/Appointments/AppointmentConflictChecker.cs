using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Appointments;

/// <summary>
/// Domain service: checks whether a new appointment slot conflicts with an existing
/// confirmed or in-progress appointment for the same dentist or patient.
/// A visit ended with "Hẹn tái khám" frees its slot the way a cancelled one
/// does (BA): the patient comes back on the booked revisit, so another
/// patient may take the dentist at that time.
/// A dentist double-booking is only a warning (BA 2026-10-16): a patient booked
/// for an hour is often done in fifteen minutes, so the desk may book the rest
/// once the user confirms. A patient double-booking stays refused.
/// </summary>
public class AppointmentConflictChecker : ITransientDependency
{
    private readonly IRepository<Appointment, Guid> _repository;

    public AppointmentConflictChecker(IRepository<Appointment, Guid> repository)
    {
        _repository = repository;
    }

    /// <summary>
    /// Refuses a slot the dentist already has a booking in, unless the user
    /// confirmed the overlap. The error carries the clashing times (clinic
    /// clock, no patient names) so the warning can show them.
    /// </summary>
    public async Task EnsureDentistFreeAsync(
        Guid dentistId,
        Values.AppointmentSlot slot,
        bool allowOverlap,
        Guid? excludeAppointmentId = null)
    {
        if (allowOverlap) return;

        var query = await _repository.GetQueryableAsync();
        var taken = query
            .Where(DentistOverlap(dentistId, slot, excludeAppointmentId))
            .OrderBy(a => a.Slot.Start)
            .Select(a => new { a.Slot.Start, a.Slot.End })
            .ToList();
        if (taken.Count == 0) return;

        throw ConflictingSlot(taken.Select(t => FormatTime(t.Start, t.End)));
    }

    /// <summary>The overlap warning, listing the clashing times already formatted.</summary>
    public static BusinessException ConflictingSlot(IEnumerable<string> slots) =>
        new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.ConflictingSlot,
                "The dentist already has an appointment in this time slot.")
            .WithData("Slots", string.Join(", ", slots));

    /// <summary>"08:00–09:00" on the clinic's wall clock.</summary>
    public static string FormatTime(DateTimeOffset start, DateTimeOffset end) =>
        $"{ClinicCalendar.ToLocal(start):HH:mm}–{ClinicCalendar.ToLocal(end):HH:mm}";

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
            && a.Outcome != AppointmentOutcome.Revisit
            && a.Slot.Start < slot.End
            && a.Slot.End > slot.Start);
    }

    private static System.Linq.Expressions.Expression<Func<Appointment, bool>> DentistOverlap(
        Guid dentistId, Values.AppointmentSlot slot, Guid? excludeAppointmentId)
    {
        var excluded = excludeAppointmentId ?? Guid.Empty;
        return a =>
            a.DentistId == dentistId
            && a.Id != excluded
            && a.Status != AppointmentStatus.Cancelled
            && a.Status != AppointmentStatus.NoShow
            && a.Outcome != AppointmentOutcome.Revisit
            && a.Slot.Start < slot.End
            && a.Slot.End > slot.Start;
    }
}
