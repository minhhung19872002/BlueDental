import type { StepState, StepTrackItem } from "@/components/StepTrack";
import { t } from "@/lib/i18n";
import { formatClockSeconds } from "@/utils/format";
import { RECEIPT_STATUS, type PaymentReceiptDto } from "../../api/paymentReceiptApi";
import { SIGNING_CLOSE_REASON, type ReceiptSigningSessionDto } from "../../api/receiptSigningApi";

/** The receipt page's six steps (P2610 mock), in order. */
const STEP_KEYS = [
  "Receipt:Step:Create",
  "Receipt:Step:SendToIpad",
  "Receipt:Step:CustomerReview",
  "Receipt:Step:CustomerSign",
  "Receipt:Step:AccountantReview",
  "Receipt:Step:Export",
] as const;

const NO_TIME = "—";

function stateOf(done: boolean, current: boolean): StepState {
  if (done) return "done";
  return current ? "current" : "todo";
}

/**
 * The iPad session the steps still count. One the cashier ended (Hủy phiên,
 * an edit, another receipt sent in its place) starts the customer over; the
 * one the export or the cancel closed keeps what was done.
 */
export function countedSession(session: ReceiptSigningSessionDto | null): ReceiptSigningSessionDto | null {
  if (!session) return null;
  if (session.isOpen) return session;
  const kept = session.closeReason === SIGNING_CLOSE_REASON.Issued
    || session.closeReason === SIGNING_CLOSE_REASON.ReceiptCancelled;
  return kept ? session : null;
}

/**
 * Where the receipt stands on its journey. Written ("Chưa thanh toán") it has
 * done step 1 and waits on "Gửi tới iPad"; each thing the customer does on the
 * iPad ticks the next step with its time. Exported or paid it has done all
 * six. A cancelled one keeps the steps it reached and waits on none.
 */
export function receiptSteps(receipt: PaymentReceiptDto, signing: ReceiptSigningSessionDto | null): StepTrackItem[] {
  const session = countedSession(signing);
  const times: (string | null | undefined)[] = [
    receipt.creationTime,
    session?.sentAt,
    session?.checkedAt,
    session?.signedAt,
    // The accountant checks and exports in one click, so both carry its time.
    receipt.issuedAt,
    receipt.issuedAt,
  ];
  const exported = receipt.issuedAt !== null;
  const waiting = receipt.status === RECEIPT_STATUS.Pending;
  const reached = exported ? STEP_KEYS.length : 1 + times.slice(1, 4).filter(Boolean).length;
  return STEP_KEYS.map((key, index) => {
    const done = index < reached;
    const current = waiting && index === reached;
    const time = times[index];
    let caption = NO_TIME;
    if (time) caption = formatClockSeconds(time);
    else if (current) caption = t("Receipt:Step:InProgress");
    return { key, label: t(key), caption, state: stateOf(done, current) };
  });
}
