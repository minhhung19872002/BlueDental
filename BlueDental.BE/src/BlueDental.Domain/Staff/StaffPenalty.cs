using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Staff;

/// <summary>
/// Chế tài nhân viên — one disciplinary record against one staff member.
///
/// BlueDental-local (the reference has no such screen); the rules are the ones
/// agreed for docs/clone/pages/staff-penalty.md:
/// <list type="bullet">
/// <item>Nháp → Đã duyệt / Đã huỷ. A draft is edited and deleted freely.</item>
/// <item>An approved record is locked: no edit, no delete. It can still be
/// cancelled, with a reason, so a mistake is withdrawn without losing the trail.</item>
/// <item>Only <see cref="StaffPenaltyAction.Fine"/> carries an amount; every
/// other action is saved with zero, whatever was sent.</item>
/// </list>
/// </summary>
public class StaffPenalty : FullAuditedAggregateRoot<Guid>
{
    public const int MaxDescriptionLength = 2000;
    public const int MaxCancelReasonLength = 500;

    public Guid ClinicBranchId { get; private set; }

    /// <summary>The penalised staff member (their identity user id).</summary>
    public Guid StaffId { get; private set; }

    public Guid? ViolationTypeId { get; private set; }

    public DateOnly ViolationDate { get; private set; }

    public StaffPenaltyAction Action { get; private set; }

    /// <summary>Số tiền phạt, VNĐ. Non-zero only for <see cref="StaffPenaltyAction.Fine"/>.</summary>
    public decimal FineAmount { get; private set; }

    public string? Description { get; private set; }

    public StaffPenaltyStatus Status { get; private set; }

    public Guid? ApproverId { get; private set; }
    public DateTime? ApprovedAt { get; private set; }

    public DateTime? CancelledAt { get; private set; }
    public string? CancelReason { get; private set; }

    protected StaffPenalty() { }

    public static StaffPenalty Create(
        Guid id,
        Guid clinicBranchId,
        Guid staffId,
        Guid? violationTypeId,
        DateOnly violationDate,
        StaffPenaltyAction action,
        decimal fineAmount,
        string? description,
        DateOnly today)
    {
        var penalty = new StaffPenalty
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Status = StaffPenaltyStatus.Draft,
        };
        penalty.Apply(staffId, violationTypeId, violationDate, action, fineAmount, description, today);
        return penalty;
    }

    public StaffPenalty Update(
        Guid staffId,
        Guid? violationTypeId,
        DateOnly violationDate,
        StaffPenaltyAction action,
        decimal fineAmount,
        string? description,
        DateOnly today)
    {
        EnsureDraft();
        Apply(staffId, violationTypeId, violationDate, action, fineAmount, description, today);
        return this;
    }

    public StaffPenalty Approve(Guid approverId, DateTime now)
    {
        EnsureDraft();
        Status = StaffPenaltyStatus.Approved;
        ApproverId = approverId;
        ApprovedAt = now;
        return this;
    }

    public StaffPenalty Cancel(string reason, DateTime now)
    {
        if (Status == StaffPenaltyStatus.Cancelled)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.StaffPenalty.AlreadyCancelled);
        }

        Check.NotNullOrWhiteSpace(reason, nameof(reason), MaxCancelReasonLength);
        Status = StaffPenaltyStatus.Cancelled;
        CancelReason = reason.Trim();
        CancelledAt = now;
        return this;
    }

    /// <summary>Called before a delete: only a draft may disappear.</summary>
    public void EnsureDeletable() => EnsureDraft();

    private void EnsureDraft()
    {
        if (Status != StaffPenaltyStatus.Draft)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.StaffPenalty.NotDraft);
        }
    }

    private void Apply(
        Guid staffId,
        Guid? violationTypeId,
        DateOnly violationDate,
        StaffPenaltyAction action,
        decimal fineAmount,
        string? description,
        DateOnly today)
    {
        Check.NotDefaultOrNull<Guid>(staffId, nameof(staffId));
        if (!Enum.IsDefined(action))
        {
            throw new ArgumentOutOfRangeException(nameof(action));
        }

        if (violationDate > today)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.StaffPenalty.ViolationDateInFuture);
        }

        if (action == StaffPenaltyAction.Fine && fineAmount <= 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.StaffPenalty.FineAmountRequired);
        }

        if (fineAmount < 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.StaffPenalty.InvalidAmount);
        }

        StaffId = staffId;
        ViolationTypeId = violationTypeId;
        ViolationDate = violationDate;
        Action = action;
        FineAmount = action == StaffPenaltyAction.Fine ? fineAmount : 0m;
        Description = string.IsNullOrWhiteSpace(description)
            ? null
            : Check.Length(description.Trim(), nameof(description), MaxDescriptionLength);
    }
}
