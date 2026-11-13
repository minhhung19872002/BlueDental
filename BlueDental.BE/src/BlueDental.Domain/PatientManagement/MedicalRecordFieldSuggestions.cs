using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace BlueDental.PatientManagement;

/// <summary>
/// "Gợi ý khi nhập" on a sheet (clinic, 2026-11-12, R-1219): typing in one of
/// these blanks offers what the branch has written in the same part of the
/// same form before, the most used first — the way a search box completes a
/// query.
///
/// A part of the form is written over several printed lines, each its own
/// blank ("2. Bệnh chuyên khoa" is text.30 and the five lines under it), and
/// every line offers the same list: what was written on any of them, line by
/// line (R-1222). Lines the clinic added with Enter under one of them count
/// as that part's too.
///
/// What is offered is other patients' writing, so it is held back to phrases:
/// a line is offered only once it was written for at least
/// <see cref="MinPatients"/> different patients, and never when it runs past
/// <see cref="MaxTextLength"/> characters. A note about one patient stays on
/// that patient's sheet. Only the parts listed here are offered, whatever the
/// caller asks for.
/// </summary>
public static class MedicalRecordFieldSuggestions
{
    public const int MinPatients = 2;
    public const int MaxTextLength = 300;
    public const int MaxPerField = 200;

    /// <summary>Mẫu 2: "2. Bệnh chuyên khoa" (text.30–35) and "5. Chẩn đoán của khoa khám bệnh" (text.43–44).</summary>
    private static readonly IReadOnlyDictionary<MedicalRecordForm, SuggestionGroup[]> Groups =
        new Dictionary<MedicalRecordForm, SuggestionGroup[]>
        {
            [MedicalRecordForm.OutpatientDental] =
            [
                new("outpatient-dental.text.30", OutpatientDentalLines(30, 35)),
                new("outpatient-dental.text.43", OutpatientDentalLines(43, 44)),
            ],
        };

    public static IReadOnlyList<SuggestionGroup> GroupsOf(MedicalRecordForm form) =>
        Groups.TryGetValue(form, out var groups) ? groups : [];

    private static string[] OutpatientDentalLines(int first, int last) =>
        [.. Enumerable.Range(first, last - first + 1).Select(n => $"outpatient-dental.text.{n}")];
}

/// <summary>One part of a form: the blank it starts on, and every printed line of it, that one first.</summary>
public sealed record SuggestionGroup(string Field, IReadOnlyList<string> Lines);

/// <summary>What has been written in one part of a form across a branch's sheets.</summary>
public interface IMedicalRecordFieldHistory
{
    /// <summary>
    /// The lines written in <paramref name="fieldIds"/> — and in the lines
    /// added under them — on the branch's live sheets of <paramref name="form"/>
    /// (not deleted, not cancelled), each trimmed, for at least
    /// <paramref name="minPatients"/> patients and at most
    /// <paramref name="maxLength"/> characters long; most patients first.
    /// </summary>
    Task<List<string>> GetCommonValuesAsync(
        Guid clinicBranchId, MedicalRecordForm form, IReadOnlyList<string> fieldIds,
        int minPatients, int maxLength, int limit);
}
