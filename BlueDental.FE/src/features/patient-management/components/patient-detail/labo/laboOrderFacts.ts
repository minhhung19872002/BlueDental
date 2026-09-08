import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { formatDate, formatDateTime } from "@/utils/format";

export interface LaboDetailPatient {
  code: string;
  name: string;
  dateOfBirth: string | null;
}

/**
 * Every value the detail modal and the printed sheet read out, formatted once.
 * A missing value is "" here: the modal leaves the cell empty, as the reference
 * does, and the sheet turns it into a dash.
 */
export function laboOrderFacts(order: LaboOrderDto, patient: LaboDetailPatient) {
  return {
    dentist: order.dentistName ?? "",
    customer: `${patient.code} - ${patient.name}`,
    birthDate: formatDate(patient.dateOfBirth),
    supplier: order.supplierName ?? order.labProviderName,
    sentAt: formatDateTime(order.sentAt),
    dueDate: formatDate(order.dueDate),
    material: order.materialName ?? "",
    finishLine: order.finishLineName ?? "",
    bite: order.biteName ?? "",
    rhythm: order.rhythmName ?? "",
    instruction: order.workDescription ?? order.notes ?? "",
    treatmentService: order.treatmentServiceName ?? "",
    /**
     * "Loại phục hình" and the sheet's "Lựa chọn dịch vụ" both carry the labo
     * service the material belongs to: the reference showed one value under
     * both labels (docs/clone/unknowns.md).
     */
    laboService: order.laboServiceName ?? "",
    teeth: order.toothNumbers ?? "",
    shade: order.toothShade ?? "",
    quantity: String(order.quantity),
  };
}

export type LaboOrderFacts = ReturnType<typeof laboOrderFacts>;

/** The sheet's reading of a missing value. */
export const dashed = (value: string) => (value === "" ? "—" : value);
