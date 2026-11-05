using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using BlueDental.PatientManagement;
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
    public DateTimeOffset? DueAt { get; set; }
    public DateTimeOffset? SentAt { get; set; }
    public DateTimeOffset? ReceivedAt { get; set; }
    public decimal EstimatedCost { get; set; }
    public string? RejectionReason { get; set; }
    public string? PatientName { get; set; }
    public string? PatientCode { get; set; }
    public DateOnly? PatientDateOfBirth { get; set; }

    public LaboOrderKind Kind { get; set; }
    public Guid? SupplierId { get; set; }
    public Guid? MaterialId { get; set; }
    public Guid? BiteId { get; set; }
    public Guid? FinishLineId { get; set; }
    public Guid? RhythmId { get; set; }
    public string? AttachmentUrl { get; set; }
    public string? ToothShade { get; set; }

    /// <summary>Thông số răng / Màu răng Chung or Riêng (R-1150).</summary>
    public LaboSpecMode SpecMode { get; set; }
    public int Quantity { get; set; }
    public Guid? TreatmentServiceId { get; set; }
    public Guid? TreatmentStageId { get; set; }

    /// <summary>The order an old child order continued or guaranteed; null on every order since P2910_03.</summary>
    public Guid? ParentOrderId { get; set; }

    public string? SupplierName { get; set; }

    /// <summary>The supplier's badge colour, "#RRGGBB"; null reads grey (R-1072).</summary>
    public string? SupplierLabelColor { get; set; }
    public string? MaterialName { get; set; }

    /// <summary>The labo service (Dịch vụ - vật liệu group) the material belongs to: "BE:LaboField:CurrentService" on the child form.</summary>
    public string? LaboServiceName { get; set; }
    /// <summary>That group's id, so a reopened Nháp lands on its Lựa chọn dịch vụ chip.</summary>
    public Guid? LaboServiceId { get; set; }
    public string? DentistName { get; set; }
    /// <summary>Chức danh of the doctor above — printed sheets name a doctor by it, else by the name.</summary>
    public string? DentistJobTitle { get; set; }
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

    /// <summary>Mẫu Giao Trễ — still at the lab (Sent / Returned) past the day it was due.</summary>
    public bool IsOverdue { get; set; }

    /// <summary>Mẫu Chưa Nhận — still at the lab (Sent / Returned).</summary>
    public bool IsAwaitingReturn { get; set; }

    /// <summary>
    /// Bảo hành whose every activated card has run out — "Hết hạn bảo hành",
    /// read against today's clinic date, never stored (P2910_03).
    /// </summary>
    public bool IsWarrantyExpired { get; set; }

    /// <summary>Số lần trả hàng.</summary>
    public int ReturnCount { get; set; }

    /// <summary>The order's teeth with their check result and warranty card.</summary>
    public List<LaboOrderToothDto> Teeth { get; set; } = [];

    /// <summary>Lịch sử nhận hàng &amp; trả hàng, oldest first.</summary>
    public List<LaboOrderRoundDto> Rounds { get; set; } = [];

    /// <summary>
    /// The pictures of the order: those sent to the lab (RoundNo null) and
    /// each round's Ảnh kiểm tra.
    /// </summary>
    public List<LaboOrderImageDto> Images { get; set; } = [];
}

public class LaboOrderImageDto
{
    public Guid Id { get; set; }
    public string Url { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;

    /// <summary>The check round this is an Ảnh kiểm tra of; null for Hình ảnh gửi Labo.</summary>
    public int? RoundNo { get; set; }

    /// <summary>The tooth row it belongs to (P3110): FDI, 0 = every tooth, null = Ảnh đính kèm chung.</summary>
    public int? ToothNumber { get; set; }

    /// <summary>Set on a photo of <see cref="ToothNumber"/>'s warranty card (P3110 REQ-E1), which is not a picture of the work.</summary>
    public WarrantyCardSide? WarrantyCardSide { get; set; }
}

public class LaboOrderToothDto
{
    public int ToothNumber { get; set; }

    /// <summary>Thông số từng răng (P3110).</summary>
    public string? Shade { get; set; }
    public Guid? FinishLineId { get; set; }
    public string? FinishLineName { get; set; }
    public Guid? RhythmId { get; set; }
    public string? RhythmName { get; set; }
    public Guid? BiteId { get; set; }
    public string? BiteName { get; set; }
    public string? LabNote { get; set; }

