import { useMemo } from "react";
import { RECIPIENT_SOURCE, useRecipients, type MessageRecipient, type RecipientsInput, type SendPeriod } from "../api/sendApi";
import type { CareType } from "../api/careApi";
import type { MessageChannel } from "../api/templateApi";
import { recipientStats } from "../sendRecipients";
import type { IndividualPicks } from "./useIndividualPicks";
import type { RecipientRemoval } from "./useRecipientRemoval";
import type { SendSource } from "./useSendParams";

interface SendRecipientsArgs {
  channel: MessageChannel;
  templateId: string | null;
  source: SendSource;
  careRecordId: string | null;
  careType: CareType;
  period: SendPeriod;
  skipRecent: boolean;
  picks: IndividualPicks;
  removal: RecipientRemoval;
}

/**
 * "Gửi tới": the server reads the rows (contact, last receipt, missing data)
 * for the list or the added customers; the rows in play are the list minus
 * "Xóa", or the ticked customers. The stats and the send count those only.
 */
export function useSendRecipients(args: SendRecipientsArgs) {
  const { channel, templateId, source, careRecordId, careType, period, skipRecent, picks, removal } = args;
  const isList = source === "list";

  const input = useMemo<RecipientsInput>(
    () => ({
      channel,
      templateId,
      source: isList ? RECIPIENT_SOURCE.CareList : RECIPIENT_SOURCE.Individual,
      careType: isList ? careType : null,
      fromDate: isList ? period.fromDate : null,
      toDate: isList ? period.toDate : null,
      patientIds: isList ? [] : [...picks.addedIds],
      careRecordId: isList ? null : careRecordId,
      keys: null,
      skipRecentDuplicates: skipRecent,
    }),
    [channel, templateId, isList, careRecordId, careType, period.fromDate, period.toDate, picks.addedIds, skipRecent],
  );
  const enabled = isList || picks.addedIds.length > 0;
  const query = useRecipients(input, enabled);
  const rows = useMemo(() => (enabled ? query.data?.items ?? [] : []), [enabled, query.data]);

  const { checkedIds } = picks;
  const inPlay = useMemo(
    () =>
      rows.filter((row) =>
        isList ? !removal.removed.has(row.key) : row.patientId !== null && checkedIds.includes(row.patientId),
      ),
    [rows, isList, removal.removed, checkedIds],
  );
  const stats = useMemo(() => recipientStats(inPlay), [inPlay]);

  return {
    input,
    /** What the table lists: Khách lẻ keeps unticked rows on screen. */
    rows: isList ? inPlay : rows,
    inPlay,
    stats,
    pricePerMessage: query.data?.pricePerMessage ?? null,
    /* A kept list is the previous tab's or period's: its count must not be sent. */
    loading: enabled && (query.isLoading || query.isPlaceholderData),
    error: query.error,
  };
}

/** The ids the server must send to: the list minus removals, or the ticked customers. */
export function sendSelection(source: SendSource, inPlay: readonly MessageRecipient[], removedCount: number, checkedIds: readonly string[]) {
  if (source === "individual") return { keys: null, patientIds: [...checkedIds] };
  return { keys: removedCount > 0 ? inPlay.map((row) => row.key) : null, patientIds: [] };
}

export type SendRecipients = ReturnType<typeof useSendRecipients>;
