using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Aggregate root representing a patient's treatment plan.
/// Lifecycle: Draft → PendingApproval → Approved → InProgress → Completed / Cancelled.
/// </summary>
public class TreatmentPlan : FullAuditedAggregateRoot<Guid>
{
    public Guid PatientId { get; private set; }
    public Guid DentistId { get; private set; }
    public Guid BranchId { get; private set; }
    public string Title { get; private set; } = default!;
    public string? Description { get; private set; }
    public TreatmentPlanStatus Status { get; private set; }
    public DateOnly? EstimatedCompletionDate { get; private set; }
    public string? ApprovalNotes { get; private set; }
    public Guid? ApprovedBy { get; private set; }
    public DateTimeOffset? ApprovedAt { get; private set; }

    protected TreatmentPlan() { }

    public TreatmentPlan(
        Guid id,
        Guid patientId,
        Guid dentistId,
        Guid branchId,
        string title,
        string? description = null,
        DateOnly? estimatedCompletionDate = null)
        : base(id)
    {
        PatientId = patientId;
        DentistId = dentistId;
        BranchId = branchId;
        Title = title;
        Description = description;
        EstimatedCompletionDate = estimatedCompletionDate;
        Status = TreatmentPlanStatus.Draft;
    }

    public TreatmentPlan Update(string title, string? description, DateOnly? estimatedCompletionDate)
    {
        EnsureStatus(TreatmentPlanStatus.Draft, nameof(Update));
        Check.NotNullOrWhiteSpace(title, nameof(title));
        Title = title;
        Description = description;
        EstimatedCompletionDate = estimatedCompletionDate;
        return this;
    }

    public TreatmentPlan SubmitForApproval()
    {
        EnsureStatus(TreatmentPlanStatus.Draft, nameof(SubmitForApproval));
        Status = TreatmentPlanStatus.PendingApproval;
        return this;
    }

    public TreatmentPlan Approve(Guid approvedBy, string? notes = null)
    {
        EnsureStatus(TreatmentPlanStatus.PendingApproval, nameof(Approve));
        Status = TreatmentPlanStatus.Approved;
        ApprovedBy = approvedBy;
        ApprovedAt = DateTimeOffset.UtcNow;
        ApprovalNotes = notes;
        return this;
    }

    public TreatmentPlan Start()
    {
        EnsureStatus(TreatmentPlanStatus.Approved, nameof(Start));
        Status = TreatmentPlanStatus.InProgress;
        return this;
    }

    public TreatmentPlan Complete()
    {
        EnsureStatus(TreatmentPlanStatus.InProgress, nameof(Complete));
        Status = TreatmentPlanStatus.Completed;
        return this;
    }

    public TreatmentPlan Cancel()
    {
        if (Status is TreatmentPlanStatus.Completed or TreatmentPlanStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                $"Cannot cancel a treatment plan in status {Status}.");
        }

        Status = TreatmentPlanStatus.Cancelled;
        return this;
    }

    private void EnsureStatus(TreatmentPlanStatus expected, string operation)
    {
        if (Status != expected)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                $"Cannot perform '{operation}' on plan with status '{Status}'. Expected '{expected}'.");
        }
    }
}
