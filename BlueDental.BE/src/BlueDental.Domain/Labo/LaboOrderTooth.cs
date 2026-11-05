using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
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

    /// <summary>Màu răng; several shades are written "A1/A2/A3".</summary>
    public string? Shade { get; private set; }

    /// <summary>Đường hoàn tất, a Labo taxonomy row.</summary>
    public Guid? FinishLineId { get; private set; }

    /// <summary>Kiểu nhịp, a Labo taxonomy row.</summary>
    public Guid? RhythmId { get; private set; }

    /// <summary>Khớp cắn, a Labo taxonomy row (owner D3: a column after Kiểu nhịp).</summary>
    public Guid? BiteId { get; private set; }

    /// <summary>Ghi chú cho Labo — written before Labo v2 (R-1150) only, read back as it was.</summary>
    public string? LabNote { get; private set; }

    /// <summary>
    /// "Riêng theo mặt": each surface carries its own Màu (and, Riêng từng răng,
    /// its own Đường hoàn tất). Only on a tooth with two or more surfaces.
    /// </summary>
    public bool ShadeBySurface { get; private set; }

    private readonly List<LaboToothSurface> _surfaces = [];

    /// <summary>Mặt răng (R-1150), in <see cref="ToothSurfaces"/> order; none on an order made before it.</summary>
    public IReadOnlyList<LaboToothSurface> Surfaces => _surfaces.AsReadOnly();

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

    /// <summary>
    /// Màu răng — on the tooth, or on every surface while it is split. Gửi Labo
    /// needs it on every tooth; Đường hoàn tất is optional since R-1150.
    /// </summary>
    public bool HasShade => ShadeBySurface
        ? _surfaces.All(s => !string.IsNullOrWhiteSpace(s.Shade))
        : !string.IsNullOrWhiteSpace(Shade);

    internal void SetSpec(string? shade, Guid? finishLineId, Guid? rhythmId, Guid? biteId)
    {
        Shade = string.IsNullOrWhiteSpace(shade) ? null : shade.Trim();
        FinishLineId = finishLineId;
        RhythmId = rhythmId;
        BiteId = biteId;
    }

    /// <summary>
    /// Mặt răng and their values. A code not of this tooth's kind is refused;
    /// repeats collapse. A tooth left with fewer than two surfaces cannot be
    /// split, and <paramref name="splitFinishLine"/> false (Chung thông số)
    /// keeps Đường hoàn tất off the surfaces.
    /// </summary>
    internal void SetSurfaces(IReadOnlyCollection<LaboToothSurface> surfaces, bool split, bool splitFinishLine)
    {
        var allowed = ToothSurfaces.Of(ToothNumber);
        var invalid = surfaces.FirstOrDefault(s => !allowed.Contains(s.Code));
        if (invalid is not null)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ToothSurfaceInvalid)
                .WithData("tooth", ToothNumber)
                .WithData("surface", invalid.Code);

        var byCode = surfaces.GroupBy(s => s.Code).ToDictionary(g => g.Key, g => g.Last());
        ShadeBySurface = split && byCode.Count > 1;
        _surfaces.Clear();
        foreach (var code in allowed.Where(byCode.ContainsKey))
        {
            var surface = byCode[code];
            _surfaces.Add(ShadeBySurface
                ? new LaboToothSurface(code, surface.Shade, splitFinishLine ? surface.FinishLineId : null)
                : new LaboToothSurface(code));
        }
    }

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
