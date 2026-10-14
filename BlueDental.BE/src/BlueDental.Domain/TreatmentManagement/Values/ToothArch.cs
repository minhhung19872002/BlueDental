using System.Collections.Generic;
using System.Linq;

namespace BlueDental.TreatmentManagement.Values;

/// <summary>A whole jaw, as the tooth picker offers it: "Hàm trên", "Hàm dưới", "Nguyên hàm".</summary>
public enum WholeJaw
{
    Upper,
    Lower,
    Full,
}

/// <summary>
/// Telling a set of teeth that is exactly a whole jaw from teeth picked one by
/// one. A diagnosis or service picked as "Hàm trên" is stored as its sixteen
/// teeth, and is shown by the jaw's name — the same rule as the client's
/// <c>wholeJawOf</c>.
/// </summary>
public static class ToothArch
{
    private static readonly HashSet<int> Upper = [11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28];
    private static readonly HashSet<int> Lower = [31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48];

    /// <summary>
    /// The jaw these teeth are, each taken whole and none twice; null when they
    /// are anything else — a surface picked, a tooth missing or added.
    /// </summary>
    public static WholeJaw? WholeJawOf(IReadOnlyCollection<ToothSelection> teeth)
    {
        if (teeth.Count == 0 || teeth.Any(tooth => !tooth.Selected)) return null;

        var codes = teeth.Select(tooth => tooth.ToothCode).ToHashSet();
        if (codes.Count != teeth.Count) return null;

        if (codes.SetEquals(Upper.Concat(Lower))) return WholeJaw.Full;
        if (codes.SetEquals(Upper)) return WholeJaw.Upper;
        if (codes.SetEquals(Lower)) return WholeJaw.Lower;
        return null;
    }
}
