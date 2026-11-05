import { t } from "@/lib/i18n";

/**
 * The Mặt răng codes the Labo reads (R-1150): Gần, Xa, then Cắn (front
 * teeth) or Nhai (back teeth), Ngoài or Má, and Trong — the server's
 * ToothSurfaces order.
 */
export type ToothSurfaceCode = "M" | "D" | "I" | "O" | "F" | "B" | "L";

/** Where a surface sits on the single-tooth picture. */
export type ToothSurfaceSlot = "top" | "bottom" | "left" | "right" | "center";

const ANTERIOR: readonly ToothSurfaceCode[] = ["M", "D", "I", "F", "L"];
const POSTERIOR: readonly ToothSurfaceCode[] = ["M", "D", "O", "B", "L"];

/** Răng cửa và răng nanh — FDI unit 1 to 3, permanent or deciduous. */
export const isAnteriorTooth = (fdi: number) => fdi % 10 >= 1 && fdi % 10 <= 3;

/** The five surfaces of the tooth, in the order they are listed and saved. */
export const surfacesOf = (fdi: number): readonly ToothSurfaceCode[] => (isAnteriorTooth(fdi) ? ANTERIOR : POSTERIOR);

/** "Gần", "Nhai"… */
export const surfaceName = (code: ToothSurfaceCode) => t(`Common:ToothSurface:${code}`);

const SLOTS: Record<ToothSurfaceCode, ToothSurfaceSlot> = {
  F: "top",
  B: "top",
  L: "bottom",
  M: "left",
  D: "right",
  I: "center",
  O: "center",
};

/** The BA's picture: the outer face on top, Trong below, Gần left, Xa right, the biting face in the middle. */
export const slotOf = (code: ToothSurfaceCode): ToothSurfaceSlot => SLOTS[code];

/** The picked codes the tooth has, in its own order, each once. */
export function orderedSurfaces(fdi: number, codes: readonly string[]): ToothSurfaceCode[] {
  return surfacesOf(fdi).filter((code) => codes.includes(code));
}

/** The surface added or taken off, the rest kept in order. */
export function toggledSurfaces(fdi: number, codes: readonly string[], code: ToothSurfaceCode): ToothSurfaceCode[] {
  const next = codes.includes(code) ? codes.filter((picked) => picked !== code) : [...codes, code];
  return orderedSurfaces(fdi, next);
}

/** "Gần, Xa" — the list beside the picture and in the summaries. */
export const surfaceList = (codes: readonly ToothSurfaceCode[]) => codes.map(surfaceName).join(", ");
