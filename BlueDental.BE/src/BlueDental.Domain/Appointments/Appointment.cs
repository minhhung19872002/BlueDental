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
    /// <summary>When it was cancelled — the last step of the reception progress bar.</summary>
    public DateTimeOffset? CancelledAt { get; private set; }
    public AppointmentOutcome? Outcome { get; private set; }

    /// <summary>The appointment booked through "Đã hẹn tiếp", if any.</summary>
    public Guid? FollowUpAppointmentId { get; private set; }

    public bool IsTemporary { get; private set; }
    public string? PatientName { get; private set; }
    public string? PatientPhone { get; private set; }
    public Guid? SourceTaxonomyId { get; private set; }
    public Guid? SourceEntryId { get; private set; }

    /// <summary>The "Lặp lại lịch hẹn" series this booking is a session of, if any.</summary>
    public Guid? SeriesId { get; private set; }

    /// <summary>
    /// Where the series first put this session. Comparing it with the slot
    /// today tells "Đổi giờ" (same day, new time) from "Đã đổi lịch" (another day).
    /// </summary>
    public DateTimeOffset? SeriesPlannedStart { get; private set; }

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

    /// <summary>
    /// Cancels the booking. The written reason is mandatory (bug list #16):
    /// customer care calls the patient back from it on the "Lịch hẹn hủy" list.
    /// </summary>
    public Appointment Cancel(CancellationReason reason, string? note)
    {
        if (Status is AppointmentStatus.Completed or AppointmentStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot cancel an appointment in status {Status}.");
        }

        if (string.IsNullOrWhiteSpace(note))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Appointments.CancellationReasonRequired);
        }

        Status = AppointmentStatus.Cancelled;
        CancellationReason = reason;
        CancellationNote = note.Trim();
        CancelledAt = DateTimeOffset.UtcNow;
        return this;
    }

    /// <summary>
    /// Records the arrival. A Trễ hẹn booking is still received: a patient who
    /// turns up after the booked time was late, not absent (bug list item 17).
    /// </summary>
    public Appointment CheckIn()
    {
        if (Status is not (AppointmentStatus.Requested or AppointmentStatus.Confirmed or AppointmentStatus.NoShow))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot perform 'CheckIn' on appointment with status '{Status}'. Expected 'Requested', 'Confirmed' or 'NoShow'.");
        }

        Status = AppointmentStatus.CheckedIn;
        CheckedInAt = DateTimeOffset.UtcNow;
        return this;
    }

    /// <summary>
    /// A patient arrives on the day they are booked for: a booking on 21/10
    /// cannot be received on 07/10, and its wait timer must not start (bug list
    /// item 25). Only a booking not yet received is checked — every step that
    /// would receive it (check-in, and Start/Complete/Hẹn tái khám, which check
    /// in on the way) asks first. Kept out of <see cref="CheckIn"/> so seeding a
    /// past day's visits still works.
    /// </summary>
    public void EnsureCanArriveOn(DateOnly today)
    {
        // TEMP-BUG25-OFF (2026-10-07): BA asked to switch the same-day check-in
        // rule off while they test. Uncomment to restore it — grep the tag for
        // the two FE locks that go with it.
        // if ((Status is AppointmentStatus.Requested or AppointmentStatus.Confirmed or AppointmentStatus.NoShow)
        //     && ClinicCalendar.DateOf(Slot.Start) != today)
        // {
        //     throw new BusinessException(
        //         BlueDentalDomainErrorCodes.Appointments.CheckInNotToday,
        //         "Only a booking for today can be checked in.");
        // }
    }

    public Appointment Start()
    {
        // Auto check-in if not done yet (outcome shortcuts skip the step buttons).
        if (Status is AppointmentStatus.Requested or AppointmentStatus.Confirmed)
            CheckIn();

        EnsureStatus(AppointmentStatus.CheckedIn, nameof(Start));
        Status = AppointmentStatus.InProgress;
        StartedAt = DateTimeOffset.UtcNow;
        return this;
    }

    public Appointment Complete(string? notes = null)
    {
        // Auto advance through earlier steps when an outcome shortcut fires.
        if (Status is AppointmentStatus.Requested or AppointmentStatus.Confirmed)
            CheckIn();
        if (Status is AppointmentStatus.CheckedIn)
            Start();

        EnsureStatus(AppointmentStatus.InProgress, nameof(Complete));
        Status = AppointmentStatus.Completed;
        CompletedAt = DateTimeOffset.UtcNow;
        Notes = notes;
        return this;
    }

    /// <summary>
    /// Trễ hẹn by the clock: the booked start time has passed and the patient
    /// has not arrived — the booking is still only Đã hẹn / Đã xác nhận.
    /// </summary>
    public bool IsMissedAt(DateTimeOffset now) =>
        Status is AppointmentStatus.Requested or AppointmentStatus.Confirmed
        && Slot.Start <= now;

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
    /// status nor undo one. Cancelling needs <paramref name="cancellationNote"/>.
    /// </summary>
    public Appointment ChangeStatus(
        AppointmentStatus target,
        CancellationReason cancellationReason,
        string? cancellationNote = null)
    {
        if (GroupOf(target) == GroupOf(Status)) return this;

        return target switch
        {
            AppointmentStatus.Cancelled => Cancel(cancellationReason, cancellationNote),
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
        CancelledAt = null;
        return this;
    }

    /// <summary>
    /// The four groups the patient screen counts: booked, arrived, cancelled,
    /// late. Requested and Confirmed are both "BE:Status:Scheduled"; CheckedIn, InProgress
    /// and Completed are all "BE:Status:Arrived".
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

    /// <summary>
    /// "Đã hẹn tiếp": the visit ends with the next appointment already on the
    /// book. Books it for the same patient in the same branch — with this
    /// visit's dentist unless another is named — and links it here, so the
    /// outcome can never be set without a date behind it. Only one live
    /// follow-up per visit — moving it is done on the booked appointment
    /// itself — but one that was cancelled or deleted may be replaced.
    /// </summary>
    /// <param name="currentFollowUp">
    /// The appointment <see cref="FollowUpAppointmentId"/> points at, or null
    /// when there is none or it has been deleted.
    /// </param>
    /// <param name="outcome">
    /// "Đã hẹn tiếp" or "Hẹn tái khám" — both need a booked date behind them.
    /// </param>
    public Appointment BookFollowUp(
        Guid followUpId,
        AppointmentSlot slot,
        Appointment? currentFollowUp,
        Guid? dentistId = null,
        string? chiefComplaint = null,
        AppointmentOutcome outcome = AppointmentOutcome.FollowUp)
    {
        if (outcome is not (AppointmentOutcome.FollowUp or AppointmentOutcome.Revisit))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Outcome {outcome} is not booked with a next appointment.");
        }

        var hasLiveFollowUp = currentFollowUp is { Status: not AppointmentStatus.Cancelled };
        if (Status is AppointmentStatus.Cancelled || IsTemporary || hasLiveFollowUp)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.InvalidTransition,
                $"Cannot book a follow-up from appointment {Id} (status {Status}).");
        }

        var followUp = new Appointment(
            followUpId,
            PatientId,
            dentistId ?? DentistId,
            BranchId,
            slot,
            AppointmentType.FollowUp,
            chiefComplaint: chiefComplaint);

        // "Hẹn tái khám" moves the bar one step, and that step is the last one
        // ("Đã hẹn lại") with its time: a visit not yet in the chair stops at
        // step 2, one already in the chair finishes at step 3. "Đã hẹn tiếp"
        // leaves the bar where it is.
        if (outcome is AppointmentOutcome.Revisit)
        {
            if (Status is AppointmentStatus.InProgress)
                Complete(Notes);
            else if (Status is not AppointmentStatus.Completed)
                Start();
        }

        Outcome = outcome;
        FollowUpAppointmentId = followUpId;
        return followUp;
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

    /// <summary>
    /// "Lịch tạm" → a real booking once the walk-in has a patient record: the
    /// appointment now belongs to that patient and stops carrying its own name
    /// and phone.
    /// </summary>
    public Appointment AttachPatient(Guid patientId)
    {
        if (!IsTemporary)
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.NotTemporary,
                $"Appointment {Id} is not temporary.");

        Check.NotDefaultOrNull<Guid>(patientId, nameof(patientId));
        PatientId = patientId;
        IsTemporary = false;
        PatientName = null;
        PatientPhone = null;
        return this;
    }

    public Appointment UpdateSourceInfo(Guid? sourceTaxonomyId, Guid? sourceEntryId)
    {
        SourceTaxonomyId = sourceTaxonomyId;
        SourceEntryId = sourceEntryId;
        return this;
    }

    /// <summary>Makes this freshly booked appointment a session of <paramref name="seriesId"/>.</summary>
    public Appointment JoinSeries(Guid seriesId)
    {
        Check.NotDefaultOrNull<Guid>(seriesId, nameof(seriesId));
        SeriesId = seriesId;
        SeriesPlannedStart = Slot.Start;
        return this;
    }

    /// <summary>
    /// A finished session of a series ("Kết thúc") is read-only: it can be
    /// neither edited nor deleted (BA).
    /// </summary>
    public void EnsureSeriesSessionEditable()
    {
        if (SeriesId.HasValue && Status is AppointmentStatus.Completed)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Appointments.SeriesSessionFinished);
        }
    }

    /// <summary>How this session of a series stands against what the series planned.</summary>
    public SeriesOccurrenceState SeriesState()
    {
        if (Status is AppointmentStatus.Completed) return SeriesOccurrenceState.Finished;
        if (Status is AppointmentStatus.Cancelled) return SeriesOccurrenceState.Cancelled;
        if (SeriesPlannedStart is not { } planned || planned == Slot.Start) return SeriesOccurrenceState.Booked;

        return ClinicCalendar.DateOf(planned) == ClinicCalendar.DateOf(Slot.Start)
            ? SeriesOccurrenceState.TimeChanged
            : SeriesOccurrenceState.Rescheduled;
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
