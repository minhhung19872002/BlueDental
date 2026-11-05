using System;
using System.Collections.Generic;
using Volo.Abp.Domain.Values;

namespace BlueDental.Labo;

/// <summary>
/// One mặt răng of a Labo tooth (R-1150). Màu and Đường hoàn tất are its own
/// only while the tooth is split "Riêng theo mặt"; otherwise they stay blank
/// and the tooth's values stand for every surface.
/// </summary>
public class LaboToothSurface : ValueObject
{
    /// <summary>M · D · I · O · F · B · L — see <see cref="ToothSurfaces"/>.</summary>
    public string Code { get; private set; } = string.Empty;
    public string? Shade { get; private set; }
    public Guid? FinishLineId { get; private set; }

    protected LaboToothSurface() { }

    public LaboToothSurface(string code, string? shade = null, Guid? finishLineId = null)
    {
        Code = code;
        Shade = string.IsNullOrWhiteSpace(shade) ? null : shade.Trim();
        FinishLineId = finishLineId;
    }

    protected override IEnumerable<object> GetAtomicValues()
    {
        yield return Code;
        yield return Shade ?? string.Empty;
        yield return FinishLineId ?? Guid.Empty;
    }
}