    /// <summary>Mặt răng (R-1150) and, when <see cref="ShadeBySurface"/>, each one's Màu / Đường hoàn tất.</summary>
    public bool ShadeBySurface { get; set; }
    public List<LaboOrderToothSurfaceDto> Surfaces { get; set; } = [];
    public LaboToothCheckResult CheckResult { get; set; }
    public string? DefectNote { get; set; }
    public DateTimeOffset? PassedAt { get; set; }

    /// <summary>"Đã trả: n lần" (P3110 REQ-D5): the returns in which this tooth was Lỗi.</summary>
    public int ReturnCount { get; set; }
    public string? WarrantyCardCode { get; set; }
    public string? ManufacturerSerial { get; set; }
    public DateOnly? WarrantyStartDate { get; set; }
    public int? WarrantyMonths { get; set; }
    public DateOnly? WarrantyEndDate { get; set; }
    public string? WarrantyConditions { get; set; }
    public DateTimeOffset? WarrantyActivatedAt { get; set; }

    /// <summary>The card ran out before today's clinic date.</summary>
    public bool IsWarrantyExpired { get; set; }
}

public class LaboOrderRoundDto
{
    public int RoundNo { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
    public int ReceivedQuantity { get; set; }
    public Guid? ReceiverId { get; set; }
    public string? ReceiverName { get; set; }
    public DateTimeOffset? CheckedAt { get; set; }
    public LaboRoundOutcome Outcome { get; set; }
    public string? ReturnDescription { get; set; }
    public DateTimeOffset? ReturnedAt { get; set; }
    public DateTimeOffset? RedeliveryDueAt { get; set; }
    public List<LaboRoundToothResultDto> ToothResults { get; set; } = [];
}

public class LaboRoundToothResultDto
{
    public int ToothNumber { get; set; }
    public LaboToothCheckResult Result { get; set; }

    /// <summary>Mô tả gửi Labo of this tooth (P3110 REQ-D6); only on a Lỗi tooth.</summary>
    public string? Note { get; set; }

    /// <summary>Mặt bị lỗi codes (Labo v2, R-1151); empty on a Đạt tooth and on rounds checked before.</summary>
    public List<string> FaultSurfaces { get; set; } = [];
}

/// <summary>The filter chips above the Mẫu Labo table.</summary>
public enum LaboSampleFilter
{
    All = 0,
    AwaitingReturn = 1,
    Overdue = 2,
    Returned = 3
}

/// <summary>The six filter cards on the patient's Labo tab (P2910_03).</summary>
public enum LaboStatusFilter
{
    Draft = 1,
    Returned = 2,
    AwaitingCheck = 3,
    Completed = 4,
    InWarranty = 5,
    WarrantyExpired = 6
}

/// <summary>Counters behind the Labo tab's filter cards and the Mẫu Labo chips.</summary>
public class LaboStatsDto
{
    public int Total { get; set; }
    public int Draft { get; set; }
    public int Returned { get; set; }
    public int AwaitingCheck { get; set; }
    public int Completed { get; set; }
    public int InWarranty { get; set; }
    public int WarrantyExpired { get; set; }

    /// <summary>Mẫu Chưa Nhận — Sent / Returned, not yet overdue.</summary>
    public int AwaitingReturn { get; set; }

    /// <summary>Mẫu Giao Trễ.</summary>
    public int Overdue { get; set; }

    /// <summary>Mẫu Đã Nhận — back from the lab at least once.</summary>
    public int Received { get; set; }
}

/// <summary>
/// The Đặt hàng tab. "Lưu nháp" posts it with <see cref="Submit"/> false;
/// "Tạo phiếu Labo" with true, which saves and sends in one request so a
/// half-filled order never reaches the lab and a refused one is not kept.
/// </summary>
public class SaveLaboOrderDto
{
    public Guid? DentistId { get; set; }
    public Guid? SupplierId { get; set; }
    public Guid? MaterialId { get; set; }
    public Guid? BiteId { get; set; }
    public Guid? FinishLineId { get; set; }
    public Guid? RhythmId { get; set; }

