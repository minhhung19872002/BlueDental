using System.Collections.Generic;
using System.Linq;

namespace BlueDental.Labo;

/// <summary>
/// Thông số từng răng ready to send (R-1150): every tooth a shade and its two
/// main surfaces — Cắn + Ngoài on a front tooth, Nhai + Má on a back one.
/// </summary>
public static class LaboTestSpecs
{
    public static List<LaboToothSpec> For(IEnumerable<int> teeth, string shade = "A2") =>
        teeth.Select(t => new LaboToothSpec(t, shade, null, null, MainSurfaces(t))).ToList();

    public static List<LaboToothSurface> MainSurfaces(int tooth) =>
        ToothSurfaces.IsAnterior(tooth)
            ? [new LaboToothSurface("I"), new LaboToothSurface("F")]
            : [new LaboToothSurface("O"), new LaboToothSurface("B")];
}
