using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using BlueDental.Catalogs.Import;
using ClosedXML.Excel;
using Volo.Abp;
using Volo.Abp.Content;

namespace BlueDental.Marketing;

/// <summary>One data row of a Ticket File, as the mapping reads it.</summary>
internal sealed record TicketFileRow(int Row, string? FullName, string? Phone, string? Email, string? Note);

/// <summary>
/// Reads a Ticket File (BA 8.4): the first sheet, headers on row 1, one lead per
/// row below. Which column is which comes from the caller's mapping, so the
/// clinic's own export works as well as the template.
/// </summary>
internal static class TicketFileReader
{
    public const int HeaderRow = 1;

    public static XLWorkbook Load(IRemoteStreamContent file)
    {
        try
        {
            var buffer = new MemoryStream();
            using (var upload = file.GetStream())
            {
                upload.CopyTo(buffer);
            }

            buffer.Position = 0;
            return new XLWorkbook(buffer);
        }
        catch (Exception e)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.ImportInvalidFile, innerException: e);
        }
    }

    public static IXLWorksheet FirstSheet(XLWorkbook workbook) =>
        workbook.Worksheets.FirstOrDefault()
        ?? throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.ImportNoRows);

    /// <summary>Header text of every column up to the last one used on row 1 or below.</summary>
    public static List<string> Headers(IXLWorksheet sheet)
    {
        var last = sheet.LastColumnUsed()?.ColumnNumber() ?? 0;
        return Enumerable.Range(1, last)
            .Select(column => ExcelCells.Text(sheet.Cell(HeaderRow, column)) ?? string.Empty)
            .ToList();
    }

    /// <summary>The header's own text with the template's required mark taken off.</summary>
    public static string HeaderKey(string header) => ExcelCells.Key(header.TrimEnd('*', ' '));

    /// <summary>Rows below the header with something in at least one of <paramref name="columns"/>.</summary>
    public static IEnumerable<IXLRow> DataRows(IXLWorksheet sheet, IReadOnlyCollection<int> columns)
    {
        var last = sheet.LastRowUsed()?.RowNumber() ?? HeaderRow;
        for (var number = HeaderRow + 1; number <= last; number++)
        {
            var row = sheet.Row(number);
            if (columns.Any(column => ExcelCells.Text(row.Cell(column)) != null))
            {
                yield return row;
            }
        }
    }

    /// <summary>
    /// The mapped data rows. Refuses a mapping without Họ tên or Số điện thoại,
    /// or one pointing past the last column.
    /// </summary>
    public static List<TicketFileRow> Rows(IXLWorksheet sheet, TicketFileMappingDto mapping)
    {
        var columnCount = sheet.LastColumnUsed()?.ColumnNumber() ?? 0;
        bool Valid(int? column) => column is null || (column >= 1 && column <= columnCount);
        if (mapping.FullName is null || mapping.Phone is null
            || !Valid(mapping.FullName) || !Valid(mapping.Phone) || !Valid(mapping.Email) || !Valid(mapping.Note))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.ImportColumnMissing);
        }

        int[] mapped = [.. new[] { mapping.FullName, mapping.Phone, mapping.Email, mapping.Note }.OfType<int>().Distinct()];
        string? Read(IXLRow row, int? column) => column is { } c ? ExcelCells.Text(row.Cell(c)) : null;

        return DataRows(sheet, mapped)
            .Select(row => new TicketFileRow(
                row.RowNumber(),
                Read(row, mapping.FullName),
                Read(row, mapping.Phone),
                Read(row, mapping.Email),
                Read(row, mapping.Note)))
            .ToList();
    }

    public static byte[] Save(XLWorkbook workbook)
    {
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
