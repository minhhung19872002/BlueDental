using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.CustomerCare;

/// <summary>
/// One customer-care task for one patient (Chăm sóc khách hàng).
///
/// Reference: <c>GET /api/v1/customer-care</c> — a record carries the care
/// programme (<c>type</c>), the scheduled window, the treating dentist and the
/// staff member doing the caring, the treatment stages it follows up, and the
/// care-service taxonomy it belongs to.
/// </summary>
public class CareRecord : FullAuditedAggregateRoot<Guid>
{
    private readonly List<Guid> _stageIds = new();

    public Guid PatientId { get; private set; }
    public Guid BranchId { get; private set; }

    /// <summary>Bác sĩ điều trị — who treated the patient.</summary>
    public Guid? AssignedStaffId { get; private set; }

    /// <summary>Nhân viên chăm sóc — who performs the care call.</summary>
    public Guid? CareStaffId { get; private set; }

    public CareType Type { get; private set; }
    public CareStatus Status { get; private set; }
    public CareOutcome Outcome { get; private set; }

    public string Subject { get; private set; } = default!;
    public string? Description { get; private set; }
    public string? Resolution { get; private set; }

    /// <summary>Nhóm CSKH — a taxonomy entry of the care-service catalog.</summary>
    public Guid? CareServiceId { get; private set; }

    /// <summary>Ngày chăm sóc — when the care is due.</summary>
    public DateTimeOffset? DueAt { get; private set; }

    /// <summary>Khung giờ hẹn chăm sóc.</summary>
    public DateTimeOffset? ScheduledStart { get; private set; }
    public DateTimeOffset? ScheduledEnd { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    /// <summary>Đã gửi Zalo — set when the reminder went out over Zalo.</summary>
    public DateTimeOffset? ZaloSentAt { get; private set; }

    /// <summary>Treatment stages this care follows up (reference: <c>stageIds</c>).</summary>
    public IReadOnlyCollection<Guid> StageIds => _stageIds.AsReadOnly();

    protected CareRecord() { }

    public CareRecord(
        Guid id,
        Guid patientId,
        Guid branchId,
        CareType type,
        string subject,
        Guid? assignedStaffId = null,
        string? description = null,
        DateTimeOffset? dueAt = null,
        Guid? careServiceId = null,
        IEnumerable<Guid>? stageIds = null)
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
        CareServiceId = careServiceId;
        Status = CareStatus.New;
        Outcome = CareOutcome.NotRated;

        if (stageIds != null)
        {
            _stageIds.AddRange(stageIds.Distinct());
        }
    }

    /// <summary>Assigns the staff member who will make the call.</summary>
    public CareRecord AssignCareStaff(Guid careStaffId)
    {
        GuardOpen();
        CareStaffId = careStaffId;
        return this;
    }

    public CareRecord Schedule(DateTimeOffset start, DateTimeOffset end)
    {
        GuardOpen();

        if (end <= start)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.CustomerCare.InvalidSchedule,
                "Khung giờ chăm sóc phải kết thúc sau khi bắt đầu.");
        }

        ScheduledStart = start;
        ScheduledEnd = end;
        DueAt ??= start;
        return this;
    }

    /// <summary>Đã liên hệ khách, chưa có kết quả cuối.</summary>
    public CareRecord MarkContacted()
    {
        if (Status != CareStatus.New)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.CustomerCare.InvalidTransition,
                $"Chỉ phiếu chưa chăm sóc mới chuyển sang đã liên hệ (hiện tại: {Status}).");
        }

        Status = CareStatus.Contacted;
        return this;
    }

    /// <summary>Thành công — records the outcome rating shown as "Đánh giá".</summary>
    public CareRecord Succeed(CareOutcome outcome, string? resolution = null)
    {
        GuardOpen();

        if (outcome == CareOutcome.NotRated)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.CustomerCare.OutcomeRequired,
                "Cần chọn đánh giá khi hoàn tất chăm sóc.");
        }

        Status = CareStatus.Succeeded;
        Outcome = outcome;
        Resolution = resolution;
        CompletedAt = DateTimeOffset.UtcNow;
        return this;
    }

    /// <summary>Thất bại — không liên hệ được hoặc khách từ chối.</summary>
    public CareRecord Fail(string reason)
    {
        GuardOpen();
        Check.NotNullOrWhiteSpace(reason, nameof(reason));

        Status = CareStatus.Failed;
        Resolution = reason;
        CompletedAt = DateTimeOffset.UtcNow;
        return this;
    }

    public CareRecord Cancel(string reason)
    {
        if (Status is CareStatus.Succeeded or CareStatus.Failed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.CustomerCare.InvalidTransition,
                $"Phiếu đã kết thúc ở trạng thái {Status} thì không huỷ được.");
        }

        Check.NotNullOrWhiteSpace(reason, nameof(reason));
        Status = CareStatus.Cancelled;
        Resolution = reason;
        return this;
    }

    /// <summary>Ghi nhận đã gửi tin Zalo cho khách.</summary>
    public CareRecord MarkZaloSent()
    {
        ZaloSentAt = DateTimeOffset.UtcNow;
        return this;
    }

    public CareRecord UpdateContent(string subject, string? description)
    {
        GuardOpen();
        Check.NotNullOrWhiteSpace(subject, nameof(subject));

        Subject = subject;
        Description = description;
        return this;
    }

    public CareRecord LinkStages(IEnumerable<Guid> stageIds)
    {
        GuardOpen();

        _stageIds.Clear();
        _stageIds.AddRange(stageIds.Distinct());
        return this;
    }

    /// <summary>True once the task has reached a terminal state.</summary>
    public bool IsClosed =>
        Status is CareStatus.Succeeded or CareStatus.Failed or CareStatus.Cancelled;

    private void GuardOpen()
    {
        if (IsClosed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.CustomerCare.InvalidTransition,
                $"Phiếu chăm sóc ở trạng thái {Status} không thể thay đổi.");
        }
    }
}
