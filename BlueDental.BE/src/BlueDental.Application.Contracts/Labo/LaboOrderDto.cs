using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Labo;

public class LaboOrderDto : FullAuditedEntityDto<Guid>
{
    public string OrderCode { get; set; } = default!;
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? DentistId { get; set; }
    public string LabProviderName { get; set; } = default!;
    public LaboStatus Status { get; set; }
    public string? ToothNumbers { get; set; }
    public string? WorkDescription { get; set; }
    public string? Notes { get; set; }
    public DateOnly? DueDate { get; set; }
    public DateTimeOffset? SentAt { get; set; }
    public DateTimeOffset? ReceivedAt { get; set; }
    public decimal EstimatedCost { get; set; }
    public string? RejectionReason { get; set; }
    public string? PatientName { get; set; }

    public LaboOrderKind Kind { get; set; }
    public Guid? SupplierId { get; set; }
    public Guid? MaterialId { get; set; }
    public Guid? BiteId { get; set; }
    public Guid? FinishLineId { get; set; }
    public Guid? RhythmId { get; set; }
    public string? AttachmentUrl { get; set; }
    public string? ToothShade { get; set; }
    public int Quantity { get; set; }
    public Guid? TreatmentServiceId { get; set; }
    public Guid? TreatmentStageId { get; set; }

    public string? SupplierName { get; set; }
    public string? MaterialName { get; set; }
    public string? DentistName { get; set; }

    /// <summary>Mẫu Giao Trễ — derived, see LaboOrder.IsOverdueAsOf.</summary>
    public bool IsOverdue { get; set; }

    /// <summary>Mẫu Chưa Nhận.</summary>
    public bool IsAwaitingReturn { get; set; }
}

/// <summary>The filter chips above the Mẫu Labo table.</summary>
public enum LaboSampleFilter
{
    All = 0,
    AwaitingReturn = 1,
    Overdue = 2,
    Returned = 3
}

/// <summary>Counters on the patient's Labo tab.</summary>
public class LaboStatsDto
{
    public int Total { get; set; }
    public int New { get; set; }
    public int ContinueStage { get; set; }
    public int Guarantee { get; set; }
    public int AwaitingReturn { get; set; }
    public int Overdue { get; set; }
    public int Returned { get; set; }
}

public class CreateLaboOrderDto
{
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? DentistId { get; set; }
    public string LabProviderName { get; set; } = default!;
    public string? ToothNumbers { get; set; }
    public string? WorkDescription { get; set; }
    public DateOnly? DueDate { get; set; }
    public decimal EstimatedCost { get; set; }
    public LaboOrderKind Kind { get; set; } = LaboOrderKind.New;
    public Guid? SupplierId { get; set; }
    public Guid? MaterialId { get; set; }
    public Guid? BiteId { get; set; }
    public Guid? FinishLineId { get; set; }
    public Guid? RhythmId { get; set; }

    /// <summary>Số phiếu Labo. Omit and the server allocates the next one.</summary>
    public string? OrderCode { get; set; }
    /// <summary>Nội dung.</summary>
    public string? Notes { get; set; }
    /// <summary>Ngày gửi + Giờ gửi, which the reference prefills with "now".</summary>
    public DateTimeOffset? SentAt { get; set; }
    /// <summary>Màu răng.</summary>
    public string? ToothShade { get; set; }
    /// <summary>Số lượng.</summary>
    public int Quantity { get; set; } = 1;
    /// <summary>Set when the order was raised from a treatment row's "Tạo Labo".</summary>
    public Guid? TreatmentServiceId { get; set; }
    public Guid? TreatmentStageId { get; set; }
}

public class UpdateLaboOrderDto
{
    public string LabProviderName { get; set; } = default!;
    public string? ToothNumbers { get; set; }
    public string? WorkDescription { get; set; }
    public string? Notes { get; set; }
    public DateOnly? DueDate { get; set; }
    public decimal EstimatedCost { get; set; }
}

public class GetLaboOrderListInput : PagedAndSortedResultRequestDto
{
    public LaboSampleFilter? SampleFilter { get; set; }
    public LaboOrderKind? Kind { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? PatientId { get; set; }

    /// <summary>"Chọn bác sĩ" — the dentist the sample was ordered by.</summary>
    public Guid? DentistId { get; set; }

    public LaboStatus? Status { get; set; }
    public string? Filter { get; set; }

    /// <summary>
    /// The window "Ngày / Tuần / Tháng" resolves to, read against the day the
    /// order was raised. Both ends are inclusive of the days they name.
    /// </summary>
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }
}
