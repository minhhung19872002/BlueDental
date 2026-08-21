using Volo.Abp;
using Volo.Abp.Domain.Values;

namespace BlueDental.PatientManagement.Values;

/// <summary>
/// Value object identifying a tooth using the ISO 3950 / FDI two-digit notation.
/// Quadrant: 1-4 (permanent) or 5-8 (deciduous).
/// Position: 1-8 from the midline.
/// </summary>
public class ToothLocation : ValueObject
{
    /// <summary>FDI quadrant (1-4 for permanent, 5-8 for deciduous).</summary>
    public int Quadrant { get; }

    /// <summary>Tooth position within the quadrant (1-8).</summary>
    public int Position { get; }

    /// <summary>Full FDI two-digit tooth number (e.g. 11, 36, 48).</summary>
    public string FdiCode => $"{Quadrant}{Position}";

    protected ToothLocation() { }

    public ToothLocation(int quadrant, int position)
    {
        if (quadrant < 1 || quadrant > 8)
            throw new BusinessException("BlueDental:Tooth:InvalidQuadrant",
                $"Quadrant must be between 1 and 8, got {quadrant}.");

        if (position < 1 || position > 8)
            throw new BusinessException("BlueDental:Tooth:InvalidPosition",
                $"Position must be between 1 and 8, got {position}.");

        Quadrant = quadrant;
        Position = position;
    }

    public static ToothLocation FromFdiCode(string fdiCode)
    {
        if (fdiCode?.Length != 2
            || !int.TryParse(fdiCode[0].ToString(), out var quadrant)
            || !int.TryParse(fdiCode[1].ToString(), out var position))
        {
            throw new BusinessException("BlueDental:Tooth:InvalidFdiCode",
                $"Invalid FDI code '{fdiCode}'. Expected exactly two digits.");
        }

        return new ToothLocation(quadrant, position);
    }

    public override string ToString() => FdiCode;

    protected override IEnumerable<object?> GetAtomicValues()
    {
        yield return Quadrant;
        yield return Position;
    }
}
