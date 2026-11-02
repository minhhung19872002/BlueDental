using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;

namespace BlueDental.PatientManagement;

/// <summary>
/// "Mã khách hàng" numbering — DH + two-digit year + a four-digit sequence
/// (<c>DH260052</c>), one series for every branch since the code is unique
/// system-wide.
///
/// BA 2026-11-02: the next code is the smallest number of the year nobody
/// holds, so a code typed out of turn (200 while the series is at 52) neither
/// moves the series on nor is handed out again: 53 follows 52, and on
/// reaching 200 the series steps over it to 201.
/// </summary>
internal static partial class PatientCodeNumbering
{
    private const int SequenceDigits = 4;

    public static string Prefix(int year) => $"DH{year % 100:D2}";

    public static string Format(int year, int sequence) => Prefix(year) + FormatSequence(sequence);

    public static string FormatSequence(int sequence) =>
        sequence.ToString("D" + SequenceDigits, CultureInfo.InvariantCulture);

    /// <summary>
    /// The stored spelling of a typed code: "DH26200" and "DH2600200" are both
    /// number 200, kept as "DH260200" so the duplicate test and the series see
    /// one code. Anything not shaped DH + year + digits (old-system codes) is
    /// left as typed.
    /// </summary>
    public static string Normalize(string code)
    {
        var trimmed = code.Trim();
        var match = SeriesShape().Match(trimmed);
        if (!match.Success || !int.TryParse(match.Groups[2].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var sequence))
        {
            return trimmed;
        }

        return match.Groups[1].Value.ToUpperInvariant() + FormatSequence(sequence);
    }

    /// <summary>
    /// Every spelling a normalised code may already be stored under — the
    /// padded one, and the bare number R-1078 saved while codes were typed by hand.
    /// </summary>
    public static string[] StoredSpellings(string normalized)
    {
        var match = SeriesShape().Match(normalized);
        if (!match.Success || !int.TryParse(match.Groups[2].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var sequence))
        {
            return [normalized];
        }

        var bare = match.Groups[1].Value + sequence.ToString(CultureInfo.InvariantCulture);
        return bare == normalized ? [normalized] : [normalized, bare];
    }

    /// <summary>The smallest sequence of the year no code below holds, whatever its spelling.</summary>
    public static int FirstFreeSequence(string prefix, IEnumerable<string> codes) =>
        NextFree(TakenSequences(prefix, codes), from: 1);

    /// <summary>The numbers of the year the codes below hold; codes of another shape hold none.</summary>
    public static HashSet<int> TakenSequences(string prefix, IEnumerable<string> codes)
    {
        var taken = new HashSet<int>();
        foreach (var code in codes)
        {
            if (code.Length > prefix.Length
                && code.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                && int.TryParse(code.AsSpan(prefix.Length), NumberStyles.None, CultureInfo.InvariantCulture, out var sequence))
            {
                taken.Add(sequence);
            }
        }

        return taken;
    }

    public static int NextFree(IReadOnlySet<int> taken, int from)
    {
        var next = from;
        while (taken.Contains(next))
        {
            next++;
        }

        return next;
    }

    [GeneratedRegex(@"^(DH\d{2})(\d{1,9})$", RegexOptions.IgnoreCase)]
    private static partial Regex SeriesShape();
}