    /// <summary>Răng: FDI numbers.</summary>
    public List<int> Teeth { get; set; } = [];

    /// <summary>Màu răng — read only from a caller that sends no <see cref="ToothSpecs"/>.</summary>
    public string? ToothShade { get; set; }

    /// <summary>
    /// Thông số từng răng (P3110), one row per tooth of <see cref="Teeth"/>.
    /// Null keeps the pre-P3110 contract: the order-level fields go to every tooth.
    /// </summary>
    public List<LaboToothSpecDto>? ToothSpecs { get; set; }

    /// <summary>Thông số răng / Màu răng Chung or Riêng (R-1150).</summary>
    public LaboSpecMode SpecMode { get; set; } = LaboSpecMode.PerTooth;

    /// <summary>Số lượng.</summary>
    public int Quantity { get; set; } = 1;
    public string? WorkDescription { get; set; }

    /// <summary>Nội dung / chỉ định cho Labo.</summary>
    public string? Notes { get; set; }

    /// <summary>Ngày gửi — the day counts, the time is dropped.</summary>
    public DateTimeOffset? SentAt { get; set; }

    /// <summary>Ngày nhận dự kiến — the day counts, the time is dropped.</summary>
    public DateTimeOffset? DueAt { get; set; }
    public decimal EstimatedCost { get; set; }

    /// <summary>Dịch vụ điều trị — the plan line the order is for.</summary>
    public Guid? TreatmentServiceId { get; set; }

    /// <summary>The công đoạn the order was raised from; null from the Labo tab.</summary>
    public Guid? TreatmentStageId { get; set; }

    /// <summary>True on "Tạo phiếu Labo": the order goes to Đã gửi Labo.</summary>
    public bool Submit { get; set; }

    /// <summary>Ảnh đính kèm chung picked in the dialog — at most five with those kept, none required.</summary>
    public List<IRemoteStreamContent>? Pictures { get; set; }

    /// <summary>Pictures of the tooth rows (cột Ảnh); <see cref="ToothPictureTeeth"/> names each one's tooth.</summary>
    public List<IRemoteStreamContent>? ToothPictures { get; set; }

    /// <summary>The tooth of each <see cref="ToothPictures"/> entry, same order: FDI, or 0 for the "Dùng chung" row.</summary>
    public List<int>? ToothPictureTeeth { get; set; }
}

/// <summary>One row of the Thông số từng răng table.</summary>
public class LaboToothSpecDto
{
    public int ToothNumber { get; set; }

    /// <summary>Màu răng; several written "A1/A2/A3".</summary>
    [StringLength(100)]
    public string? Shade { get; set; }
    public Guid? FinishLineId { get; set; }
    public Guid? RhythmId { get; set; }

    /// <summary>"Riêng theo mặt": each surface has its own Màu (R-1150).</summary>
    public bool ShadeBySurface { get; set; }

    /// <summary>Mặt răng; Gửi Labo needs at least one.</summary>
    public List<LaboToothSurfaceDto> Surfaces { get; set; } = [];
}

/// <summary>One Mặt răng of a <see cref="LaboToothSpecDto"/>: M · D · I · O · F · B · L.</summary>
public class LaboToothSurfaceDto
{
    [Required]
    [StringLength(1)]
    public string Code { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Shade { get; set; }
    public Guid? FinishLineId { get; set; }
}

public class LaboOrderToothSurfaceDto : LaboToothSurfaceDto
{
    public string? FinishLineName { get; set; }
}

public class CreateLaboOrderDto : SaveLaboOrderDto
{
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }

    /// <summary>Số phiếu Labo. Omit and the server allocates the next one.</summary>
    public string? OrderCode { get; set; }
}

public class UpdateLaboOrderDto : SaveLaboOrderDto
{
    /// <summary>
    /// The saved pictures still on the dialog. Every other picture sent to
    /// the lab is removed; null keeps them all.
    /// </summary>
    public List<Guid>? KeepImageIds { get; set; }
}

/// <summary>"Kiểm tra hàng": the receive part of Nhận hàng · lần N.</summary>
public class ReceiveLaboOrderDto
{
    /// <summary>Ngày nhận thực tế.</summary>
    public DateTimeOffset ReceivedAt { get; set; }

