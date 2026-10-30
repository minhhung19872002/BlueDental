using System;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Labo;

/// <summary>
/// One tooth of a Labo order (P2910_03): its standing check result and, once
/// the order has passed QC, its own warranty card. The order's
/// <see cref="LaboOrder.ToothNumbers"/> text is kept in step with these rows so
/// the Mẫu Labo list, the print sheet and the export still read it.
/// </summary>
public class LaboOrderTooth : Entity<Guid>
{
    public Guid LaboOrderId { get; private set; }

    /// <summary>FDI number, 11–48 or 51–85.</summary>
    public int ToothNumber { get; private set; }

    /// <summary>What the clinic has accepted so far; None while a check is due.</summary>
    public LaboToothCheckResult CheckResult { get; private set; }

    /// <summary>Ghi chú lỗi from the round that failed the tooth.</summary>
    public string? DefectNote { get; private set; }

    /// <summary>When the tooth was found Đạt — the earliest its warranty may start.</summary>
    public DateTimeOffset? PassedAt { get; private set; }

    /// <summary>Mã thẻ: <c>BH-{yyMM}-{last 4 of the order code}-{tooth}</c>.</summary>
    public string? WarrantyCardCode { get; private set; }

    /// <summary>Mã thẻ hãng / serial — optional.</summary>
    public string? ManufacturerSerial { get; private set; }
    public DateOnly? WarrantyStartDate { get; private set; }
    public int? WarrantyMonths { get; private set; }

    /// <summary>Start + months, the same day of the target month.</summary>
    public DateOnly? WarrantyEndDate { get; private set; }

    /// <summary>Điều kiện / ghi chú.</summary>
    public string? WarrantyConditions { get; private set; }
    public DateTimeOffset? WarrantyActivatedAt { get; private set; }
    public Guid? WarrantyActivatedById { get; private set; }

    protected LaboOrderTooth() { }

    internal static LaboOrderTooth Create(Guid id, Guid laboOrderId, int toothNumber) =>
        new() { Id = id, LaboOrderId = laboOrderId, ToothNumber = toothNumber };

    public bool IsWarrantyActivated => WarrantyActivatedAt.HasValue;

    /// <summary>A tooth whose card has run out: the day after its end date.</summary>
    public bool IsWarrantyExpiredOn(DateOnly today) =>
        IsWarrantyActivated && WarrantyEndDate < today;

    internal void Pass(DateTimeOffset at)
    {
        CheckResult = LaboToothCheckResult.Passed;
        DefectNote = null;
        PassedAt = at;
    }

    internal void Fail(string? note)
    {
        CheckResult = LaboToothCheckResult.Failed;
        DefectNote = note;
        PassedAt = null;
    }

    /// <summary>Back from the lab: the tooth waits for its next check.</summary>
    internal void Reopen()
    {
        CheckResult = LaboToothCheckResult.None;
        DefectNote = null;
        PassedAt = null;
    }

    internal void ActivateWarranty(
        string cardCode, LaboWarrantyActivation activation, DateTimeOffset at, Guid? byId)
    {
        WarrantyCardCode = cardCode;
        ManufacturerSerial = activation.ManufacturerSerial;
        WarrantyStartDate = activation.StartDate;
        WarrantyMonths = activation.Months;
        WarrantyEndDate = activation.StartDate.AddMonths(activation.Months);
        WarrantyConditions = activation.Conditions;
        WarrantyActivatedAt = at;
        WarrantyActivatedById = byId;
    }
}
