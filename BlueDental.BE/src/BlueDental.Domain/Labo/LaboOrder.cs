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

    /// <summary>The lab the sample went to, once suppliers are a catalog.</summary>
    public Guid? SupplierId { get; private set; }
    public Guid? MaterialId { get; private set; }
    public Guid? BiteId { get; private set; }
    public Guid? FinishLineId { get; private set; }
    public Guid? RhythmId { get; private set; }

    /// <summary>Where the file the clinic sent back is stored.</summary>
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
        DateOnly? dueDate = null,
        LaboOrderKind kind = LaboOrderKind.New,
        Guid? supplierId = null,
        Guid? materialId = null,
        Guid? biteId = null,
        Guid? finishLineId = null,
        Guid? rhythmId = null)
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
        Kind = kind;
        SupplierId = supplierId;
        MaterialId = materialId;
        BiteId = biteId;
        FinishLineId = finishLineId;
        RhythmId = rhythmId;
        Status = LaboStatus.Draft;
    }

    /// <summary>The file the clinic sent back, replacing whatever was there.</summary>
    public LaboOrder SetAttachment(string? attachmentUrl)
    {
        AttachmentUrl = attachmentUrl;
        return this;
    }

    public LaboOrder Update(
        string labProviderName, string? toothNumbers, string? workDescription,
        string? notes, DateOnly? dueDate, decimal estimatedCost)
    {
        if (Status != LaboStatus.Draft)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.InvalidTransition,
                $"Cannot update order in status {Status}. Only Draft orders can be edited.");
        Check.NotNullOrWhiteSpace(labProviderName, nameof(labProviderName));
        LabProviderName = labProviderName;
        ToothNumbers = toothNumbers;
        WorkDescription = workDescription;
        Notes = notes;
        DueDate = dueDate;
        EstimatedCost = estimatedCost;
        return this;
    }

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
