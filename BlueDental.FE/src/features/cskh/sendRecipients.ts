import { foldForSearch } from "@/utils/foldForSearch";
import { SKIP_REASON, type MessageRecipient, type SkipReason } from "./api/sendApi";

/**
 * How a row of "Gửi tới" reads: it will get the message, it already got this
 * template while the 30-day guard is on, it has no phone / email for the
 * channel, its phone is not a number Zalo takes, a variable the template
 * needs has no data for it, or it shares its phone with a row above and gets
 * that row's message (BA P2210 R05).
 */
export type RecipientKind = "ok" | "dup" | "no" | "invalid" | "missing" | "merged";

const KIND_OF_SKIP: Record<SkipReason, RecipientKind> = {
  [SKIP_REASON.NoContact]: "no",
  [SKIP_REASON.RecentlySent]: "dup",
  [SKIP_REASON.MissingVariable]: "missing",
  [SKIP_REASON.InvalidPhone]: "invalid",
  [SKIP_REASON.MergedPhone]: "merged",
};

/** No message can reach the row: nothing to tick in. */
export const isUnreachable = (kind: RecipientKind) => kind === "no" || kind === "invalid";

export function recipientKind(recipient: MessageRecipient): RecipientKind {
  return recipient.skipReason === null ? "ok" : KIND_OF_SKIP[recipient.skipReason];
}

export interface RecipientStats {
  total: number;
  /** Will get it and never got this template — the green chip. */
  fresh: number;
  /** Got it within 30 days: skipped with the guard on, sent again with it off — the amber chip. */
  received: number;
  noContact: number;
  invalidPhone: number;
  missing: number;
  /** Share a phone with a row above and get its message. */
  merged: number;
  /** Rows the server will really send to. */
  sendable: number;
  /** Variable key → how many reachable customers lack it, most first. */
  missingByVariable: [string, number][];
}

/** The chips split the rows, so they add up to "{total} khách". */
export function recipientStats(rows: readonly MessageRecipient[]): RecipientStats {
  const missingCounts = new Map<string, number>();
  const counts = { fresh: 0, received: 0, noContact: 0, invalidPhone: 0, missing: 0, merged: 0, sendable: 0 };

  for (const row of rows) {
    const kind = recipientKind(row);
    if (kind === "no") counts.noContact += 1;
    else if (kind === "invalid") counts.invalidPhone += 1;
    else if (kind === "missing") counts.missing += 1;
    else if (kind === "merged") counts.merged += 1;
    else if (kind === "dup" || row.receivedAt) counts.received += 1;
    else counts.fresh += 1;
    if (kind === "ok") counts.sendable += 1;
    if (isUnreachable(kind)) continue;
    for (const key of row.missing) missingCounts.set(key, (missingCounts.get(key) ?? 0) + 1);
  }

  return {
    total: rows.length,
    ...counts,
    missingByVariable: [...missingCounts].sort((a, b) => b[1] - a[1]),
  };
}

/** "Tìm tên, SĐT": accent-blind on the name, plain on the code and the phone digits. */
export function matchesRecipient(recipient: MessageRecipient, foldedQuery: string): boolean {
  if (!foldedQuery) return true;
  if (foldForSearch(recipient.name).includes(foldedQuery)) return true;
  if (recipient.code?.toLowerCase().includes(foldedQuery)) return true;
  const digits = foldedQuery.replace(/\D/g, "");
  return digits.length > 0 && (recipient.phone?.replace(/\D/g, "").includes(digits) ?? false);
}

/** The preview call takes a patient, or the booking behind a "Lịch tạm" guest (`a:` key). */
export function previewTargetOf(recipient: MessageRecipient): { patientId: string | null; appointmentId: string | null } {
  if (recipient.patientId) return { patientId: recipient.patientId, appointmentId: null };
  return { patientId: null, appointmentId: recipient.key.startsWith("a:") ? recipient.key.slice(2) : null };
}

/** Whom the preview and "Gửi thử" speak to: the first customer the send reaches, else the first in play. */
export function sampleRecipient(inPlay: readonly MessageRecipient[]): MessageRecipient | null {
  return inPlay.find((row) => recipientKind(row) === "ok") ?? inPlay[0] ?? null;
}
