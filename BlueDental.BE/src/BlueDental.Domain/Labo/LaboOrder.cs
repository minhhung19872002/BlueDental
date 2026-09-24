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
    /// <summary>
    /// Ngày nhận dự kiến and Giờ nhận as one stamp — the reference lists it
    /// with its hour and refuses one that does not follow the sent stamp.
    /// </summary>
    public DateTimeOffset? DueAt { get; private set; }
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
    /// raised through "BE:Perm:CreateLabo" on a treatment row rather than from the Labo
    /// screen. Both nullable: a standalone order names neither.
    /// </summary>
    public Guid? TreatmentServiceId { get; private set; }
    public Guid? TreatmentStageId { get; private set; }

    /// <summary>
    /// The order a "BE:Treatment:ContinueStage" or "BE:Common:Warranty" order was raised from
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
        DateTimeOffset? dueAt = null,
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
        Kind = kind;
        SupplierId = supplierId;
        MaterialId = materialId;
        BiteId = biteId;
        FinishLineId = finishLineId;
        RhythmId = rhythmId;
        Notes = notes;
        SentAt = sentAt;
        SetDueAt(dueAt);
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
    /// "BE:Validation:SelectMaterial". Whether the service line is still open is the
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
        DateTimeOffset? dueAt = null,
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
            dueAt,
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
        string? notes, DateTimeOffset? dueAt, decimal estimatedCost)
    {
        if (Status != LaboStatus.Draft)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.InvalidTransition,
                $"Cannot update order in status {Status}. Only Draft orders can be edited.");
        Check.NotNullOrWhiteSpace(labProviderName, nameof(labProviderName));
        LabProviderName = labProviderName;
        ToothNumbers = toothNumbers;
        WorkDescription = workDescription;
        Notes = notes;
        SetDueAt(dueAt);
        EstimatedCost = estimatedCost;
        return this;
    }

    /// <summary>
    /// The reference's "Ngày và giờ nhận dự kiến phải sau ngày và giờ gửi": a
    /// due stamp at or before the sent stamp is refused.
    /// </summary>
    private void SetDueAt(DateTimeOffset? dueAt)
    {
        if (dueAt.HasValue && SentAt.HasValue && dueAt.Value <= SentAt.Value)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.DueBeforeSent);
        DueAt = dueAt;
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

    /// <summary>The five values the detail dialog's Trạng thái offers.</summary>
    private static readonly LaboStatus[] DetailStatuses =
    [
        LaboStatus.Draft, LaboStatus.Received, LaboStatus.Rejected,
        LaboStatus.LateDelivery, LaboStatus.Replaced,
    ];

    /// <summary>
    /// "Trạng thái" on the detail dialog: the reference lets the status be set
    /// straight to any of its five values, with one rule — an order is only
    /// cancelled while it is still new ("Chỉ được huỷ đơn hàng mới"). Sent,
    /// InProgress and Completed are reached through Send / Receive / Complete
    /// only, so the dialog cannot skip their guards.
    /// </summary>
    public LaboOrder ChangeStatus(LaboStatus next)
    {
        if (Array.IndexOf(DetailStatuses, next) < 0)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.InvalidTransition,
                $"Status {next} is reached through the workflow, not the detail dialog.");
        if (next == Status)
            return this;
        if (next == LaboStatus.Rejected && Status != LaboStatus.Draft)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.CancelOnlyNew);
        Status = next;
        if (next == LaboStatus.Received && ReceivedAt is null)
            ReceivedAt = DateTimeOffset.UtcNow;
        return this;
    }

    /// <summary>
    /// Whether the labo still owes the clinic this order — i.e. the service line
    /// carrying it cannot be cancelled or converted yet. Read off the reference
    /// 2026-09-24: a `draft`/`sent`/`inProgress`/`lateDelivery` order blocks with
    /// "Dịch vụ có đơn labo chưa hoàn tất, không thể huỷ.".
    /// </summary>
    public bool IsUnfinished =>
        Status is not (LaboStatus.Received or LaboStatus.Completed
            or LaboStatus.Rejected or LaboStatus.Replaced);

    /// <summary>
    /// "Hủy phiếu Labo" from the Chuyển đổi dialog: the reference issues
    /// <c>PUT /orders/{id}/update-status {status: canceled, statusClinic: canceled}</c>
    /// for every order of the line, so both dimensions close at once.
    /// </summary>
    public LaboOrder CancelForServiceChange()
    {
        Kind = LaboOrderKind.Canceled;
        Status = LaboStatus.Rejected;
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
