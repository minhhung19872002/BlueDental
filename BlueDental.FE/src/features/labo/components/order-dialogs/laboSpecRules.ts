import { surfaceList, surfaceName, type ToothSurfaceCode } from "@/components/ToothSurfacePicker";
import { t } from "@/lib/i18n";
import { LABO_SPEC_MODE, type LaboSpecMode } from "@/features/labo/api/laboApi";
import {
  isSplit,
  SHARED_ROW,
  sharesParams,
  sharesShade,
  toothLabel,
  trimmed,
  type LaboSpecRows,
  type LaboSpecValue,
} from "./laboToothSpecs";

/** One thing «Tạo phiếu Labo» still waits for, worded as the footer lists it. */
export interface LaboSpecError {
  /** The card it sits on: a tooth's FDI or {@link SHARED_ROW}. */
  row: string;
  kind: "surfaces" | "shade";
  /** Set when one surface of a "Riêng theo mặt" tooth lacks its Màu. */
  surface?: ToothSurfaceCode;
  message: string;
}

/** The names the summaries print for the picked catalog ids. */
export interface LaboSpecNames {
  finishLine: (id: string | undefined) => string | undefined;
  rhythm: (id: string | undefined) => string | undefined;
}

function shadeErrors(fdi: string, own: LaboSpecValue | undefined, mode: LaboSpecMode): LaboSpecError[] {
  const label = toothLabel(fdi);
  if (!isSplit(mode, own)) {
    return trimmed(own?.shade) ? [] : [{ row: fdi, kind: "shade", message: t("Labo:Spec:ErrShade", label) }];
  }
  return (own?.surfaces ?? [])
    .filter((code) => !trimmed(own?.surfaceSpecs?.[code]?.shade))
    .map((code) => ({
      row: fdi,
      kind: "shade",
      surface: code,
      message: t("Labo:Spec:ErrSurfaceShade", label, surfaceName(code).toLowerCase()),
    }));
}

/**
 * What the order still lacks, in the mock's order: teeth without a Mặt
 * răng, then the shared Màu, then each tooth's Màu (or each surface's).
 * Đường hoàn tất is never required (owner, R-1150 "bỏ required").
 */
export function specErrors(teeth: string[], mode: LaboSpecMode, rows: LaboSpecRows | undefined): LaboSpecError[] {
  const errors: LaboSpecError[] = teeth
    .filter((fdi) => (rows?.[fdi]?.surfaces?.length ?? 0) === 0)
    .map((fdi) => ({ row: fdi, kind: "surfaces", message: t("Labo:Spec:ErrNoSurface", toothLabel(fdi)) }));
  if (teeth.length === 0) return errors;
  if (sharesShade(mode)) {
    if (!trimmed(rows?.[SHARED_ROW]?.shade)) {
      errors.push({ row: SHARED_ROW, kind: "shade", message: t("Labo:Spec:ErrSharedShade") });
    }
    return errors;
  }
  return [...errors, ...teeth.flatMap((fdi) => shadeErrors(fdi, rows?.[fdi], mode))];
}

const finishText = (name: string | undefined) => name ?? t("Labo:Spec:SumFinishNone");
const rhythmText = (name: string | undefined) => (name ? t("Labo:Spec:SumRhythm", name) : t("Labo:Spec:SumRhythmNone"));
const shadeText = (shade: string | undefined) => t("Labo:Spec:SumShade", trimmed(shade) ?? "—");

/** The "Tất cả" card's header line: Màu · Đường hoàn tất · Nhịp. */
export function sharedSummary(mode: LaboSpecMode, rows: LaboSpecRows | undefined, names: LaboSpecNames): string {
  const shared = rows?.[SHARED_ROW];
  return [
    sharesShade(mode) ? shadeText(shared?.shade) : t("Labo:Spec:SumShadeEach"),
    finishText(names.finishLine(shared?.finishLineId)),
    rhythmText(names.rhythm(shared?.rhythmId)),
  ].join(" · ");
}

/** A tooth card's header line: Mặt … · Màu … · Đường hoàn tất · Nhịp, from the values that apply to it. */
export function toothSummary(fdi: string, mode: LaboSpecMode, rows: LaboSpecRows | undefined, names: LaboSpecNames): string {
  const own = rows?.[fdi];
  const shared = rows?.[SHARED_ROW];
  const surfaces = own?.surfaces ?? [];
  const split = isSplit(mode, own);
  const params = sharesParams(mode) ? shared : own;
  const listed = t("Labo:Spec:SumSurfaces", surfaceList(surfaces) || "—");
  const parts = [split ? t("Labo:Spec:SumSplit", listed) : listed];
  parts.push(
    split
      ? surfaces.map((code) => `${surfaceName(code)} ${trimmed(own?.surfaceSpecs?.[code]?.shade) ?? "—"}`).join(", ")
      : shadeText(sharesShade(mode) ? shared?.shade : own?.shade),
  );
  // A PerTooth tooth split by surface keeps a Đường hoàn tất on each surface, listed in its rows.
  if (!(split && mode === LABO_SPEC_MODE.PerTooth)) parts.push(finishText(names.finishLine(params?.finishLineId)));
  parts.push(rhythmText(names.rhythm(params?.rhythmId)));
  return parts.join(" · ");
}

const CASE_LABEL: Record<LaboSpecMode, string> = {
  [LABO_SPEC_MODE.SharedAll]: "Labo:Spec:CaseSharedAll",
  [LABO_SPEC_MODE.SharedSpecOwnShade]: "Labo:Spec:CaseSharedSpec",
  [LABO_SPEC_MODE.PerTooth]: "Labo:Spec:CasePerTooth",
};

/** The footer's first line: "Chung thông số · riêng màu — R11 2 mặt · R12 3 mặt riêng". */
export function orderSummary(teeth: string[], mode: LaboSpecMode, rows: LaboSpecRows | undefined): string {
  const counts = teeth.map((fdi) => {
    const own = rows?.[fdi];
    const key = isSplit(mode, own) ? "Labo:Spec:ToothSurfaceCountSplit" : "Labo:Spec:ToothSurfaceCount";
    return t(key, toothLabel(fdi), own?.surfaces?.length ?? 0);
  });
  return `${t(CASE_LABEL[mode])} — ${counts.join(" · ")}`;
}

