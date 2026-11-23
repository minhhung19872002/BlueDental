using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;

namespace BlueDental.Labo;

/// <summary>
/// Mã số of a Phiếu yêu cầu, handed out by the server (R-1288):
/// "{Mã bệnh nhân}-{yyyyMMdd}-{xxx}". yyyyMMdd is the clinic day the slip was
/// created on; xxx counts that patient's slips, from 001, and never restarts.
/// The patient code keeps the number unique in the branch; the screens cut it
/// off because the patient sits next to the number everywhere it is shown.
/// </summary>
public static partial class LaboSlipNumber
{
    [GeneratedRegex(@"-(\d{8})-(\d{3,9})$")]
    private static partial Regex Tail();

    public static string Format(string patientCode, DateOnly createdOn, int sequence) =>
        $"{patientCode}-{createdOn.ToString("yyyyMMdd", CultureInfo.InvariantCulture)}-{sequence:D3}";

    /// <summary>
    /// The sequence the next slip of a patient takes: one past the highest
    /// already used on any of their slips, cancelled and deleted ones too, so
    /// a number is never handed out twice. Hand-typed numbers of another shape
    /// do not count.
    /// </summary>
    public static int NextSequence(IEnumerable<string> usedNumbers) =>
        usedNumbers
            .Select(no => Tail().Match(no))
            .Where(match => match.Success)
            .Select(match => int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture))
            .DefaultIfEmpty(0)
            .Max() + 1;
}
