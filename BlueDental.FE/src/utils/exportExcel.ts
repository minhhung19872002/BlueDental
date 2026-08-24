import * as XLSX from "xlsx";

export function exportToExcel<T extends object>(
  rows: T[],
  columns: { header: string; key: keyof T; format?: (v: unknown) => string }[],
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
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
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
