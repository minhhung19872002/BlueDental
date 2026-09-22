import * as XLSX from "xlsx";

export interface ExportColumn<T extends object> {
  header: string;
  key: keyof T;
  /** Omit to write the raw value — numbers stay numeric cells Excel can sum. */
  format?: (v: unknown) => string;
}

export interface ExportOptions {
  /** Worksheet tab name; "Sheet1" when omitted. */
  sheetName?: string;
  /** A title merged across every column on row 1, followed by one blank row. */
  title?: string;
  /** A second merged row under the title (only written when `title` is set). */
  description?: string;
  /**
   * Column widths in characters (SheetJS `wch`), one per column; omit to size
   * each column to its longest cell. Use `excelColumnWidths` for widths read
   * off a workbook Excel itself wrote.
   */
  columnWidths?: number[];
}

/**
 * Excel stores a column width as its character count plus 5/6 of a character
 * of padding, so a `<col width="16">` reads back as wch 15.17. Subtracting the
 * padding here makes SheetJS write the same `width="16"` again.
 */
const EXCEL_WIDTH_PADDING = 5 / 6;

/** Convert widths taken from an Excel-authored workbook into `columnWidths`. */
export function excelColumnWidths(widths: number[]): number[] {
  return widths.map((w) => w - EXCEL_WIDTH_PADDING);
}

export function exportToExcel<T extends object>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  options: ExportOptions = {},
) {
  const body = [
    columns.map((c) => c.header),
    ...rows.map((row) =>
      columns.map((c) => {
        const v = row[c.key];
        return c.format ? c.format(v) : (v ?? "");
      }),
    ),
  ];

  const headRows: unknown[][] = [];
  if (options.title) {
    headRows.push([options.title]);
    if (options.description) headRows.push([options.description]);
    headRows.push([]);
  }
  const data = [...headRows, ...body];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = options.columnWidths?.map((wch) => ({ wch })) ?? fitColumnWidths(body);
  const lastColumn = columns.length - 1;
  const merges = headRows
    .map((row, r) => (row.length ? { s: { r, c: 0 }, e: { r, c: lastColumn } } : null))
    .filter((m): m is XLSX.Range => m !== null);
  if (merges.length) ws["!merges"] = merges;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, options.sheetName ?? "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

const MIN_COLUMN_CHARS = 10;
const MAX_COLUMN_CHARS = 60;
/** Excel's default font is a touch wider than one character per unit. */
const CHAR_PADDING = 2;

/**
 * Size each column to its longest cell (header included), like the reference's
 * workbooks, so dates and names are readable without the user dragging borders.
 * Capped so a long note does not turn one column into a full screen.
 */
function fitColumnWidths(rows: unknown[][]): XLSX.ColInfo[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = String(cell ?? "").length;
      widths[i] = Math.max(widths[i] ?? 0, len);
    });
  }
  return widths.map((len) => ({
    wch: Math.min(MAX_COLUMN_CHARS, Math.max(MIN_COLUMN_CHARS, len + CHAR_PADDING)),
  }));
}

/** An Ant Design column, reduced to what an export needs. */
interface TableColumnLike {
  title?: unknown;
  dataIndex?: string | number | readonly (string | number)[];
}

/**
 * Export the rows of an Ant Design table using its own column definitions.
 *
 * Columns without a dataIndex are rendered from other columns, so they carry no
 * value of their own and are skipped. The raw field is written rather than the
 * cell's rendered node, which is what a spreadsheet wants anyway.
 */
export function exportTableToExcel<T extends object>(
  rows: T[],
  columns: readonly TableColumnLike[],
  filename: string,
) {
  const exportable = columns.filter(
    (c): c is TableColumnLike & { dataIndex: string; title: string } =>
      typeof c.dataIndex === "string" && typeof c.title === "string",
  );

  exportToExcel(
    rows,
    exportable.map((c) => ({
      header: c.title,
      key: c.dataIndex as keyof T,
    })),
    filename,
  );
}
