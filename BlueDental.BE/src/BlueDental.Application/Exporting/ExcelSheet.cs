using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using ClosedXML.Excel;

namespace BlueDental.Exporting;

/// <summary>
/// A column of an exported sheet: the header the clinic reads and how one row
/// turns into a cell value.
/// </summary>
/// <param name="Header">Column title, already in the user's language.</param>
/// <param name="Value">Cell value; a decimal or a date keeps its type so Excel
/// can sum and sort it rather than treating it as text.</param>
/// <param name="Width">Column width in characters.</param>
public sealed record ExcelColumn<T>(string Header, Func<T, object?> Value, double Width = 18);

/// <summary>
/// Turns rows into a one-sheet workbook.
///
/// The reference offers "Xuất Excel" on the report, CSKH and labo screens; every
/// one of them is the same shape — a title, a header row and typed cells — so the
/// shape lives here instead of in each app service.
/// </summary>
public static class ExcelSheet
{
    public static byte[] Build<T>(
        string sheetName,
        string title,
        IReadOnlyCollection<ExcelColumn<T>> columns,
        IEnumerable<T> rows,
        string? subtitle = null)
    {
        using var workbook = new XLWorkbook();

        // Excel refuses a sheet name over 31 characters or with : \ / ? * [ ]
        var worksheet = workbook.Worksheets.Add(SafeSheetName(sheetName));

        var titleRow = 1;
        worksheet.Cell(titleRow, 1).Value = title;
        worksheet.Cell(titleRow, 1).Style.Font.Bold = true;
        worksheet.Cell(titleRow, 1).Style.Font.FontSize = 14;
        worksheet.Range(titleRow, 1, titleRow, Math.Max(columns.Count, 1)).Merge();

        var headerRow = titleRow + 1;
        if (!string.IsNullOrWhiteSpace(subtitle))
        {
            worksheet.Cell(headerRow, 1).Value = subtitle;
            worksheet.Range(headerRow, 1, headerRow, Math.Max(columns.Count, 1)).Merge();
            headerRow++;
        }

        headerRow++;

        var columnList = columns.ToList();
        for (var i = 0; i < columnList.Count; i++)
        {
            var cell = worksheet.Cell(headerRow, i + 1);
            cell.Value = columnList[i].Header;
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#EBF3FE");
            worksheet.Column(i + 1).Width = columnList[i].Width;
        }

        var rowIndex = headerRow + 1;
        foreach (var row in rows)
        {
            for (var i = 0; i < columnList.Count; i++)
            {
                worksheet.Cell(rowIndex, i + 1).Value = ToCellValue(columnList[i].Value(row));
            }

            rowIndex++;
        }

        if (rowIndex > headerRow + 1)
        {
            worksheet.Range(headerRow, 1, rowIndex - 1, columnList.Count).SetAutoFilter();
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static XLCellValue ToCellValue(object? value) => value switch
    {
        null => Blank.Value,
        string text => text,
        decimal number => number,
        int number => number,
        long number => number,
        double number => number,
        bool flag => flag,
        DateTime date => date,
        DateTimeOffset date => date.DateTime,
        DateOnly date => date.ToDateTime(TimeOnly.MinValue),
        _ => value.ToString() ?? string.Empty
    };

    private static string SafeSheetName(string name)
    {
        var cleaned = new string(name.Where(c => !"\\/?*[]:".Contains(c)).ToArray());
        return cleaned.Length <= 31 ? cleaned : cleaned[..31];
    }
}
