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
