using System.Collections.Generic;

namespace BlueDental.Labo;

/// <summary>
/// Mặt răng a Labo tooth may be made on (Labo v2, R-1150), in the order the
/// form lists them. Răng cửa / răng nanh (FDI unit 1–3) have a biting edge
/// (I · Cắn) and a facial side (F · Ngoài); răng sau a chewing surface
/// (O · Nhai) and a buccal side (B · Má).
/// </summary>
public static class ToothSurfaces
{
    public static readonly IReadOnlyList<string> Anterior = ["M", "D", "I", "F", "L"];
    public static readonly IReadOnlyList<string> Posterior = ["M", "D", "O", "B", "L"];

    public static bool IsAnterior(int toothNumber) => toothNumber % 10 is >= 1 and <= 3;

    public static IReadOnlyList<string> Of(int toothNumber) =>
        IsAnterior(toothNumber) ? Anterior : Posterior;
}
