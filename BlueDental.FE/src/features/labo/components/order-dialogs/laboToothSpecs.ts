import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import type { LaboToothSpecInput } from "@/features/labo/api/laboMutations";
import { foldForSearch } from "@/utils/foldForSearch";

/** One row of Thông số từng răng as the form holds it. */
export interface LaboSpecValue {
  shade?: string;
  finishLineId?: string;
  rhythmId?: string;
  biteId?: string;
  labNote?: string;
}

/** The form's rows: one per tooth, keyed by its FDI, and the "Dùng chung" row under {@link SHARED_ROW}. */
export type LaboSpecRows = Record<string, LaboSpecValue>;

/** The "Dùng chung" row; its pictures go to the server as tooth 0 (P3110 G2). */
export const SHARED_ROW = "0";

export interface LaboSpecRow {
  key: string;
  /** "R11", or "R11, R12, R13" for the shared row. */
  label: string;
}

export const toothLabel = (fdi: string | number) => `R${fdi}`;

/** The rows the table shows: the one shared row, or one per tooth. */
export function specRows(teeth: string[], shared: boolean): LaboSpecRow[] {
  if (shared) return teeth.length === 0 ? [] : [{ key: SHARED_ROW, label: teeth.map(toothLabel).join(", ") }];
  return teeth.map((fdi) => ({ key: fdi, label: toothLabel(fdi) }));
}

/** What a row still lacks before the order may go to the Labo — Màu răng and Đường hoàn tất. */
export interface LaboSpecGap {
  label: string;
  shade: boolean;
  finishLine: boolean;
}

function gapOf(row: LaboSpecRow, value: LaboSpecValue | undefined): LaboSpecGap | null {
  const shade = !value?.shade?.trim();
  const finishLine = !value?.finishLineId;
  return shade || finishLine ? { label: row.label, shade, finishLine } : null;
}

/** Every row still incomplete, in table order. */
export function specGaps(rows: LaboSpecRow[], values: LaboSpecRows | undefined): LaboSpecGap[] {
  return rows.map((row) => gapOf(row, values?.[row.key])).filter((gap): gap is LaboSpecGap => gap !== null);
}

/** "R13 chưa chọn đường hoàn tất." — the footer's wording of the first gap. */
export function gapMessageKey(gap: LaboSpecGap): string {
  if (gap.shade && gap.finishLine) return "Labo:Spec:MissingBoth";
  return gap.shade ? "Labo:Spec:MissingShade" : "Labo:Spec:MissingFinishLine";
}

const trimmed = (text: string | undefined) => text?.trim() || undefined;

/** The payload's rows: every tooth its own row, the shared one copied onto each in shared mode. */
export function specInputs(teeth: number[], rows: LaboSpecRows | undefined, shared: boolean): LaboToothSpecInput[] {
  return teeth.map((fdi) => {
    const value = rows?.[shared ? SHARED_ROW : String(fdi)];
    return {
      toothNumber: fdi,
      shade: trimmed(value?.shade),
      finishLineId: value?.finishLineId,
      rhythmId: value?.rhythmId,
      biteId: value?.biteId,
      labNote: trimmed(value?.labNote),
    };
  });
}

/** A saved order's rows; a shared order's first tooth stands for the shared row. */
export function savedSpecRows(teeth: LaboOrderToothDto[], shared: boolean): LaboSpecRows {
  const rows: LaboSpecRows = {};
  for (const tooth of teeth) {
    rows[String(tooth.toothNumber)] = {
      shade: tooth.shade ?? "",
      finishLineId: tooth.finishLineId ?? undefined,
      rhythmId: tooth.rhythmId ?? undefined,
      biteId: tooth.biteId ?? undefined,
      labNote: tooth.labNote ?? "",
    };
  }
  if (shared && teeth.length > 0) rows[SHARED_ROW] = { ...rows[String(teeth[0].toothNumber)] };
  return rows;
}

/**
 * "Bỏ chọn «Dùng chung» để chỉnh riêng từng răng – giá trị chung được điền sẵn
 * vào mỗi dòng" (m154). Ticking it again starts the shared row from the first tooth.
 */
export function toggledSpecRows(rows: LaboSpecRows | undefined, teeth: string[], shared: boolean): LaboSpecRows {
  const next = { ...rows };
  if (shared) {
    next[SHARED_ROW] = { ...(teeth.length > 0 ? rows?.[teeth[0]] : undefined) };
  } else {
    for (const fdi of teeth) next[fdi] = { ...rows?.[SHARED_ROW] };
  }
  return next;
}

/**
 * "cầu n đơn vị" beside Số lượng (m134): two or more teeth with a Kiểu nhịp
 * other than "Không có nhịp" on any row (P3110 G10 — the catalog marks no
 * rhythm as a bridge, so the name decides).
 */
export function isBridge(teeth: string[], rows: LaboSpecRows | undefined, shared: boolean, rhythmName: (id: string) => string) {
  if (teeth.length < 2) return false;
  const keys = shared ? [SHARED_ROW] : teeth;
  return keys.some((key) => {
    const id = rows?.[key]?.rhythmId;
    return id !== undefined && !foldForSearch(rhythmName(id)).startsWith("khong");
  });
}