    /// <summary>Số lượng nhận.</summary>
    public int ReceivedQuantity { get; set; }
}

/// <summary>Kết luận of a check.</summary>
public enum LaboCheckConclusion
{
    /// <summary>Xác nhận Labo đạt.</summary>
    Pass = 1,

    /// <summary>Trả toàn bộ.</summary>
    ReturnAll = 2,

    /// <summary>Trả hàng bị lỗi.</summary>
    ReturnDefective = 3
}

public class LaboToothCheckDto
{
    public int ToothNumber { get; set; }
    public LaboToothCheckResult Result { get; set; }

    /// <summary>Mô tả gửi Labo of this tooth (P3110 REQ-D6); required on a Lỗi tooth when returning.</summary>
    public string? Note { get; set; }

    /// <summary>Mặt bị lỗi (R-1151): codes among the tooth's ordered surfaces; at least one on a Lỗi tooth that has any.</summary>
    public List<string> FaultSurfaces { get; set; } = [];
}

/// <summary>
/// "Kiểm tra từng răng" + "Kết luận". Multipart, so the Ảnh kiểm tra ride
/// along and are kept only if the check is.
/// </summary>
public class CheckLaboOrderDto
{
    public List<LaboToothCheckDto> Teeth { get; set; } = [];
    public LaboCheckConclusion Conclusion { get; set; }

    /// <summary>
    /// Mô tả gửi Labo of the whole return. Optional since P3110: left blank,
    /// the round keeps the teeth's descriptions joined.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>Ngày trả hàng.</summary>
    public DateTimeOffset? ReturnedAt { get; set; }

    /// <summary>Hẹn Labo giao lại.</summary>
    public DateTimeOffset? RedeliveryDueAt { get; set; }

    /// <summary>Ảnh kiểm tra not tied to a tooth (pre-P3110 callers).</summary>
    public List<IRemoteStreamContent>? Pictures { get; set; }

    /// <summary>Pictures of the checked teeth — Lỗi teeth's Hình ảnh lỗi (P3110 REQ-D6), Đạt teeth's own (R-1110); <see cref="ToothPictureTeeth"/> names each one's tooth.</summary>
    public List<IRemoteStreamContent>? ToothPictures { get; set; }

    /// <summary>The tooth of each <see cref="ToothPictures"/> entry, same order.</summary>
    public List<int>? ToothPictureTeeth { get; set; }
}

public class LaboWarrantyCardDto
{
    public int ToothNumber { get; set; }

    /// <summary>Ngày bắt đầu bảo hành.</summary>
    public DateOnly StartDate { get; set; }

    /// <summary>Thời hạn bảo hành, in months.</summary>
    public int Months { get; set; }

    /// <summary>Mã thẻ hãng / serial.</summary>
    [StringLength(100)]
    public string? ManufacturerSerial { get; set; }

    /// <summary>Điều kiện / ghi chú.</summary>
    [StringLength(1000)]
    public string? Conditions { get; set; }
}

/// <summary>"Kích hoạt bảo hành (n răng)".</summary>
public class ActivateLaboWarrantyDto
{
    public List<LaboWarrantyCardDto> Cards { get; set; } = [];

    /// <summary>
    /// Ảnh thẻ, optional (P3110 REQ-E1); <see cref="CardPhotoTeeth"/> and
    /// <see cref="CardPhotoSides"/> name each one's tooth and face, same order.
    /// </summary>
    public List<IRemoteStreamContent>? CardPhotos { get; set; }

    public List<int>? CardPhotoTeeth { get; set; }

    public List<WarrantyCardSide>? CardPhotoSides { get; set; }
}

public class GetLaboOrderListInput : PagedAndSortedResultRequestDto
{
    public LaboSampleFilter? SampleFilter { get; set; }

    /// <summary>The Labo tab's filter card.</summary>
    public LaboStatusFilter? StatusFilter { get; set; }
    public LaboOrderKind? Kind { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? PatientId { get; set; }

    /// <summary>
    /// The phiếu điều trị the orders were raised under — read through their
    /// service line. The Đặt hàng tab warns with it of a tooth already sent
    /// on that slip (P0111_02, R-1106).
    /// </summary>
    public Guid? TreatmentPlanId { get; set; }

    /// <summary>"BE:Common:SelectDentist" — the dentist the sample was ordered by.</summary>
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
