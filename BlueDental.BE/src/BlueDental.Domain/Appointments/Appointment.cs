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

    /// <summary>
    /// Moves the booking to another slot or dentist. The status is not
    /// touched: the edit dialog states the status it wants through
    /// <see cref="ChangeStatus"/>, so a late appointment moved to next week is
    /// still late until someone says otherwise. Only a visit that is in the
    /// chair or over cannot move; a cancelled or late one may be moved and
    /// put back on the book in the same save.
    /// </summary>
    public Appointment Reschedule(AppointmentSlot newSlot, Guid? newDentistId = null)
    {
        var moved = !Slot.ValueEquals(newSlot)
            || (newDentistId.HasValue && newDentistId.Value != DentistId);
        if (!moved) return this;

        if (Status is AppointmentStatus.InProgress or AppointmentStatus.Completed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot reschedule an appointment in status {Status}.");
        }

        Slot = newSlot;
        if (newDentistId.HasValue) DentistId = newDentistId.Value;
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

    /// <summary>
    /// The edit dialog's Trạng thái select, which always offers Đã hẹn, Đã huỷ
    /// and Trễ hẹn. Naming the group the appointment is already in changes
    /// nothing. Cancelling and marking late go through their own transitions;
    /// Đã hẹn puts a cancelled or late appointment back on the book. Arrival
    /// is recorded by reception, so the dialog can neither set an arrival
    /// status nor undo one.
    /// </summary>
    public Appointment ChangeStatus(AppointmentStatus target, CancellationReason cancellationReason)
    {
        if (GroupOf(target) == GroupOf(Status)) return this;

        return target switch
        {
            AppointmentStatus.Cancelled => Cancel(cancellationReason),
            AppointmentStatus.NoShow => (Status == AppointmentStatus.Cancelled ? Restore() : this).MarkNoShow(),
            AppointmentStatus.Requested or AppointmentStatus.Confirmed => Restore(),
            _ => throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot move an appointment to {target} from the edit dialog."),
        };
    }

    /// <summary>
    /// Puts a cancelled or late appointment back on the book as Confirmed and
    /// forgets why it was cancelled. A visit that arrived is not undone here.
    /// </summary>
    public Appointment Restore()
    {
        if (Status is not (AppointmentStatus.Cancelled or AppointmentStatus.NoShow))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot restore an appointment in status {Status}.");
        }

        Status = AppointmentStatus.Confirmed;
        CancellationReason = null;
        CancellationNote = null;
        return this;
    }

    /// <summary>
    /// The four groups the patient screen counts: booked, arrived, cancelled,
    /// late. Requested and Confirmed are both "Đã hẹn"; CheckedIn, InProgress
    /// and Completed are all "Đã đến".
    /// </summary>
    private static int GroupOf(AppointmentStatus status) => status switch
    {
        AppointmentStatus.Requested or AppointmentStatus.Confirmed => 0,
        AppointmentStatus.CheckedIn or AppointmentStatus.InProgress or AppointmentStatus.Completed => 1,
        AppointmentStatus.Cancelled => 2,
        _ => 3,
    };

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
