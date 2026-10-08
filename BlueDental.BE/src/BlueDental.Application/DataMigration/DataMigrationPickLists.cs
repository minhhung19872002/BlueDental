using System.Collections.Generic;
using System.Linq;
using BlueDental.Catalogs.Import;
using ClosedXML.Excel;
using static BlueDental.DataMigration.DataMigrationLayout;

namespace BlueDental.DataMigration;

/// <summary>The localized texts of the drop-down's refusal box.</summary>
internal sealed record PickListMessages(string Title, string NotInList);

/// <summary>
/// Drop-down lists on the template's fixed-choice columns, so a value is
/// picked rather than typed. Catalog and staff columns get none: the template
/// is filled offline, often from a copy downloaded off another server than the
/// one it is imported into, so a list baked from one database would refuse
/// names valid on the other (owner, 2026-10-08). The import checks those (dryRun).
///
/// Excel only checks typed values — a paste skips validation — so the import
/// still reads every cell the same way; the lists only save typing mistakes.
/// </summary>
internal static class DataMigrationPickLists
{
    public static readonly string[] Genders = ["Nam", "Nữ", "Khác"];

    public static readonly string[] Relations =
        ["Bố", "Mẹ", "Ông", "Bà", "Anh / Chị ruột", "Cô / Dì / Chú / Bác", "Người giám hộ hợp pháp"];

    public static readonly string[] Statuses = ["Hoàn thành", "Đang điều trị"];

    private const int FirstDataRow = 2;

    public static void Apply(IXLWorksheet patients, IXLWorksheet treatments, PickListMessages messages)
    {
        Restrict(patients, Patients, Col.Gender, messages, Genders);
        Restrict(patients, Patients, Col.GuardianRelation, messages, Relations);
        Restrict(treatments, Treatments, Col.Status, messages, Statuses);
    }

    private static void Restrict(
        IXLWorksheet sheet,
        ImportSheetLayout layout,
        string key,
        PickListMessages messages,
        IEnumerable<string> values)
    {
        var column = layout.Columns.Select((c, index) => (c, index)).Single(c => c.c.Key == key).index + 1;
        var validation = sheet.Range(FirstDataRow, column, XLHelper.MaxRowNumber, column).CreateDataValidation();
        // ClosedXML writes an inline list into formula1 verbatim, so it carries its own quotes.
        validation.List("\"" + string.Join(",", values) + "\"");
        validation.IgnoreBlanks = true;
        validation.ShowErrorMessage = true;
        validation.ErrorStyle = XLErrorStyle.Stop;
        validation.ErrorTitle = messages.Title;
        validation.ErrorMessage = messages.NotInList;
    }
}
