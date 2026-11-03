import { specGaps, specRows, type LaboSpecGap } from "./laboToothSpecs";
import { useLaboValue, type LaboOrderForm } from "./useLaboOrderForm";

export interface LaboSendGap {
  /** The teeth picked. */
  teeth: number;
  /** The first row still lacking Màu răng or Đường hoàn tất. */
  gap: LaboSpecGap | undefined;
  /** «Gửi Labo & in phiếu» stays grey until a tooth is picked and every row is complete (REQ-C9). */
  canSend: boolean;
}

/** What the Đặt hàng footer reads, live as the rows are filled in (P3110 m139). */
export function useLaboSendGap(form: LaboOrderForm): LaboSendGap {
  const teeth = useLaboValue(form.form, "teeth") ?? [];
  const shared = useLaboValue(form.form, "sharedSpec") ?? false;
  const specs = useLaboValue(form.form, "specs");
  const gap = specGaps(specRows(teeth, shared), specs)[0];
  return { teeth: teeth.length, gap, canSend: teeth.length > 0 && gap === undefined };
}
