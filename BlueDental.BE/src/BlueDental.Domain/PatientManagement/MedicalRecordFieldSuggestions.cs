using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BlueDental.PatientManagement;

/// <summary>
/// "Gợi ý khi nhập" on a sheet (clinic, 2026-11-12, R-1219): typing in one of
/// these blanks offers what the branch has written in the same blank of the
/// same form before, the most used first — the way a search box completes a
/// query.
///
/// What is offered is other patients' writing, so it is held back to phrases:
/// a text is offered only once it was written for at least
/// <see cref="MinPatients"/> different patients, and never when it runs past
/// <see cref="MaxTextLength"/> characters. A note about one patient stays on
/// that patient's sheet. Only the blanks listed here are offered, whatever the
/// caller asks for.
/// </summary>
public static class MedicalRecordFieldSuggestions
{
    public const int MinPatients = 2;
    public const int MaxTextLength = 300;
    public const int MaxPerField = 200;

    /// <summary>Mẫu 2: "2. Bệnh chuyên khoa" and "5. Chẩn đoán của khoa khám bệnh".</summary>
    private static readonly IReadOnlyDictionary<MedicalRecordForm, string[]> Fields =
        new Dictionary<MedicalRecordForm, string[]>
        {
            [MedicalRecordForm.OutpatientDental] = ["outpatient-dental.text.30", "outpatient-dental.text.43"],
        };

    public static IReadOnlyList<string> FieldsOf(MedicalRecordForm form) =>
        Fields.TryGetValue(form, out var fields) ? fields : [];
}

/// <summary>What has been written in one blank across a branch's sheets.</summary>
public interface IMedicalRecordFieldHistory
{
    /// <summary>
    /// The texts written in <paramref name="fieldId"/> on the branch's live
    /// sheets of <paramref name="form"/> (not deleted, not cancelled), trimmed,
    /// for at least <paramref name="minPatients"/> patients and at most
    /// <paramref name="maxLength"/> characters long; most patients first.
    /// </summary>
    Task<List<string>> GetCommonValuesAsync(
        Guid clinicBranchId, MedicalRecordForm form, string fieldId, int minPatients, int maxLength, int limit);
}
