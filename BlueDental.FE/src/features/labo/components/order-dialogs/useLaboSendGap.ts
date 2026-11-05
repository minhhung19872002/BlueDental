import { DEFAULT_SPEC_MODE } from "./laboToothSpecs";
import { orderSummary, specErrors, type LaboSpecError } from "./laboSpecRules";
import { useLaboValue, type LaboOrderForm } from "./useLaboOrderForm";

export interface LaboSendGap {
  /** The teeth picked. */
  teeth: number;
  /** Everything «Tạo phiếu Labo» still waits for, in the order the footer lists it. */
  errors: LaboSpecError[];
  /** "Chung thông số · riêng màu — R11 2 mặt · R12 3 mặt riêng". */
  summary: string;
  /** «Tạo phiếu Labo» stays grey until a tooth is picked and nothing is missing (REQ-C9). */
  canSend: boolean;
}

/** What the Đặt hàng footer reads, live as the cards are filled in (Labo v2, R-1150). */
export function useLaboSendGap(form: LaboOrderForm): LaboSendGap {
  const teeth = useLaboValue(form.form, "teeth") ?? [];
  const mode = useLaboValue(form.form, "specMode") ?? DEFAULT_SPEC_MODE;
  const specs = useLaboValue(form.form, "specs");
  const errors = specErrors(teeth, mode, specs);
  return {
    teeth: teeth.length,
    errors,
    summary: teeth.length > 0 ? orderSummary(teeth, mode, specs) : "",
    canSend: teeth.length > 0 && errors.length === 0,
  };
}
