using System;
using BlueDental.Appointments.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Appointments;

/// <summary>
/// Aggregate root for the Appointments bounded context.
/// Manages the full lifecycle: Requested → Confirmed → CheckedIn → InProgress → Completed / Cancelled / NoShow.
/// </summary>
public class Appointment : FullAuditedAggregateRoot<Guid>
{
    public Guid PatientId { get; private set; }
    public Guid DentistId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid? ProcedureId { get; private set; }
    public AppointmentSlot Slot { get; private set; } = default!;
    public AppointmentStatus Status { get; private set; }
    public AppointmentType Type { get; private set; }
    public string? ChiefComplaint { get; private set; }
    public string? Notes { get; private set; }
    public string? Color { get; private set; }
    public CancellationReason? CancellationReason { get; private set; }
    public string? CancellationNote { get; private set; }
    public DateTimeOffset? CheckedInAt { get; private set; }
    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public AppointmentOutcome? Outcome { get; private set; }

    public bool IsTemporary { get; private set; }
    public string? PatientName { get; private set; }
    public string? PatientPhone { get; private set; }
    public Guid? SourceTaxonomyId { get; private set; }
    public Guid? SourceEntryId { get; private set; }

    protected Appointment() { }

    public Appointment(
        Guid id,
        Guid patientId,
        Guid dentistId,
        Guid branchId,
        AppointmentSlot slot,
        AppointmentType type,
        Guid? procedureId = null,
        string? chiefComplaint = null,
        string? color = null,
        string? notes = null)
        : base(id)
    {
        PatientId = patientId;
        DentistId = dentistId;
        BranchId = branchId;
        Slot = slot;
        Type = type;
        ProcedureId = procedureId;
        ChiefComplaint = chiefComplaint;
        Color = color;
        Notes = notes;
        Status = AppointmentStatus.Requested;
    }

    public static Appointment CreateTemporary(
        Guid id,
        string patientName,
        string? patientPhone,
        Guid branchId,
        AppointmentSlot slot,
        Guid? dentistId = null,
        Guid? sourceTaxonomyId = null,
        Guid? sourceEntryId = null,
        string? color = null,
        string? notes = null)
    {
        Check.NotNullOrWhiteSpace(patientName, nameof(patientName));

        return new Appointment
        {
            Id = id,
            PatientId = Guid.Empty,
            DentistId = dentistId ?? Guid.Empty,
            BranchId = branchId,
            Slot = slot,
            Type = AppointmentType.Consultation,
            Status = AppointmentStatus.Requested,
            IsTemporary = true,
            PatientName = patientName,
            PatientPhone = patientPhone,
            SourceTaxonomyId = sourceTaxonomyId,
            SourceEntryId = sourceEntryId,
            Color = color,
            Notes = notes,
        };
    }

    public Appointment Confirm()
    {
        EnsureStatus(AppointmentStatus.Requested, nameof(Confirm));
        Status = AppointmentStatus.Confirmed;
        return this;
    }

    public Appointment Cancel(CancellationReason reason, string? note = null)
    {
        if (Status is AppointmentStatus.Completed or AppointmentStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot cancel an appointment in status {Status}.");
        }

        Status = AppointmentStatus.Cancelled;
        CancellationReason = reason;
        CancellationNote = note;
        return this;
    }

    public Appointment CheckIn()
    {
        if (Status is not (AppointmentStatus.Requested or AppointmentStatus.Confirmed))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot perform 'CheckIn' on appointment with status '{Status}'. Expected 'Requested' or 'Confirmed'.");
        }

        Status = AppointmentStatus.CheckedIn;
        CheckedInAt = DateTimeOffset.UtcNow;
        return this;
    }

    public Appointment Start()
    {
        EnsureStatus(AppointmentStatus.CheckedIn, nameof(Start));
        Status = AppointmentStatus.InProgress;
        StartedAt = DateTimeOffset.UtcNow;
        return this;
    }

    public Appointment Complete(string? notes = null)
    {
        EnsureStatus(AppointmentStatus.InProgress, nameof(Complete));
        Status = AppointmentStatus.Completed;
        CompletedAt = DateTimeOffset.UtcNow;
        Notes = notes;
        return this;
    }

    public Appointment MarkNoShow()
    {
        if (Status is not (AppointmentStatus.Confirmed or AppointmentStatus.Requested))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot mark no-show an appointment in status {Status}.");
        }

        Status = AppointmentStatus.NoShow;
        return this;
    }

    public Appointment Reschedule(AppointmentSlot newSlot, Guid? newDentistId = null)
    {
        if (Status is AppointmentStatus.Completed
            or AppointmentStatus.Cancelled
            or AppointmentStatus.InProgress)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot reschedule an appointment in status {Status}.");
        }

        Slot = newSlot;
        if (newDentistId.HasValue) DentistId = newDentistId.Value;
        Status = AppointmentStatus.Confirmed;
        return this;
    }

    public Appointment AssignDentist(Guid dentistId)
    {
        if (Status is AppointmentStatus.Completed or AppointmentStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot reassign dentist on an appointment in status {Status}.");
        }

        DentistId = dentistId;
        return this;
    }

    public Appointment SetOutcome(AppointmentOutcome outcome)
    {
        if (Status is AppointmentStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot set outcome on a cancelled appointment.");
        }

        Outcome = outcome;
        return this;
    }

    public Appointment UpdateDetails(
        string? chiefComplaint = null,
        string? notes = null,
        string? color = null)
    {
        ChiefComplaint = chiefComplaint;
        Notes = notes;
        Color = color;
        return this;
    }

    public Appointment UpdateTempPatientInfo(string patientName, string? patientPhone)
    {
        if (!IsTemporary)
            throw new BusinessException("BlueDental:Appointment:0010", "Cannot update patient info on a non-temporary appointment.");

        Check.NotNullOrWhiteSpace(patientName, nameof(patientName));
        PatientName = patientName;
        PatientPhone = patientPhone;
        return this;
    }

    public Appointment UpdateSourceInfo(Guid? sourceTaxonomyId, Guid? sourceEntryId)
    {
        SourceTaxonomyId = sourceTaxonomyId;
        SourceEntryId = sourceEntryId;
        return this;
    }

    private void EnsureStatus(AppointmentStatus expected, string operation)
    {
        if (Status != expected)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot perform '{operation}' on appointment with status '{Status}'. Expected '{expected}'.");
        }
    }
}
