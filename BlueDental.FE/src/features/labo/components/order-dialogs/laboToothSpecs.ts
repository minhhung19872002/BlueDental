import { orderedSurfaces, type ToothSurfaceCode } from "@/components/ToothSurfacePicker";
import { LABO_SPEC_MODE, type LaboOrderToothDto, type LaboSpecMode } from "@/features/labo/api/laboApi";
import type { LaboToothSpecInput } from "@/features/labo/api/laboMutations";
import { foldForSearch } from "@/utils/foldForSearch";

/** Màu / Đường hoàn tất of one Mặt răng while its tooth is "Riêng theo mặt". */
export interface LaboSurfaceValue {
  shade?: string;
  finishLineId?: string;
}

/** One tooth card of Thông số từng răng as the form holds it, or the "Tất cả" row. */
export interface LaboSpecValue {
  shade?: string;
  finishLineId?: string;
  rhythmId?: string;
  /** Mặt răng picked, in the tooth's order (R-1150). */
  surfaces?: ToothSurfaceCode[];
  /** "Riêng theo mặt" ticked; counts only on a tooth with two surfaces or more. */
  bySurface?: boolean;
  surfaceSpecs?: Partial<Record<ToothSurfaceCode, LaboSurfaceValue>>;
}

/** The form's cards: one per tooth, keyed by its FDI, and the "Tất cả" row under {@link SHARED_ROW}. */
export type LaboSpecRows = Record<string, LaboSpecValue>;

/** The "Tất cả" row; its old pictures went to the server as tooth 0 (P3110 G2). */
export const SHARED_ROW = "0";

export const toothLabel = (fdi: string | number) => `R${fdi}`;

/** Labo v2's default (the BA's mock opens on it): Đường hoàn tất / Kiểu nhịp shared, a Màu per tooth. */
export const DEFAULT_SPEC_MODE: LaboSpecMode = LABO_SPEC_MODE.SharedSpecOwnShade;

/** Thông số răng: Chung tất cả răng. */
export const sharesParams = (mode: LaboSpecMode) => mode !== LABO_SPEC_MODE.PerTooth;

/** Màu răng: Chung tất cả răng — only while Thông số răng is Chung. */
export const sharesShade = (mode: LaboSpecMode) => mode === LABO_SPEC_MODE.SharedAll;

/** The mode the two switches above the cards spell. */
export function specModeOf(sharedParams: boolean, sharedShade: boolean): LaboSpecMode {
  if (!sharedParams) return LABO_SPEC_MODE.PerTooth;
  return sharedShade ? LABO_SPEC_MODE.SharedAll : LABO_SPEC_MODE.SharedSpecOwnShade;
}

/** «Chung / Riêng theo mặt» is offered once a tooth has two surfaces, unless one Màu serves all teeth. */
export const canSplit = (mode: LaboSpecMode, value: LaboSpecValue | undefined) =>
  !sharesShade(mode) && (value?.surfaces?.length ?? 0) > 1;

export const isSplit = (mode: LaboSpecMode, value: LaboSpecValue | undefined) =>
  canSplit(mode, value) && value?.bySurface === true;

export const trimmed = (text: string | undefined | null) => text?.trim() || undefined;

/**
 * The payload's rows: every tooth its own row with the "Tất cả" values
 * copied in — the server reads a shared mode off the first tooth.
 */
export function specInputs(teeth: number[], mode: LaboSpecMode, rows: LaboSpecRows | undefined): LaboToothSpecInput[] {
  const shared = rows?.[SHARED_ROW];
  return teeth.map((fdi) => {
    const own = rows?.[String(fdi)];
    const params = sharesParams(mode) ? shared : own;
    const split = isSplit(mode, own);
    return {
      toothNumber: fdi,
      shade: trimmed(sharesShade(mode) ? shared?.shade : own?.shade),
      finishLineId: params?.finishLineId,
      rhythmId: params?.rhythmId,
      shadeBySurface: split,
      surfaces: orderedSurfaces(fdi, own?.surfaces ?? []).map((code) => {
        const surface = own?.surfaceSpecs?.[code];
        if (!split) return { code };
        return { code, shade: trimmed(surface?.shade), finishLineId: sharesParams(mode) ? undefined : surface?.finishLineId };
      }),
    };
  });
}

function savedSurfaceSpecs(tooth: LaboOrderToothDto): LaboSpecValue["surfaceSpecs"] {
  if (!tooth.shadeBySurface) return {};
  const specs: LaboSpecValue["surfaceSpecs"] = {};
  for (const surface of orderedSurfaces(tooth.toothNumber, (tooth.surfaces ?? []).map((s) => s.code))) {
    const saved = tooth.surfaces.find((s) => s.code === surface);
    specs[surface] = { shade: saved?.shade ?? "", finishLineId: saved?.finishLineId ?? undefined };
  }
  return specs;
}

/** A saved order's cards; its first tooth stands for the "Tất cả" row. */
export function savedSpecRows(teeth: LaboOrderToothDto[]): LaboSpecRows {
  const rows: LaboSpecRows = {};
  for (const tooth of teeth) {
    rows[String(tooth.toothNumber)] = {
      shade: tooth.shade ?? "",
      finishLineId: tooth.finishLineId ?? undefined,
      rhythmId: tooth.rhythmId ?? undefined,
      surfaces: orderedSurfaces(tooth.toothNumber, (tooth.surfaces ?? []).map((s) => s.code)),
      bySurface: tooth.shadeBySurface ?? false,
      surfaceSpecs: savedSurfaceSpecs(tooth),
    };
  }
  const first = teeth[0];
  if (first) {
    rows[SHARED_ROW] = {
      shade: first.shade ?? "",
      finishLineId: first.finishLineId ?? undefined,
      rhythmId: first.rhythmId ?? undefined,
    };
  }
  return rows;
}

/**
 * "cầu n đơn vị" beside Số lượng (m134): two or more teeth with a Kiểu nhịp
 * other than "Không có nhịp" (P3110 G10 — the catalog marks no rhythm as a
 * bridge, so the name decides).
 */
export function isBridge(teeth: string[], rows: LaboSpecRows | undefined, mode: LaboSpecMode, rhythmName: (id: string) => string) {
  if (teeth.length < 2) return false;
  const keys = sharesParams(mode) ? [SHARED_ROW] : teeth;
  return keys.some((key) => {
    const id = rows?.[key]?.rhythmId;
    return id !== undefined && !foldForSearch(rhythmName(id)).startsWith("khong");
  });
}

/** The Màu printed under each picked surface on the picture: the one that applies to it in the mode. */
export function pickerShades(fdi: string, mode: LaboSpecMode, rows: LaboSpecRows | undefined) {
  const own = rows?.[fdi];
  const shades: Partial<Record<ToothSurfaceCode, string>> = {};
  for (const code of own?.surfaces ?? []) {
    if (sharesShade(mode)) shades[code] = rows?.[SHARED_ROW]?.shade ?? "";
    else shades[code] = (isSplit(mode, own) ? own?.surfaceSpecs?.[code]?.shade : own?.shade) ?? "";
  }
  return shades;
}
