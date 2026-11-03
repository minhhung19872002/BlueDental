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
 * When the customer signed, and where: on the printout once "In phiếu thu"
 * was confirmed (P2910_02), else on the iPad session the steps still count.
 * Null until then — the accountant's step waits on it.
 */
export function customerSigned(
  receipt: PaymentReceiptDto,
  session: ReceiptSigningSessionDto | null,
): { at: string; paper: boolean } | null {
  if (receipt.paperSignedAt) return { at: receipt.paperSignedAt, paper: true };
  const signedAt = countedSession(session)?.signedAt;
  return signedAt ? { at: signedAt, paper: false } : null;
}

/** The iPad steps (2–4), one caption each, or one paper caption for all three. */
const IPAD_STEPS = 3;

function captionsOf(receipt: PaymentReceiptDto, session: ReceiptSigningSessionDto | null): (string | null)[] {
  const clock = (time: string | null | undefined) => (time ? formatClockSeconds(time) : null);
  const ipad = receipt.paperSignedAt
    ? Array<string>(IPAD_STEPS).fill(t("Receipt:Step:PaperSigned", formatClockSeconds(receipt.paperSignedAt)))
    : [clock(session?.sentAt), clock(session?.checkedAt), clock(session?.signedAt)];
  // The accountant checks and exports in one click, so both carry its time.
  return [clock(receipt.creationTime), ...ipad, clock(receipt.issuedAt), clock(receipt.issuedAt)];
}

/**
 * Where the receipt stands on its journey. Written ("Chưa thanh toán") it has
 * done step 1 and waits on "Gửi tới iPad"; each thing the customer does on the
 * iPad ticks the next step with its time. Printed for a hand signature
 * (P2910_02) the three iPad steps are done at once, captioned "Ký tay trên
 * giấy", and the accountant's step is next. Exported or paid it has done all
 * six. A cancelled one keeps the steps it reached and waits on none.
 */
export function receiptSteps(receipt: PaymentReceiptDto, signing: ReceiptSigningSessionDto | null): StepTrackItem[] {
  const captions = captionsOf(receipt, countedSession(signing));
  const exported = receipt.issuedAt !== null;
  const waiting = receipt.status === RECEIPT_STATUS.Pending;
  const reached = exported ? STEP_KEYS.length : 1 + captions.slice(1, 1 + IPAD_STEPS).filter(Boolean).length;
  return STEP_KEYS.map((key, index) => {
    const done = index < reached;
    const current = waiting && index === reached;
    let caption = captions[index] ?? NO_TIME;
    if (!captions[index] && current) caption = t("Receipt:Step:InProgress");
    return { key, label: t(key), caption, state: stateOf(done, current) };
  });
}
