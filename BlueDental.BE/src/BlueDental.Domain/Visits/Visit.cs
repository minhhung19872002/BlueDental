using System;
using BlueDental;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Visits;

public class Visit : FullAuditedAggregateRoot<Guid>
{
    public Guid PatientId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid? DentistId { get; private set; }
    public VisitStatus Status { get; private set; }
    public string? ChiefComplaint { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset ScheduledAt { get; private set; }
    public DateTimeOffset? CheckedInAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public string? CancellationReason { get; private set; }

    /// <summary>What reception recorded at the end of the visit, once known.</summary>
    public VisitOutcome? Outcome { get; private set; }

    public DateTimeOffset? OutcomeRecordedAt { get; private set; }

    protected Visit() { }

    public Visit(
        Guid id,
        Guid patientId,
        Guid branchId,
        DateTimeOffset scheduledAt,
        Guid? dentistId = null,
        string? chiefComplaint = null)
        : base(id)
    {
        PatientId = patientId;
        BranchId = branchId;
        DentistId = dentistId;
        ScheduledAt = scheduledAt;
        ChiefComplaint = chiefComplaint;
        Status = VisitStatus.Scheduled;
    }

    public Visit Update(Guid? dentistId, DateTimeOffset? scheduledAt, string? chiefComplaint, string? notes)
    {
        if (Status != VisitStatus.Scheduled)
            throw new BusinessException(BlueDentalDomainErrorCodes.Visits.InvalidTransition,
                $"Cannot update a visit in status {Status}. Only Scheduled visits can be edited.");
        if (dentistId.HasValue) DentistId = dentistId;
        if (scheduledAt.HasValue) ScheduledAt = scheduledAt.Value;
        ChiefComplaint = chiefComplaint;
        Notes = notes;
        return this;
    }

    public Visit CheckIn()
    {
        if (Status != VisitStatus.Scheduled)
            throw new BusinessException(BlueDentalDomainErrorCodes.Visits.InvalidTransition,
                $"Cannot check in a visit in status {Status}.");
        Status = VisitStatus.CheckedIn;
        CheckedInAt = DateTimeOffset.UtcNow;
        return this;
    }

    public Visit Start()
    {
        if (Status != VisitStatus.CheckedIn)
            throw new BusinessException(BlueDentalDomainErrorCodes.Visits.InvalidTransition,
                $"Cannot start a visit in status {Status}.");
        Status = VisitStatus.InProgress;
        return this;
    }

    public Visit Complete(string? notes = null)
    {
        if (Status != VisitStatus.InProgress)
            throw new BusinessException(BlueDentalDomainErrorCodes.Visits.InvalidTransition,
                $"Cannot complete a visit in status {Status}.");
        Status = VisitStatus.Completed;
        CompletedAt = DateTimeOffset.UtcNow;
        Notes = notes;
        return this;
    }

    public Visit Cancel(string reason)
    {
        if (Status is VisitStatus.Completed or VisitStatus.Cancelled)
            throw new BusinessException(BlueDentalDomainErrorCodes.Visits.InvalidTransition,
                $"Cannot cancel a visit in status {Status}.");
        Check.NotNullOrWhiteSpace(reason, nameof(reason));
        Status = VisitStatus.Cancelled;
        CancellationReason = reason;
        return this;
    }

    /// <summary>
    /// Record how the visit ended.
    ///
    /// Deliberately not part of Update: that is for correcting a booking and is
    /// refused once a visit leaves Scheduled, whereas an outcome is only known
    /// after the patient has arrived. A cancelled or no-show visit has no
    /// outcome to record.
    /// </summary>
    public Visit RecordOutcome(VisitOutcome outcome)
    {
        if (Status is VisitStatus.Scheduled)
            throw new BusinessException(BlueDentalDomainErrorCodes.Visits.InvalidTransition,
                "Cannot record an outcome before the patient has checked in.");

        if (Status is VisitStatus.Cancelled or VisitStatus.NoShow)
            throw new BusinessException(BlueDentalDomainErrorCodes.Visits.InvalidTransition,
                $"Cannot record an outcome for a visit in status {Status}.");

        Outcome = outcome;
        OutcomeRecordedAt = DateTimeOffset.UtcNow;
        return this;
    }

    public Visit MarkNoShow()
    {
        if (Status is not (VisitStatus.Scheduled or VisitStatus.CheckedIn))
            throw new BusinessException(BlueDentalDomainErrorCodes.Visits.InvalidTransition,
                $"Cannot mark no-show a visit in status {Status}.");
        Status = VisitStatus.NoShow;
        return this;
    }
}
