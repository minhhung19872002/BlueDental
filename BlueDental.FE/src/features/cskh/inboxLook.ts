import { t } from "@/lib/i18n";
import { formatClock } from "@/utils/format";
import { CONVERSATION_STATUS, INBOX_LIMITS, type ConversationSummary } from "./api/inboxApi";

/** BA mock legend: "Vàng: chờ ≥ 15 phút", "Đỏ: chờ ≥ 60 phút". */
export const WAIT_AMBER_MINUTES = 15;
export const WAIT_RED_MINUTES = 60;

export type WaitTone = "amber" | "red";

/** How long an unanswered customer has waited, as the row's colour; none once answered. */
export function waitTone(conversation: ConversationSummary, now: number): WaitTone | null {
  if (conversation.status !== CONVERSATION_STATUS.Unreplied || !conversation.lastCustomerMessageAt) return null;
  const minutes = (now - new Date(conversation.lastCustomerMessageAt).getTime()) / 60_000;
  if (minutes >= WAIT_RED_MINUTES) return "red";
  if (minutes >= WAIT_AMBER_MINUTES) return "amber";
  return null;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** The row's time: "10:12" today, "Hôm qua 16:40", else "21/10". */
export function listTime(value: string | null, now: number): string {
  if (!value) return "";
  const at = new Date(value);
  const today = new Date(now);
  if (sameDay(at, today)) return formatClock(at);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(at, yesterday)) return t("CSKH:Inbox:Yesterday", formatClock(at));
  return `${String(at.getDate()).padStart(2, "0")}/${String(at.getMonth() + 1).padStart(2, "0")}`;
}

/** "16:40 21/10", the way the chat header and bubbles stamp a message. */
export function stamp(value: string): string {
  const at = new Date(value);
  return `${formatClock(at)} ${String(at.getDate()).padStart(2, "0")}/${String(at.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Whole hours left to send a "tin tư vấn"; 0 once the 48-hour window has
 * closed. `now` is floored to the minute, so a message that just came in can
 * read a hair over 48 hours: never more than the window itself.
 */
export function replyHoursLeft(endsAt: string | null, now: number): number {
  if (!endsAt) return 0;
  const hours = Math.ceil((new Date(endsAt).getTime() - now) / 3_600_000);
  return Math.min(INBOX_LIMITS.replyWindowHours, Math.max(0, hours));
}

/** "Trần Thái An" → "TA": the first and the last word, as the BA mock's avatars. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** The name the inbox shows: the linked record's, else what Zalo calls the user. */
export function customerName(conversation: ConversationSummary): string {
  return conversation.patientName ?? conversation.displayName;
}
