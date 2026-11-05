using System;
using System.Collections.Generic;

namespace BlueDental.Labo;

/// <summary>
/// Everything the Đặt hàng tab holds. A draft may leave any of it blank;
/// <see cref="LaboOrder.Submit"/> is where the required ones are enforced.
/// </summary>
public record LaboOrderDetails
{
    public Guid? DentistId { get; init; }
    public string? LabProviderName { get; init; }
    public Guid? SupplierId { get; init; }
    public Guid? MaterialId { get; init; }
    public Guid? BiteId { get; init; }
    public Guid? FinishLineId { get; init; }
    public Guid? RhythmId { get; init; }

    /// <summary>Răng, in the order they were picked.</summary>
    public IReadOnlyList<int> Teeth { get; init; } = [];

    /// <summary>
    /// Thông số từng răng (P3110). Null from a caller that still speaks the
    /// order-level fields, which then go to every tooth.
    /// </summary>
    public IReadOnlyList<LaboToothSpec>? ToothSpecs { get; init; }

    /// <summary>Chung / Riêng of Thông số răng and Màu răng — the rows are still stored per tooth.</summary>
    public LaboSpecMode SpecMode { get; init; } = LaboSpecMode.PerTooth;
    public string? ToothShade { get; init; }
    public int Quantity { get; init; } = 1;
    public string? WorkDescription { get; init; }

    /// <summary>Nội dung / chỉ định cho Labo.</summary>
    public string? Notes { get; init; }

    /// <summary>Ngày gửi — a day; kept as the clinic's midnight of it.</summary>
    public DateTimeOffset? SentAt { get; init; }

    /// <summary>Ngày nhận dự kiến — a day, as <see cref="SentAt"/>.</summary>
    public DateTimeOffset? DueAt { get; init; }
    public decimal EstimatedCost { get; init; }
    public Guid? TreatmentServiceId { get; init; }
    public Guid? TreatmentStageId { get; init; }
}

/// <summary>
/// One tooth of "Thông số từng răng" (Labo v2, R-1150): its Mặt răng and
/// Màu răng are required to send the order, the rest is optional. Khớp cắn
/// is the order's, not the tooth's.
/// </summary>
public record LaboToothSpec(
    int ToothNumber,
    string? Shade,
    Guid? FinishLineId,
    Guid? RhythmId,
    IReadOnlyList<LaboToothSurface> Surfaces,
    bool ShadeBySurface = false);

/// <summary>
/// Kết luận of a check that sends teeth back. <see cref="PicturedTeeth"/>
/// are the teeth holding at least one Hình ảnh lỗi in this round.
/// </summary>
public record LaboReturnRequest(
    bool ReturnAll,
    string? Description,
    DateTimeOffset? ReturnedAt,
    DateTimeOffset? RedeliveryDueAt,
    IReadOnlyCollection<int> PicturedTeeth);

/// <summary>One tooth's card on "Kích hoạt bảo hành".</summary>
public record LaboWarrantyActivation(
    int ToothNumber,
    DateOnly StartDate,
    int Months,
    string? ManufacturerSerial = null,
    string? Conditions = null);
