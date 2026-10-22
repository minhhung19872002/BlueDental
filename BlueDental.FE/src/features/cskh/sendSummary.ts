import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import type { SendPeriod } from "./api/sendApi";
import { MESSAGE_CHANNEL, type MessageChannel } from "./api/templateApi";
import type { CareDateMode, CareTabConfig } from "./careTabs";
import type { RecipientStats } from "./sendRecipients";

/** What a row needs to be reached on the channel: a ZNS goes to the phone number, as an SMS does. */
export function contactNameOf(channel: MessageChannel): string {
  return channel === MESSAGE_CHANNEL.Email ? t("CSKH:Send:Contact:Email") : t("CSKH:Send:Contact:Sms");
}

/** The period the date bar shows, worded as its navigator words it. */
export function periodLabel(mode: CareDateMode, period: SendPeriod): string {
  const from = dayjs(period.fromDate);
  if (mode === "day") return from.format("DD/MM/YYYY");
  if (mode === "week") return `${from.format("DD/MM")} - ${dayjs(period.toDate).format("DD/MM/YYYY")}`;
  return from.format("MM/YYYY");
}

interface SummaryArgs {
  channelName: string;
  templateName: string | null;
  /** Null for Khách lẻ, which counts the ticked customers instead. */
  list: { tab: CareTabConfig; mode: CareDateMode; period: SendPeriod } | null;
  pickedCount: number;
  stats: RecipientStats;
  pricePerMessage: number | null;
}

export function sendSummaryOf({ channelName, templateName, list, pickedCount, stats, pricePerMessage }: SummaryArgs) {
  return {
    channelTemplate: `${channelName} · ${templateName ?? t("CSKH:Send:NoTemplatePicked")}`,
    people: list ? `${list.tab.label()} · ${periodLabel(list.mode, list.period)}` : t("CSKH:Send:Sum:Picked", pickedCount),
    messages: t("CSKH:Send:Sum:MessageCount", stats.sendable, channelName),
    cost: pricePerMessage === null ? t("CSKH:Send:Sum:CostUnknown") : formatMoneyUnit(pricePerMessage * stats.sendable),
    skipped: stats.total - stats.sendable,
  };
}

interface BlockerArgs {
  channelName: string;
  hasTemplate: boolean;
  connected: boolean;
  /** Khách lẻ with nobody ticked. */
  nobodyPicked: boolean;
  sendable: number;
  schedulePast: boolean;
}

/** The first thing still missing, which the CTA reads instead of "Gửi {n} tin"; null when it can send. */
export function sendBlocker({ channelName, hasTemplate, connected, nobodyPicked, sendable, schedulePast }: BlockerArgs): string | null {
  if (!hasTemplate) return t("CSKH:Send:PickTemplateFirst");
  if (!connected) return t("CSKH:Send:Check:ChannelOff", channelName);
  if (nobodyPicked) return t("CSKH:Send:PickCustomers");
  if (sendable === 0) return t("CSKH:Send:NobodyToSend");
  if (schedulePast) return t("CSKH:Send:PickSchedule");
  return null;
}
