import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { STATUS_TONE } from "@/theme/statusPalette";
import { CAMPAIGN_OUTCOME, type Campaign, type CampaignOutcome } from "../../api/campaignApi";
import { SEND_BATCH_STATUS } from "../../api/sendApi";
import { channelLabels, MESSAGE_CHANNEL, type MessageChannel } from "../../api/templateApi";
import { audienceLabel, type StatsLook } from "../stats/statsLook";
import { formatCount } from "../stats/statsFormat";

const NEUTRAL = { bg: "var(--bd-bg-soft)", color: "var(--bd-muted)" };
const GREEN = { bg: STATUS_TONE.arrived.bg, color: STATUS_TONE.arrived.color };
const BLUE = { bg: STATUS_TONE.scheduled.bg, color: STATUS_TONE.scheduled.color };
const RED = { bg: STATUS_TONE.late.bg, color: STATUS_TONE.late.color };

/** A Zalo send goes out as ZNS: the BA's chip names that, the other channels by name. */
export function channelChip(channel: MessageChannel): string {
  return channel === MESSAGE_CHANNEL.Zalo ? t("CSKH:Campaign:Zns") : channelLabels()[channel];
}

const isStopped = (campaign: Campaign) =>
  campaign.status === SEND_BATCH_STATUS.Stopped || campaign.status === SEND_BATCH_STATUS.Cancelled;

/** Only a send still going can be stopped: a booked one is called off, a running one cut short. */
export const canStop = (campaign: Campaign) =>
  campaign.status === SEND_BATCH_STATUS.Queued || campaign.status === SEND_BATCH_STATUS.Sending;

/** Đang gửi (booked ones too) · Đã gửi · Đã dừng (a booked send called off reads the same, BA P2210). */
export function campaignLook(campaign: Campaign): StatsLook {
  if (canStop(campaign)) return { label: t("CSKH:Campaign:Status:Sending"), ...BLUE };
  if (isStopped(campaign)) return { label: t("CSKH:Campaign:Status:Stopped"), ...NEUTRAL };
  return { label: t("CSKH:Campaign:Status:Sent"), ...GREEN };
}

/** Khách hàng / Tệp khách hàng: the one customer by name, else the list it went to. */
export function campaignAudience(campaign: Campaign): string {
  return campaign.customerName ?? audienceLabel(campaign);
}

/** "22/10 09:00" like the BA's list; the year only shows once it is not this one. */
export function formatRunAt(at: string): string {
  const instant = dayjs(at);
  return instant.format(instant.isSame(dayjs(), "year") ? "DD/MM HH:mm" : "DD/MM/YYYY HH:mm");
}

/**
 * Lần chạy gần nhất's second line: "Hẹn gửi 24/10 08:00" before a booked send
 * goes, "3/5 đã gửi · 2 dừng" once stopped, "4/5 thành công · 1 lỗi" otherwise
 * — just "3/3 thành công" when nothing failed (BA P2210).
 */
export function campaignRunLine(campaign: Campaign): string {
  const handled = campaign.succeededCount + campaign.failedCount;
  const total = formatCount(campaign.recipientCount);
  if (campaign.status === SEND_BATCH_STATUS.Queued && campaign.scheduledAt && handled === 0) {
    return t("CSKH:Campaign:Run:Scheduled", formatRunAt(campaign.scheduledAt));
  }
  if (isStopped(campaign)) {
    return t("CSKH:Campaign:Run:Stopped", formatCount(handled), total, formatCount(campaign.stoppedCount));
  }
  const succeeded = formatCount(campaign.succeededCount);
  if (campaign.failedCount === 0) return t("CSKH:Campaign:Run:Succeeded", succeeded, total);
  return t("CSKH:Campaign:Run:Done", succeeded, total, formatCount(campaign.failedCount));
}

const OUTCOME_LOOK: Record<CampaignOutcome, { key: string; tone: { bg: string; color: string } }> = {
  [CAMPAIGN_OUTCOME.Succeeded]: { key: "CSKH:Campaign:Outcome:Succeeded", tone: GREEN },
  [CAMPAIGN_OUTCOME.Failed]: { key: "CSKH:Campaign:Outcome:Failed", tone: RED },
  // Bị loại is grey in the BA's bar and table; Chờ gửi takes the bar's blue.
  [CAMPAIGN_OUTCOME.Skipped]: { key: "CSKH:Campaign:Outcome:Skipped", tone: NEUTRAL },
  [CAMPAIGN_OUTCOME.Pending]: { key: "CSKH:Campaign:Outcome:Pending", tone: BLUE },
  [CAMPAIGN_OUTCOME.Stopped]: { key: "CSKH:Campaign:Outcome:Stopped", tone: NEUTRAL },
};

/** Kết quả of one customer: Thành công · Thất bại · Bị loại · Chờ gửi · Đã dừng. */
export function outcomeLook(outcome: CampaignOutcome): StatsLook {
  const look = OUTCOME_LOOK[outcome];
  return { label: t(look.key), ...look.tone };
}
