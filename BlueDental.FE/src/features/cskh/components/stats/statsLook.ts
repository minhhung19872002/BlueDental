import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { STATUS_TONE } from "@/theme/statusPalette";
import { careTypeLabels } from "../../api/careApi";
import { RECIPIENT_SOURCE, SEND_BATCH_STATUS } from "../../api/sendApi";
import { STATS_OUTCOME, type StatsBatch, type StatsRecipient } from "../../api/statsApi";
import { formatCount } from "./statsFormat";

export interface StatsLook {
  label: string;
  bg: string;
  color: string;
}

const NEUTRAL = { bg: "var(--bd-bg-soft)", color: "var(--bd-muted)" };
const GREEN = { bg: STATUS_TONE.arrived.bg, color: STATUS_TONE.arrived.color };
const BLUE = { bg: STATUS_TONE.scheduled.bg, color: STATUS_TONE.scheduled.color };
const RED = { bg: STATUS_TONE.late.bg, color: STATUS_TONE.late.color };

/** Lịch sử gửi's Trạng thái: a queued send with a time set reads "Đã hẹn giờ". */
export function batchLook(batch: StatsBatch): StatsLook {
  switch (batch.status) {
    case SEND_BATCH_STATUS.Queued:
      return batch.scheduledAt
        ? { label: t("CSKH:Stats:Batch:Scheduled"), ...NEUTRAL }
        : { label: t("CSKH:Stats:Batch:Queued"), ...NEUTRAL };
    case SEND_BATCH_STATUS.Sending:
      return { label: t("CSKH:Stats:Batch:Sending"), ...BLUE };
    case SEND_BATCH_STATUS.Completed:
      return { label: t("CSKH:Stats:Batch:Completed"), ...GREEN };
    case SEND_BATCH_STATUS.Cancelled:
      return { label: t("CSKH:Stats:Batch:Cancelled"), bg: NEUTRAL.bg, color: "var(--bd-faint)" };
  }
}

/** Người nhận's Trạng thái: a message still waiting on its send time reads "Đã hẹn giờ". */
export function recipientLook(recipient: StatsRecipient): StatsLook {
  switch (recipient.outcome) {
    case STATS_OUTCOME.Succeeded:
      return { label: t("CSKH:Stats:Outcome:Succeeded"), ...GREEN };
    case STATS_OUTCOME.Failed:
      return { label: t("CSKH:Stats:Outcome:Failed"), ...RED };
    case STATS_OUTCOME.Pending:
      return recipient.scheduled
        ? { label: t("CSKH:Stats:Outcome:Scheduled"), ...NEUTRAL }
        : { label: t("CSKH:Stats:Outcome:Pending"), ...NEUTRAL };
  }
}

/** The list's bounds are instants at the clinic's midnight: read them as local days. */
const shortDate = (instant: string) => dayjs(instant).format("DD/MM");

/** Tệp khách hàng: "Hẹn ngày · 22/10" for a care list, "Khách lẻ" for picked customers. */
export function audienceLabel(batch: StatsBatch): string {
  if (batch.source === RECIPIENT_SOURCE.Individual || batch.careType === null) {
    return t("CSKH:Send:Source:Individual");
  }
  const type = careTypeLabels()[batch.careType];
  if (!batch.fromDate || !batch.toDate) return type;
  const from = shortDate(batch.fromDate);
  const to = shortDate(batch.toDate);
  return t("CSKH:Stats:Audience:CareList", type, from === to ? from : `${from} – ${to}`);
}

export interface BatchResult {
  text: string;
  value: number;
  max: number;
  tone: "green" | "blue";
}

/** Kết quả: "398 / 642 đã gửi" while it runs, "302 thành công · 16 lỗi" once done. */
export function batchResult(batch: StatsBatch): BatchResult {
  const handled = batch.sentCount + batch.failedCount;
  // Hẹn giờ gửi, or called off before its time: nothing went out yet.
  if (handled === 0 && (batch.status === SEND_BATCH_STATUS.Queued || batch.status === SEND_BATCH_STATUS.Cancelled)) {
    return { text: t("CSKH:Stats:Result:NotSent"), value: 0, max: batch.recipientCount, tone: "blue" };
  }
  if (batch.status === SEND_BATCH_STATUS.Queued || batch.status === SEND_BATCH_STATUS.Sending) {
    return {
      text: t("CSKH:Stats:Result:Progress", formatCount(handled), formatCount(batch.recipientCount)),
      value: handled,
      max: batch.recipientCount,
      tone: "blue",
    };
  }
  return {
    text: t("CSKH:Stats:Result:Done", formatCount(batch.sentCount), formatCount(batch.failedCount)),
    value: batch.sentCount,
    max: batch.recipientCount,
    tone: "green",
  };
}
