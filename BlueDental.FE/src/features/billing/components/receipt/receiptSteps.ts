import type { StepState, StepTrackItem } from "@/components/StepTrack";
import { t } from "@/lib/i18n";
import { formatClockSeconds } from "@/utils/format";
import { RECEIPT_STATUS, type PaymentReceiptDto } from "../../api/paymentReceiptApi";

/** The receipt page's six steps (P2610 mock), in order. */
const STEP_KEYS = [
  "Receipt:Step:Create",
  "Receipt:Step:SendToIpad",
  "Receipt:Step:CustomerReview",
  "Receipt:Step:CustomerSign",
  "Receipt:Step:AccountantReview",
  "Receipt:Step:Export",
] as const;

const EXPORT_STEP = STEP_KEYS.length - 1;
const NO_TIME = "—";

function stateOf(done: boolean, current: boolean): StepState {
  if (done) return "done";
  return current ? "current" : "todo";
}

/**
 * Where the receipt stands on its journey. Written ("Chưa thanh toán") it has
 * done step 1 and waits on "Gửi tới iPad". Exported or paid it has done all
 * six. A cancelled one keeps the steps it reached and waits on none.
 *
 * Only "Tạo phiếu thu" and "Xuất phiếu thu" carry a time for now: the iPad
 * steps between them are recorded once the iPad page exists (phase 4).
 */
export function receiptSteps(receipt: PaymentReceiptDto): StepTrackItem[] {
  const exported = receipt.issuedAt !== null;
  const waiting = receipt.status === RECEIPT_STATUS.Pending;
  const reached = exported ? STEP_KEYS.length : 1;
  return STEP_KEYS.map((key, index) => {
    const done = index < reached;
    const current = waiting && index === reached;
    let caption = NO_TIME;
    if (index === 0) caption = formatClockSeconds(receipt.creationTime);
    else if (index === EXPORT_STEP && receipt.issuedAt) caption = formatClockSeconds(receipt.issuedAt);
    else if (current) caption = t("Receipt:Step:InProgress");
    return { key, label: t(key), caption, state: stateOf(done, current) };
  });
}

