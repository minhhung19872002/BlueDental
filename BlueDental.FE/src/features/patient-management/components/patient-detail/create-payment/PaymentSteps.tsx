import { StepTrack, type StepState } from "@/components/StepTrack";
import { t } from "@/lib/i18n";

interface Props {
  slipChosen: boolean;
  serviceChosen: boolean;
}

/**
 * The dialog's two steps, then the receipt's journey once saved: Tạo phiếu
 * thu → Khách kiểm tra → Khách đồng ý & ký → Kế toán kiểm tra → Xuất phiếu thu
 * (P2610, owner pick B). The receipt page tracks the journey itself.
 */
const STEP_KEYS = [
  "Patient:Payment:StepSlip",
  "Patient:Payment:StepServices",
  "Receipt:Step:Create",
  "Receipt:Step:CustomerReview",
  "Receipt:Step:CustomerSign",
  "Receipt:Step:AccountantReview",
  "Receipt:Step:Export",
] as const;

function stateOf(done: boolean, current: boolean): StepState {
  if (done) return "done";
  return current ? "current" : "todo";
}

/** ① Chọn số phiếu → ② Chọn dịch vụ → ③ Tạo phiếu thu → …; a done step shows ✓. */
export function PaymentSteps({ slipChosen, serviceChosen }: Props) {
  const done = STEP_KEYS.map((_, index) => [slipChosen, slipChosen && serviceChosen][index] ?? false);
  const current = done.indexOf(false);
  const items = STEP_KEYS.map((key, index) => ({
    key,
    label: t(key),
    state: stateOf(done[index], index === current),
  }));
  return <StepTrack className="pd-newpay-steps" items={items} label={t("Receipt:Step:Label")} />;
}
