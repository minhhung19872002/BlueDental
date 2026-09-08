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

    /// <summary>Màu răng — free text on the reference's Đặt mới form.</summary>
    public string? ToothShade { get; private set; }

    /// <summary>Số lượng. Always at least one unit of work.</summary>
    public int Quantity { get; private set; } = 1;

    /// <summary>
    /// The service line and the công đoạn the order was raised from, when it was
    /// raised through "Tạo Labo" on a treatment row rather than from the Labo
    /// screen. Both nullable: a standalone order names neither.
    /// </summary>
    public Guid? TreatmentServiceId { get; private set; }
    public Guid? TreatmentStageId { get; private set; }

    /// <summary>
    /// The order a "Làm tiếp công đoạn" or "Bảo hành" order was raised from
    /// (the reference's <c>sourceLabOrderId</c>). Null on an order raised with
    /// Đặt mới. A child shares its parent's code, patient, branch and service
    /// line, so the code is only unique among the orders without a parent.
    /// </summary>
    public Guid? ParentOrderId { get; private set; }

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
        Guid? rhythmId = null,
        string? notes = null,
        DateTimeOffset? sentAt = null,
        string? toothShade = null,
        int quantity = 1,
        Guid? treatmentServiceId = null,
        Guid? treatmentStageId = null)
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
        Notes = notes;
        SentAt = sentAt;
        ToothShade = toothShade;
        Quantity = quantity < 1 ? 1 : quantity;
        TreatmentServiceId = treatmentServiceId;
        TreatmentStageId = treatmentStageId;
        Status = LaboStatus.Draft;
    }

    /// <summary>
    /// Làm tiếp công đoạn / Bảo hành: a new order under <paramref name="parent"/>.
    ///
    /// The code, patient, branch, service line and công đoạn are the parent's —
    /// the reference disables those fields and posts the parent's values. The
    /// caller may swap the material (Thay đổi vật liệu mới); a child with no
    /// material at all is refused, the way the reference answers
    /// "Vui lòng chọn vật liệu.". Whether the service line is still open is the
    /// application layer's check, since the line lives on another aggregate.
    /// </summary>
    public static LaboOrder CreateChild(
        Guid id,
        LaboOrder parent,
        LaboOrderKind kind,
        Guid patientId,
        Guid branchId,
        string labProviderName,
        Guid? materialId,
        Guid? dentistId = null,
        string? toothNumbers = null,
        DateOnly? dueDate = null,
        Guid? supplierId = null,
        Guid? biteId = null,
        Guid? finishLineId = null,
        Guid? rhythmId = null,
        string? notes = null,
        DateTimeOffset? sentAt = null,
        string? toothShade = null,
        int quantity = 1,
        decimal estimatedCost = 0m)
    {
        Check.NotNull(parent, nameof(parent));
        if (kind == LaboOrderKind.New)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ParentRequired,
                "An order raised with Đặt mới has no parent.");
        if (parent.PatientId != patientId || parent.BranchId != branchId)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ParentMismatch);

        var material = materialId ?? parent.MaterialId;
        if (!material.HasValue)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.MaterialRequired);

        return new LaboOrder(
            id,
            parent.OrderCode,
            parent.PatientId,
            parent.BranchId,
            labProviderName,
            estimatedCost,
            dentistId ?? parent.DentistId,
            toothNumbers,
            parent.WorkDescription,
            dueDate,
            kind,
            supplierId ?? parent.SupplierId,
            material,
            biteId,
            finishLineId,
            rhythmId,
            notes,
            sentAt,
            toothShade,
            quantity,
            parent.TreatmentServiceId,
            parent.TreatmentStageId)
        {
            ParentOrderId = parent.Id
        };
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
