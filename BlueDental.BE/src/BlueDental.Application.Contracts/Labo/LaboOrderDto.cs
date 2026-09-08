using System;
using System.Collections.Generic;
using BlueDental.TreatmentManagement;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Content;

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

    /// <summary>The order this one continues or guarantees; null on Đặt mới.</summary>
    public Guid? ParentOrderId { get; set; }

    public string? SupplierName { get; set; }
    public string? MaterialName { get; set; }

    /// <summary>The labo service (Dịch vụ - vật liệu group) the material belongs to: "Dịch vụ hiện tại" on the child form.</summary>
    public string? LaboServiceName { get; set; }
    public string? DentistName { get; set; }
    public string? BiteName { get; set; }
    public string? FinishLineName { get; set; }
    public string? RhythmName { get; set; }

    /// <summary>
    /// The service line the order was raised from, named the way the child
    /// form shows it: "DT01 - Bác sĩ" for Kế hoạch điều trị and the catalog
    /// service for Dịch vụ điều trị. Null when the order names no line.
    /// </summary>
    public Guid? TreatmentPlanId { get; set; }
    public string? TreatmentPlanCode { get; set; }
    public string? TreatmentPlanDentistName { get; set; }
    public string? TreatmentServiceName { get; set; }
    public TreatmentServiceStatus? TreatmentServiceStatus { get; set; }

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

    /// <summary>
    /// Required when Kind is ContinueStage or Guarantee: the order being
    /// continued / guaranteed. Code, service line and công đoạn are copied
    /// from it and the values sent for those are ignored.
    /// </summary>
    public Guid? ParentOrderId { get; set; }

    /// <summary>
    /// Tải ảnh: the pictures picked in the dialog. They are filed into the
    /// patient's Hình ảnh under the plan and công đoạn the order was raised
    /// from, in the same unit of work as the order — one multipart request,
    /// all or nothing.
    /// </summary>
    public List<IRemoteStreamContent>? Pictures { get; set; }
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
