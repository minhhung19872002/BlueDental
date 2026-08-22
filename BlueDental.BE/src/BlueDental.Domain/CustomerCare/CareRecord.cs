using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.CustomerCare;

public class CareRecord : FullAuditedAggregateRoot<Guid>
{
    public Guid PatientId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid? AssignedStaffId { get; private set; }
    public CareType Type { get; private set; }
    public CareStatus Status { get; private set; }
    public string Subject { get; private set; } = default!;
    public string? Description { get; private set; }
    public string? Resolution { get; private set; }
    public DateTimeOffset? DueAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }

    protected CareRecord() { }

    public CareRecord(
        Guid id,
        Guid patientId,
        Guid branchId,
        CareType type,
        string subject,
        Guid? assignedStaffId = null,
        string? description = null,
        DateTimeOffset? dueAt = null)
        : base(id)
    {
        Check.NotNullOrWhiteSpace(subject, nameof(subject));
        PatientId = patientId;
        BranchId = branchId;
        Type = type;
        Subject = subject;
        AssignedStaffId = assignedStaffId;
        Description = description;
        DueAt = dueAt;
        Status = CareStatus.Pending;
    }

    public CareRecord Start()
    {
        if (Status != CareStatus.Pending)
            throw new BusinessException(BlueDentalDomainErrorCodes.CustomerCare.InvalidTransition,
                $"Cannot start care record in status {Status}.");
        Status = CareStatus.InProgress;
        return this;
    }

    public CareRecord Complete(string resolution)
    {
        if (Status is CareStatus.Completed or CareStatus.Cancelled)
            throw new BusinessException(BlueDentalDomainErrorCodes.CustomerCare.InvalidTransition,
                $"Cannot complete care record in status {Status}.");
        Check.NotNullOrWhiteSpace(resolution, nameof(resolution));
        Status = CareStatus.Completed;
        Resolution = resolution;
        CompletedAt = DateTimeOffset.UtcNow;
        return this;
    }

    public CareRecord Cancel()
    {
        if (Status is CareStatus.Completed or CareStatus.Cancelled)
            throw new BusinessException(BlueDentalDomainErrorCodes.CustomerCare.InvalidTransition,
                $"Cannot cancel care record in status {Status}.");
        Status = CareStatus.Cancelled;
        return this;
    }
}
