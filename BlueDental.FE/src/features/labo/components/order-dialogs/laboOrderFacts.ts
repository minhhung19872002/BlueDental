import type { LaboOrderDto, LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { formatDate } from "@/utils/format";
import { printedDoctorName } from "@/utils/printedDoctorName";

export interface LaboDetailPatient {
  code: string;
  name: string;
  dateOfBirth: string | null;
}

type ToothField = (tooth: LaboOrderToothDto) => string | null | undefined;

/**
 * One spec across the teeth (P3110 REQ-C7): the value itself when every tooth
 * carries the same one, else "R11 A1, R12 A2". An order sent before the
 * per-tooth table has no tooth values and keeps its order-level one.
 */
function perTooth(order: LaboOrderDto, field: ToothField, orderValue: string | null | undefined): string {
  const values = order.teeth.map((tooth) => ({ tooth: tooth.toothNumber, value: field(tooth)?.trim() ?? "" }));
  const filled = values.filter((entry) => entry.value !== "");
  if (filled.length === 0) return orderValue ?? "";
  if (filled.length === values.length && new Set(filled.map((entry) => entry.value)).size === 1) return filled[0].value;
  return filled.map((entry) => `R${entry.tooth} ${entry.value}`).join(", ");
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
    finishLine: perTooth(order, (tooth) => tooth.finishLineName, order.finishLineName),
    bite: perTooth(order, (tooth) => tooth.biteName, order.biteName),
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
    shade: perTooth(order, (tooth) => tooth.shade, order.toothShade),
    labNote: perTooth(order, (tooth) => tooth.labNote, null),
    quantity: String(order.quantity),
  };
}

export type LaboOrderFacts = ReturnType<typeof laboOrderFacts>;

/** The sheet's reading of a missing value. */
export const dashed = (value: string) => (value === "" ? "—" : value);
