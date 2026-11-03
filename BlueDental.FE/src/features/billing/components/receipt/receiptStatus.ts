import { t } from "@/lib/i18n";
import {
  RECEIPT_CANCEL_REASON,
  RECEIPT_STATUS,
  type ReceiptCancelReason,
  type ReceiptStatus,
} from "../../api/paymentReceiptApi";

/**
 * The receipt's tone and pill words, by status — the words the plan's
 * Thanh toán tab uses. The tone names the pill's and the panel's modifier.
 */
export const RECEIPT_STATUS_VIEWS: Record<ReceiptStatus, { tone: string; label: string }> = {
  [RECEIPT_STATUS.Pending]: { tone: "pending", label: "Treatment:Payment:Pending" },
  [RECEIPT_STATUS.Issued]: { tone: "issued", label: "Treatment:Payment:Issued" },
  [RECEIPT_STATUS.Completed]: { tone: "done", label: "Treatment:Payment:Completed" },
  [RECEIPT_STATUS.Cancelled]: { tone: "cancelled", label: "Treatment:Payment:Cancelled" },
};

/**
 * Hủy phiếu thu at every step (BA 27/10): waiting, exported or paid. Only the
 * status changes — the receipt is kept — and Đã hủy is never reopened.
 */
export const isCancellable = (status: ReceiptStatus) => status !== RECEIPT_STATUS.Cancelled;

/** The cancel page's four fixed reasons (P2610), in the mock's order. */
export const CANCEL_REASON_KEYS: Record<ReceiptCancelReason, string> = {
  [RECEIPT_CANCEL_REASON.WrongPayer]: "Receipt:CancelReason:WrongPayer",
  [RECEIPT_CANCEL_REASON.WrongAmountOrService]: "Receipt:CancelReason:WrongAmountOrService",
  [RECEIPT_CANCEL_REASON.Duplicate]: "Receipt:CancelReason:Duplicate",
  [RECEIPT_CANCEL_REASON.Other]: "Receipt:CancelReason:Other",
};

/**
 * Why a receipt was cancelled, as one line: the picked reason, then the
 * cashier's words. A receipt cancelled before the four reasons existed has
 * only the words.
 */
export function cancelReasonText(code: ReceiptCancelReason | null, text: string | null): string {
  const parts = [code ? t(CANCEL_REASON_KEYS[code]) : null, text].filter(Boolean);
  return parts.length ? parts.join(" — ") : "—";
}
