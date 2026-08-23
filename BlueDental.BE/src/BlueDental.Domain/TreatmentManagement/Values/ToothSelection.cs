using System.Collections.Generic;
using Volo.Abp;
using BlueDental.Values;

namespace BlueDental.TreatmentManagement.Values;

/// <summary>
/// One tooth touched by a diagnosis or a consulting line, together with the
/// surfaces involved.
///
/// Mirrors the reference application's <c>content[]</c> element:
/// <c>{ code, selected, top, right, bottom, left, center }</c> where <c>code</c>
/// is the FDI/ISO-3950 two-digit tooth number.
/// </summary>
public class ToothSelection : ComparableValueObject
{
    /// <summary>FDI tooth number: 11-48 (permanent) or 51-85 (deciduous).</summary>
    public int ToothCode { get; private set; }

    /// <summary>The whole tooth is selected, independent of individual surfaces.</summary>
    public bool Selected { get; private set; }

    public bool Top { get; private set; }
    public bool Right { get; private set; }
    public bool Bottom { get; private set; }
    public bool Left { get; private set; }
    public bool Center { get; private set; }

    protected ToothSelection() { }

    public ToothSelection(
        int toothCode,
        bool selected = false,
        bool top = false,
        bool right = false,
        bool bottom = false,
        bool left = false,
        bool center = false)
    {
        if (!IsValidToothCode(toothCode))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidToothCode,
                $"Tooth code {toothCode} is not a valid FDI number.");
        }

        if (!selected && !top && !right && !bottom && !left && !center)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.EmptyToothSelection,
                $"Tooth {toothCode} must have the whole tooth or at least one surface selected.");
        }

        ToothCode = toothCode;
        Selected = selected;
        Top = top;
        Right = right;
        Bottom = bottom;
        Left = left;
        Center = center;
    }

    /// <summary>
    /// FDI numbering: quadrants 1-4 hold permanent teeth 1-8,
    /// quadrants 5-8 hold deciduous teeth 1-5.
    /// </summary>
    public static bool IsValidToothCode(int toothCode)
    {
        var quadrant = toothCode / 10;
        var position = toothCode % 10;

        return quadrant switch
        {
            >= 1 and <= 4 => position is >= 1 and <= 8,
            >= 5 and <= 8 => position is >= 1 and <= 5,
            _ => false
        };
    }

    public bool IsDeciduous => ToothCode / 10 >= 5;

    /// <summary>Number of individually marked surfaces (0-5).</summary>
    public int SurfaceCount =>
        (Top ? 1 : 0) + (Right ? 1 : 0) + (Bottom ? 1 : 0) + (Left ? 1 : 0) + (Center ? 1 : 0);

    protected override IEnumerable<object> GetAtomicValues()
    {
        yield return ToothCode;
        yield return Selected;
        yield return Top;
        yield return Right;
        yield return Bottom;
        yield return Left;
        yield return Center;
    }
}
