import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { matchesSearch } from "@/utils/foldForSearch";
import type { RxDiagnosisRow } from "../types/prescription";

/** "R36, R37" — the teeth of one picked diagnosis. */
export function teethLabel(toothCodes: number[]): string {
  return toothCodes.map((code) => t("Treatment:Rx:ToothShort", code)).join(", ");
}

/** "DT03 – Viêm tủy răng (R36); DT01 – Sâu ngà" — what the printed slip carries. */
export function printedDiagnosisText(rows: RxDiagnosisRow[]): string {
  return rows
    .map((row) => {
      const head = `${row.planCode} – ${row.diagnosisName}`;
      return row.toothCodes.length > 0 ? `${head} (${teethLabel(row.toothCodes)})` : head;
    })
    .join("; ");
}

/** " (R11, R12)" — the teeth suffix older slips stored in their printed text. */
const STORED_TEETH = /\s*\(R\d+(?:,\s*R\d+)*\)/g;

/**
 * "DT03 – Viêm tủy răng; DT01 – Sâu ngà" — the ĐƠN THUỐC's Chẩn đoán since
 * R-1300: the names only, no teeth. A slip saved before F-58 has no picked
 * rows, so its stored text is used with any teeth suffix taken off.
 */
export function printedDiagnosisNames(
  rows: readonly { planCode: string; diagnosisName: string; sortOrder: number }[],
  storedText: string | null,
): string {
  if (rows.length === 0) return (storedText ?? "").replace(STORED_TEETH, "").trim();
  return [...rows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => `${row.planCode} – ${row.diagnosisName}`)
    .join("; ");
}

/** "DT03 – " — the phiếu điều trị code older slips stored ahead of each name. */
const STORED_PLAN_CODE = /^[A-Z]+\d+\s+–\s+/;

/**
 * "Viêm tủy răng; Sâu ngà" — the Đơn thuốc list's Chẩn đoán (R-1320): the
 * names only, no slip code and no teeth, each pick shown even when two share
 * a name. A slip with no picked rows falls back to its stored text, each part
 * stripped of its code and teeth.
 */
export function listedDiagnosisNames(
  rows: readonly { diagnosisName: string; sortOrder: number }[],
  storedText: string | null,
): string {
  if (rows.length > 0) {
    return [...rows]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => row.diagnosisName)
      .join("; ");
  }
  return (storedText ?? "")
    .replace(STORED_TEETH, "")
    .split(";")
    .map((part) => part.trim().replace(STORED_PLAN_CODE, ""))
    .filter(Boolean)
    .join("; ");
}

/**
 * "Ghi chú chẩn đoán" filled from the picked diagnoses' own notes: each
 * different note on its own line, a note repeated across picks only once.
 * From two notes on, each line starts with "- " so a note that wraps in the
 * box still reads as one; a single note stays bare (R-825).
 */
export function mergedNotes(rows: RxDiagnosisRow[]): string {
  const notes = [
    ...new Set(rows.flatMap((row) => row.notes.map((note) => note.trim())).filter(Boolean)),
  ];
  if (notes.length < 2) return notes.join("");
  return notes.map((note) => `- ${note}`).join("\n");
}

/** The picker's local filter: slip number, diagnosis name or a tooth number. */
export function matchesSlipFilter(row: RxDiagnosisRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return (
    row.planCode.toLocaleLowerCase().includes(needle) ||
    matchesSearch(row.diagnosisName, needle) ||
    row.toothCodes.some((code) => String(code).includes(needle))
  );
}

/** One "Buổi điều trị" of the picker: the diagnoses of the phiếu opened that day. */
export interface RxSessionGroup {
  /** "08/10/2026"; empty for a row without a date. */
  day: string;
  isToday: boolean;
  rows: RxDiagnosisRow[];
}

/** The picker's rows grouped by the day their phiếu was opened, keeping the newest-first order. */
export function groupBySession(rows: RxDiagnosisRow[], today: Date = new Date()): RxSessionGroup[] {
  const todayLabel = formatDate(today);
  const groups = new Map<string, RxDiagnosisRow[]>();
  for (const row of rows) {
    const day = formatDate(row.planDate);
    const group = groups.get(day);
    if (group) group.push(row);
    else groups.set(day, [row]);
  }
  return [...groups].map(([day, groupRows]) => ({
    day,
    isToday: day === todayLabel,
    rows: groupRows,
  }));
}
