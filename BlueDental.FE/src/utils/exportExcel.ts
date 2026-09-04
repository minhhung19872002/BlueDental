import * as XLSX from "xlsx";

export interface ExportColumn<T extends object> {
  header: string;
  key: keyof T;
  /** Omit to write the raw value — numbers stay numeric cells Excel can sum. */
  format?: (v: unknown) => string;
}

export function exportToExcel<T extends object>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
) {
  const data = [
    columns.map((c) => c.header),
    ...rows.map((row) =>
      columns.map((c) => {
        const v = row[c.key];
        return c.format ? c.format(v) : (v ?? "");
      }),
    ),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = fitColumnWidths(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
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
