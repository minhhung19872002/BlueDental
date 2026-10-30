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
    public string? ToothShade { get; init; }
    public int Quantity { get; init; } = 1;
    public string? WorkDescription { get; init; }

    /// <summary>Nội dung / chỉ định cho Labo.</summary>
    public string? Notes { get; init; }

    /// <summary>Ngày gửi + Giờ gửi.</summary>
    public DateTimeOffset? SentAt { get; init; }

    /// <summary>Ngày nhận dự kiến + Giờ nhận.</summary>
    public DateTimeOffset? DueAt { get; init; }
    public decimal EstimatedCost { get; init; }
    public Guid? TreatmentServiceId { get; init; }
    public Guid? TreatmentStageId { get; init; }
}

/// <summary>Kết luận of a check that sends teeth back.</summary>
public record LaboReturnRequest(
    bool ReturnAll,
    string? Description,
    DateTimeOffset? ReturnedAt,
    DateTimeOffset? RedeliveryDueAt,
    int CheckImageCount);

/// <summary>One tooth's card on "Kích hoạt bảo hành".</summary>
public record LaboWarrantyActivation(
    int ToothNumber,
    DateOnly StartDate,
    int Months,
    string? ManufacturerSerial = null,
    string? Conditions = null);
