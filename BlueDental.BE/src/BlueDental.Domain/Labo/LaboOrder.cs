using System;
using BlueDental;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Labo;

public class LaboOrder : FullAuditedAggregateRoot<Guid>
{
    public string OrderCode { get; private set; } = default!;
    public Guid PatientId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid? DentistId { get; private set; }
    public string LabProviderName { get; private set; } = default!;
    public LaboStatus Status { get; private set; }
    public string? ToothNumbers { get; private set; }
    public string? WorkDescription { get; private set; }
    public string? Notes { get; private set; }
    public DateOnly? DueDate { get; private set; }
    public DateTimeOffset? SentAt { get; private set; }
    public DateTimeOffset? ReceivedAt { get; private set; }
    public decimal EstimatedCost { get; private set; }
    public string? RejectionReason { get; private set; }

    /// <summary>Đơn hàng mới / Tiếp tục công đoạn / Bảo hành.</summary>
    public LaboOrderKind Kind { get; private set; }

    /// <summary>Nhà cung cấp — a <c>labo_supplier</c> catalog entry, when picked from the catalog.</summary>
    public Guid? SupplierId { get; private set; }

    /// <summary>Vật liệu — a <c>labo_material</c> catalog entry.</summary>
    public Guid? MaterialId { get; private set; }

    /// <summary>Khớp cắn.</summary>
    public Guid? BiteId { get; private set; }

    /// <summary>Đường hoàn tất.</summary>
    public Guid? FinishLineId { get; private set; }

    /// <summary>Kiểu nhịp.</summary>
    public Guid? RhythmId { get; private set; }

    /// <summary>File phòng khám gửi về — attachments returned with the sample.</summary>
    public string? AttachmentUrl { get; private set; }

    protected LaboOrder() { }

    public LaboOrder(
        Guid id,
        string orderCode,
        Guid patientId,
        Guid branchId,
        string labProviderName,
        decimal estimatedCost,
        Guid? dentistId = null,
        string? toothNumbers = null,
        string? workDescription = null,
        DateOnly? dueDate = null)
        : base(id)
    {
        Check.NotNullOrWhiteSpace(orderCode, nameof(orderCode));
        Check.NotNullOrWhiteSpace(labProviderName, nameof(labProviderName));
        OrderCode = orderCode;
        PatientId = patientId;
        BranchId = branchId;
        LabProviderName = labProviderName;
        EstimatedCost = estimatedCost;
        DentistId = dentistId;
        ToothNumbers = toothNumbers;
        WorkDescription = workDescription;
        DueDate = dueDate;
        Status = LaboStatus.Draft;
        Kind = LaboOrderKind.New;
    }

    public LaboOrder SetKind(LaboOrderKind kind)
    {
        Kind = kind;
        return this;
    }

    /// <summary>Links the catalog choices shown as columns on the Mẫu Labo table.</summary>
    public LaboOrder SetCatalogSelections(
        Guid? supplierId,
        Guid? materialId,
        Guid? biteId,
        Guid? finishLineId,
        Guid? rhythmId)
    {
        SupplierId = supplierId;
        MaterialId = materialId;
        BiteId = biteId;
        FinishLineId = finishLineId;
        RhythmId = rhythmId;
        return this;
    }

    public LaboOrder AttachFile(string? attachmentUrl)
    {
        AttachmentUrl = attachmentUrl;
        return this;
    }

    /// <summary>
    /// "Mẫu Giao Trễ" — sent, past its due date and still not back. A received
    /// sample is never late, however long it took to arrive.
    /// </summary>
    public bool IsOverdueAsOf(DateOnly today) =>
        DueDate.HasValue
        && ReceivedAt is null
        && Status is LaboStatus.Sent or LaboStatus.InProgress
        && DueDate.Value < today;

    /// <summary>"Mẫu Chưa Nhận" — sent to the lab and not back yet.</summary>
    public bool IsAwaitingReturn =>
        ReceivedAt is null && Status is LaboStatus.Sent or LaboStatus.InProgress;

    /// <summary>"Mẫu Đã Nhận Hàng".</summary>
    public bool IsReturned => ReceivedAt is not null;

    public LaboOrder Send()
    {
        if (Status != LaboStatus.Draft)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.InvalidTransition,
                $"Cannot send order in status {Status}.");
        Status = LaboStatus.Sent;
        SentAt = DateTimeOffset.UtcNow;
        return this;
    }

    public LaboOrder Receive()
    {
        if (Status is not (LaboStatus.Sent or LaboStatus.InProgress))
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.InvalidTransition,
                $"Cannot receive order in status {Status}.");
        Status = LaboStatus.Received;
        ReceivedAt = DateTimeOffset.UtcNow;
        return this;
    }

    public LaboOrder Complete()
    {
        if (Status != LaboStatus.Received)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.InvalidTransition,
                $"Cannot complete order in status {Status}.");
        Status = LaboStatus.Completed;
        return this;
    }

    public LaboOrder Reject(string reason)
    {
        if (Status is LaboStatus.Completed or LaboStatus.Rejected)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.InvalidTransition,
                $"Cannot reject order in status {Status}.");
        Check.NotNullOrWhiteSpace(reason, nameof(reason));
        Status = LaboStatus.Rejected;
        RejectionReason = reason;
        return this;
    }
}
