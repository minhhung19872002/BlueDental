import { orderedSurfaces, surfaceList, surfaceName } from "@/components/ToothSurfacePicker";
import type { LaboOrderDto, LaboOrderToothDto, LaboOrderToothSurfaceDto } from "@/features/labo/api/laboApi";
import { formatDate } from "@/utils/format";
import { printedDoctorName } from "@/utils/printedDoctorName";

export interface LaboDetailPatient {
  code: string;
  name: string;
  dateOfBirth: string | null;
}

type ToothField = (tooth: LaboOrderToothDto) => string | null | undefined;
type SurfaceField = (surface: LaboOrderToothSurfaceDto) => string | null | undefined;

/**
 * One spec across the teeth (P3110 REQ-C7): the value itself when every tooth
 * carries the same one, else "R11 A1, R12 A2" — "; " between the teeth once a
 * value lists surfaces itself. An order sent before the per-tooth table has
 * no tooth values and keeps its order-level one.
 */
function perTooth(order: LaboOrderDto, field: ToothField, orderValue: string | null | undefined): string {
  const values = order.teeth.map((tooth) => ({ tooth: tooth.toothNumber, value: field(tooth)?.trim() ?? "" }));
  const filled = values.filter((entry) => entry.value !== "");
  if (filled.length === 0) return orderValue ?? "";
  if (filled.length === values.length && new Set(filled.map((entry) => entry.value)).size === 1) return filled[0].value;
  const separator = filled.some((entry) => entry.value.includes(",")) ? "; " : ", ";
  return filled.map((entry) => `R${entry.tooth} ${entry.value}`).join(separator);
}

const surfacesOfTooth = (tooth: LaboOrderToothDto) =>
  orderedSurfaces(tooth.toothNumber, (tooth.surfaces ?? []).map((surface) => surface.code));

/** A "Riêng theo mặt" tooth's value per surface ("Ngoài A1, Trong A2"), else the tooth's own (R-1150). */
function bySurface(tooth: LaboOrderToothDto, field: SurfaceField, own: string | null | undefined) {
  if (!tooth.shadeBySurface) return own;
  const parts = surfacesOfTooth(tooth).flatMap((code) => {
    const value = field(tooth.surfaces.find((surface) => surface.code === code) ?? { code })?.trim();
    return value ? [`${surfaceName(code)} ${value}`] : [];
  });
  return parts.length > 0 ? parts.join(", ") : own;
}

/**
 * Every value the detail modal and the printed sheet read out, formatted once.
 * A missing value is "" here: the modal leaves the cell empty, as the reference
 * does, and the sheet turns it into a dash.
 */
export function laboOrderFacts(order: LaboOrderDto, patient: LaboDetailPatient) {
  return {
    dentist: order.dentistName ?? "",
    /** The printed sheet names the doctor by their Chức danh. */
    printedDentist: printedDoctorName(order.dentistName, order.dentistJobTitle) ?? "",
    // The code stays on the printed sheet's own "Mã KH" line.
    customer: patient.name,
    birthDate: formatDate(patient.dateOfBirth),
    supplier: order.supplierName ?? order.labProviderName,
    // Days only: Giờ gửi / Giờ nhận are gone (P3110 REQ-C2).
    sentAt: formatDate(order.sentAt),
    dueAt: formatDate(order.dueAt),
    material: order.materialName ?? "",
    finishLine: perTooth(order, (tooth) => bySurface(tooth, (s) => s.finishLineName, tooth.finishLineName), order.finishLineName),
    // One Khớp cắn per order since R-1150; an older order kept one per tooth.
    bite: order.biteName ?? perTooth(order, (tooth) => tooth.biteName, null),
    rhythm: perTooth(order, (tooth) => tooth.rhythmName, order.rhythmName),
    instruction: order.workDescription ?? order.notes ?? "",
    note: order.notes ?? "",
    treatmentService: order.treatmentServiceName ?? "",
    /**
     * "Loại phục hình" and the sheet's "Lựa chọn dịch vụ" both carry the labo
     * service the material belongs to: the reference showed one value under
     * both labels (docs/clone/unknowns.md).
     */
    laboService: order.laboServiceName ?? "",
    teeth: order.toothNumbers ?? "",
    /** Mặt răng; "—" on an order sent before R-1150 picked surfaces (owner decision 6). */
    surfaces: perTooth(order, (tooth) => surfaceList(surfacesOfTooth(tooth)), null) || "—",
    shade: perTooth(order, (tooth) => bySurface(tooth, (s) => s.shade, tooth.shade), order.toothShade),
    /** Ghi chú cho Labo left the form in R-1150; an older order that has one still shows it. */
    labNote: perTooth(order, (tooth) => tooth.labNote, null),
    quantity: String(order.quantity),
  };
}

export type LaboOrderFacts = ReturnType<typeof laboOrderFacts>;

/** The sheet's reading of a missing value. */
export const dashed = (value: string) => (value === "" ? "—" : value);
