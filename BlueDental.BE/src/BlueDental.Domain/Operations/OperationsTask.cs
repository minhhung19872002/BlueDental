using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Operations;

/// <summary>
/// An item on a department's "Công việc" section (Quản trị vận hành).
///
/// Like <see cref="OperationsArticle"/>, the reference's payload was never
/// observed; the shape here is BlueDental's minimum for an assignable task with
/// a due date.
/// </summary>
public class OperationsTask : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }
    public OperationsDepartment Department { get; private set; }

    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    public Guid? AssigneeStaffId { get; private set; }
    public DateOnly? DueDate { get; private set; }

    public OperationsTaskStatus Status { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public string? CancellationReason { get; private set; }

    protected OperationsTask() { }

    public static OperationsTask Create(
        Guid id,
        Guid clinicBranchId,
        OperationsDepartment department,
        string title,
        string? description = null,
        Guid? assigneeStaffId = null,
        DateOnly? dueDate = null)
    {
        Check.NotNullOrWhiteSpace(title, nameof(title));

        return new OperationsTask
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Department = department,
            Title = title,
            Description = description,
            AssigneeStaffId = assigneeStaffId,
            DueDate = dueDate,
            Status = OperationsTaskStatus.Todo
        };
    }

    public OperationsTask UpdateDetails(
        string title,
        string? description,
        Guid? assigneeStaffId,
        DateOnly? dueDate)
    {
        GuardOpen();
        Check.NotNullOrWhiteSpace(title, nameof(title));

        Title = title;
        Description = description;
        AssigneeStaffId = assigneeStaffId;
        DueDate = dueDate;
        return this;
    }

    public OperationsTask Start()
    {
        if (Status != OperationsTaskStatus.Todo)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Operations.InvalidTaskTransition,
                $"Chỉ công việc chưa bắt đầu mới chuyển sang đang làm (hiện tại: {Status}).");
        }

        Status = OperationsTaskStatus.InProgress;
        return this;
    }

    public OperationsTask Complete()
    {
        GuardOpen();

        Status = OperationsTaskStatus.Done;
        CompletedAt = DateTimeOffset.UtcNow;
        return this;
    }

    public OperationsTask Cancel(string reason)
    {
        GuardOpen();
        Check.NotNullOrWhiteSpace(reason, nameof(reason));

        Status = OperationsTaskStatus.Cancelled;
        CancellationReason = reason;
        return this;
    }

    /// <summary>Quá hạn — still open past its due date.</summary>
    public bool IsOverdueAsOf(DateOnly today) =>
        DueDate.HasValue
        && DueDate.Value < today
        && Status is OperationsTaskStatus.Todo or OperationsTaskStatus.InProgress;

    private void GuardOpen()
    {
        if (Status is OperationsTaskStatus.Done or OperationsTaskStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Operations.InvalidTaskTransition,
                $"Công việc đã ở trạng thái {Status} thì không thay đổi được nữa.");
        }
    }
}
