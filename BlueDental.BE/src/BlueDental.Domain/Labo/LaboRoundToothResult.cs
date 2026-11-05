using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp.Domain.Values;

namespace BlueDental.Labo;

/// <summary>
/// One tooth as the check found it: Đạt, or Lỗi with its note — since P3110
/// the tooth's "Mô tả gửi Labo" (REQ-D6) — and, since Labo v2 (R-1151), the
/// Mặt bị lỗi picked on its picture. Both what the check form posts and what
/// a round keeps (jsonb on the round row), so each return keeps its own.
/// </summary>
public class LaboRoundToothResult : ValueObject
{
    public int ToothNumber { get; private set; }
    public LaboToothCheckResult Result { get; private set; }
    public string? Note { get; private set; }

    /// <summary>
    /// Mặt bị lỗi as codes joined by commas ("M,O"), in the form's order; null
    /// on a Đạt tooth and on rounds checked before R-1151.
    /// </summary>
    public string? FaultSurfaces { get; private set; }

    /// <summary><see cref="FaultSurfaces"/> as a list.</summary>
    public IReadOnlyList<string> Faults =>
        FaultSurfaces?.Split(',', StringSplitOptions.RemoveEmptyEntries) ?? [];

    protected LaboRoundToothResult() { }

    public LaboRoundToothResult(
        int toothNumber, LaboToothCheckResult result, string? note = null, IEnumerable<string>? faults = null)
    {
        ToothNumber = toothNumber;
        Result = result;
        var failed = result == LaboToothCheckResult.Failed;
        Note = failed && !string.IsNullOrWhiteSpace(note) ? note.Trim() : null;
        FaultSurfaces = failed ? JoinFaults(toothNumber, faults) : null;
    }

    /// <summary>Known codes first in the form's order, then any unknown one as sent, so the check can refuse it.</summary>
    private static string? JoinFaults(int toothNumber, IEnumerable<string>? faults)
    {
        var codes = (faults ?? []).Where(f => !string.IsNullOrWhiteSpace(f))
            .Select(f => f.Trim().ToUpperInvariant()).Distinct().ToList();
        if (codes.Count == 0)
            return null;
        var allowed = ToothSurfaces.Of(toothNumber);
        var ordered = allowed.Where(codes.Contains).Concat(codes.Where(c => !allowed.Contains(c)));
        return string.Join(",", ordered);
    }

    protected override IEnumerable<object> GetAtomicValues()
    {
        yield return ToothNumber;
        yield return Result;
        yield return Note ?? string.Empty;
        yield return FaultSurfaces ?? string.Empty;
    }
}
