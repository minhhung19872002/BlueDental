using System.Collections.Generic;
using System.Linq;
using Volo.Abp.Domain.Values;

namespace BlueDental.Labo;

/// <summary>
/// Màu răng of the Phiếu yêu cầu (F-91): three bands of the crown — Cổ, Thân,
/// Rìa cắn — each split gần / xa. Any zone may be blank; Tạo phiếu Labo needs
/// at least one filled.
/// </summary>
public class LaboShadeZones : ValueObject
{
    public const int MaxLength = 20;

    public string? CervicalMesial { get; private set; }
    public string? CervicalDistal { get; private set; }
    public string? BodyMesial { get; private set; }
    public string? BodyDistal { get; private set; }
    public string? IncisalMesial { get; private set; }
    public string? IncisalDistal { get; private set; }

    protected LaboShadeZones() { }

    public LaboShadeZones(
        string? cervicalMesial, string? cervicalDistal,
        string? bodyMesial, string? bodyDistal,
        string? incisalMesial, string? incisalDistal)
    {
        CervicalMesial = Clean(cervicalMesial);
        CervicalDistal = Clean(cervicalDistal);
        BodyMesial = Clean(bodyMesial);
        BodyDistal = Clean(bodyDistal);
        IncisalMesial = Clean(incisalMesial);
        IncisalDistal = Clean(incisalDistal);
    }

    /// <summary>Cổ gần, Cổ xa, Thân gần, Thân xa, Rìa gần, Rìa xa.</summary>
    public IEnumerable<string?> Zones =>
        [CervicalMesial, CervicalDistal, BodyMesial, BodyDistal, IncisalMesial, IncisalDistal];

    public bool IsEmpty => Zones.All(z => z is null);

    /// <summary>The distinct shades, "A2/A3" — what the readers of <c>ToothShade</c> show.</summary>
    public string? Summary
    {
        get
        {
            var shades = Zones.Where(z => z is not null).Distinct().ToList();
            return shades.Count == 0 ? null : string.Join("/", shades);
        }
    }

    /// <summary>Shades are typed upper-case ("a2" is A2); longer text is cut to the column.</summary>
    private static string? Clean(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var trimmed = value.Trim().ToUpperInvariant();
        return trimmed.Length > MaxLength ? trimmed[..MaxLength] : trimmed;
    }

    protected override IEnumerable<object> GetAtomicValues() => Zones.Select(z => (object)(z ?? string.Empty));
}
