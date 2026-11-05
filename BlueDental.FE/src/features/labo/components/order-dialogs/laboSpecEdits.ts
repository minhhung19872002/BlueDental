import { orderedSurfaces, surfacesOf, type ToothSurfaceCode } from "@/components/ToothSurfacePicker";
import type { LaboSpecMode } from "@/features/labo/api/laboApi";
import {
  isSplit,
  SHARED_ROW,
  sharesParams,
  sharesShade,
  trimmed,
  type LaboSpecRows,
  type LaboSpecValue,
} from "./laboToothSpecs";

const orBlank = (value: string | undefined, fallback: string | undefined) => trimmed(value) ?? fallback;

/**
 * The cards once a Chung / Riêng switch flips, nothing typed lost: a value
 * shared until now fills the teeth's blanks, and a value about to be shared
 * takes the first tooth's when it is blank (Labo v2 mock, pmRieng / cmRieng).
 */
export function switchedRows(rows: LaboSpecRows | undefined, teeth: string[], from: LaboSpecMode, to: LaboSpecMode): LaboSpecRows {
  const next: LaboSpecRows = { ...rows };
  const shared = { ...next[SHARED_ROW] };
  const first = teeth.length > 0 ? next[teeth[0]] : undefined;
  for (const fdi of teeth) {
    const own = { ...next[fdi] };
    if (sharesParams(from) && !sharesParams(to)) {
      own.finishLineId ??= shared.finishLineId;
      own.rhythmId ??= shared.rhythmId;
    }
    if (sharesShade(from) && !sharesShade(to)) own.shade = orBlank(own.shade, shared.shade);
    next[fdi] = own;
  }
  if (!sharesParams(from) && sharesParams(to)) {
    shared.finishLineId ??= first?.finishLineId;
    shared.rhythmId ??= first?.rhythmId;
  }
  if (!sharesShade(from) && sharesShade(to)) shared.shade = orBlank(shared.shade, first?.shade);
  next[SHARED_ROW] = shared;
  return next;
}

/** A surface clicked on the picture, and the surface the card works on next. */
export interface LaboSurfacePick {
  value: LaboSpecValue;
  active: ToothSurfaceCode | undefined;
}

/** The tooth without one surface; the last one left hands its Màu to the tooth when the tooth has none. */
export function withoutSurface(fdi: number, value: LaboSpecValue, code: ToothSurfaceCode): LaboSpecValue {
  const surfaces = (value.surfaces ?? []).filter((picked) => picked !== code);
  const last = surfaces.length === 1 ? value.surfaceSpecs?.[surfaces[0]] : undefined;
  return {
    ...value,
    surfaces: orderedSurfaces(fdi, surfaces),
    shade: orBlank(value.shade, last?.shade),
    finishLineId: value.finishLineId ?? last?.finishLineId,
  };
}

/**
 * A click on the picture (mock addSurf / setActive / delSurf): an unpicked
 * surface joins — with the tooth's Màu and Đường hoàn tất when it has none
 * of its own yet — and becomes the one worked on; a picked one becomes the
 * one worked on while the tooth is "Riêng theo mặt", else it is taken off.
 */
export function pickedSurface(fdi: number, value: LaboSpecValue | undefined, code: ToothSurfaceCode, mode: LaboSpecMode): LaboSurfacePick {
  const own = value ?? {};
  const surfaces = own.surfaces ?? [];
  if (surfaces.includes(code)) {
    if (isSplit(mode, own)) return { value: own, active: code };
    return { value: withoutSurface(fdi, own, code), active: undefined };
  }
  const surfaceSpecs = { ...own.surfaceSpecs };
  surfaceSpecs[code] ??= { shade: own.shade ?? "", finishLineId: own.finishLineId };
  return { value: { ...own, surfaces: orderedSurfaces(fdi, [...surfaces, code]), surfaceSpecs }, active: code };
}

/**
 * The tooth picture clicked (BA, R-1150): every surface of the tooth picked,
 * each new one starting from the tooth's Màu like a face clicked; with all
 * of them on already, all come off and the tooth keeps a Màu as when the last
 * one is taken off.
 */
export function pickedAllSurfaces(fdi: number, value: LaboSpecValue | undefined): LaboSpecValue {
  const own = value ?? {};
  const all = surfacesOf(fdi);
  const picked = own.surfaces ?? [];
  if (all.every((code) => picked.includes(code))) {
    const first = own.surfaceSpecs?.[picked[0]];
    return { ...own, surfaces: [], shade: orBlank(own.shade, first?.shade), finishLineId: own.finishLineId ?? first?.finishLineId };
  }
  const surfaceSpecs = { ...own.surfaceSpecs };
  for (const code of all) surfaceSpecs[code] ??= { shade: own.shade ?? "", finishLineId: own.finishLineId };
  return { ...own, surfaces: [...all], surfaceSpecs };
}

/** «Riêng theo mặt» on: each surface starts from its own value, else the tooth's, else the "Tất cả" row's. */
export function splitBySurface(value: LaboSpecValue, shared: LaboSpecValue | undefined): LaboSpecValue {
  const surfaceSpecs = { ...value.surfaceSpecs };
  for (const code of value.surfaces ?? []) {
    const current = surfaceSpecs[code];
    surfaceSpecs[code] = {
      shade: orBlank(current?.shade, orBlank(value.shade, shared?.shade)) ?? "",
      finishLineId: current?.finishLineId ?? value.finishLineId ?? shared?.finishLineId,
    };
  }
  return { ...value, bySurface: true, surfaceSpecs };
}

/** «Chung» again: the tooth keeps its own Màu, or takes its first surface's when it has none. */
export function joinSurfaces(value: LaboSpecValue): LaboSpecValue {
  const first = value.surfaces?.[0];
  const surface = first ? value.surfaceSpecs?.[first] : undefined;
  return {
    ...value,
    bySurface: false,
    shade: orBlank(value.shade, surface?.shade),
    finishLineId: value.finishLineId ?? surface?.finishLineId,
  };
}
