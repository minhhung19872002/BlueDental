import { orderedSurfaces, surfaceList, surfaceName, type ToothSurfaceCode } from "@/components/ToothSurfacePicker";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";

/** The Mặt răng the tooth was ordered on, in the tooth's order; none on an order made before R-1150. */
export const orderedFaces = (tooth: LaboOrderToothDto): ToothSurfaceCode[] =>
  orderedSurfaces(
    tooth.toothNumber,
    (tooth.surfaces ?? []).map((surface) => surface.code),
  );

/** A surface's Màu: its own on a "Riêng theo mặt" tooth, else the tooth's. */
function shadeOf(tooth: LaboOrderToothDto, code: ToothSurfaceCode): string {
  const own = tooth.shadeBySurface ? tooth.surfaces.find((surface) => surface.code === code)?.shade : tooth.shade;
  return own?.trim() ?? "";
}

/** The Màu under each ordered face on the fault picture. */
export function faceShades(tooth: LaboOrderToothDto): Partial<Record<ToothSurfaceCode, string>> {
  return Object.fromEntries(orderedFaces(tooth).map((code) => [code, shadeOf(tooth, code)]));
}

/** The row's spec: "Gần A2 · Xa A2 · Cắn A1"; an order made before R-1150 shows its Màu alone. */
export function surfaceLine(tooth: LaboOrderToothDto): string {
  const faces = orderedFaces(tooth);
  if (faces.length === 0) return tooth.shade?.trim() || "—";
  return faces.map((code) => [surfaceName(code), shadeOf(tooth, code)].filter(Boolean).join(" ")).join(" · ");
}

/** "Gần, Xa": Mặt bị lỗi in the tooth's order, "" when none. */
export const faultLine = (toothNumber: number, codes: readonly string[] | null | undefined) =>
  surfaceList(orderedSurfaces(toothNumber, codes ?? []));
