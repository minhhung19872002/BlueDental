import { t } from "@/lib/i18n";
import { careStatusLabels, careTypeLabels } from "../../api/careApi";
import { CALL_STATUS, HISTORY_KIND, type CallStatus, type HistoryEntry, type HistoryKind } from "../../api/careHistoryApi";
import { CHAT_DIRECTION, ZNS_STATE, type ZnsState } from "../../api/inboxApi";
import { channelLabels, MESSAGE_CHANNEL } from "../../api/templateApi";

/** The square badge before a line, as on the BA mock: Zalo · ZNS · SMS · Gọi · Ghi chú · TT. */
export interface LineBadge {
  text: string;
  tone: "zalo" | "zns" | "call" | "note" | "status";
}

/** A pill after the title: green when it worked, amber when it did not reach, red when it failed. */
export interface LinePill {
  text: string;
  tone: "good" | "warn" | "bad";
}

export interface LineLook {
  badge: LineBadge;
  title: string;
  pill: LinePill | null;
}

const MESSAGE_PILL: Record<ZnsState, LinePill> = {
  [ZNS_STATE.Sent]: { text: "CSKH:History:Pill:Sent", tone: "good" },
  [ZNS_STATE.Delivered]: { text: "CSKH:History:Pill:Delivered", tone: "good" },
  [ZNS_STATE.Failed]: { text: "CSKH:History:Pill:Failed", tone: "bad" },
};

const CALL_PILL: Record<CallStatus, LinePill> = {
  [CALL_STATUS.Answered]: { text: "CSKH:History:Call:Answered", tone: "good" },
  [CALL_STATUS.Missed]: { text: "CSKH:History:Call:Missed", tone: "warn" },
  [CALL_STATUS.Busy]: { text: "CSKH:History:Call:Busy", tone: "warn" },
};

function translated(pill: LinePill | undefined): LinePill | null {
  return pill ? { ...pill, text: t(pill.text) } : null;
}

const LOOKS: Record<HistoryKind, (entry: HistoryEntry) => LineLook> = {
  [HISTORY_KIND.ZaloChat]: (entry) => ({
    badge: { text: "Zalo", tone: "zalo" },
    title:
      entry.direction === CHAT_DIRECTION.Outbound
        ? t("CSKH:History:Title:ZaloReply")
        : t("CSKH:History:Title:ZaloInbound"),
    pill: null,
  }),
  [HISTORY_KIND.Message]: (entry) => {
    const channel = entry.channel ?? MESSAGE_CHANNEL.Zalo;
    const name = channel === MESSAGE_CHANNEL.Zalo ? "ZNS" : channelLabels()[channel];
    return {
      badge: { text: channel === MESSAGE_CHANNEL.Zalo ? "ZNS" : name, tone: "zns" },
      title: entry.templateName ? `${name} · ${entry.templateName}` : name,
      pill: entry.messageState ? translated(MESSAGE_PILL[entry.messageState]) : null,
    };
  },
  [HISTORY_KIND.Call]: (entry) => ({
    badge: { text: t("CSKH:History:Badge:Call"), tone: "call" },
    title: t("CSKH:History:Title:Call"),
    pill: entry.callStatus !== null ? translated(CALL_PILL[entry.callStatus]) : null,
  }),
  [HISTORY_KIND.Note]: () => ({
    badge: { text: t("CSKH:History:Badge:Note"), tone: "note" },
    title: t("CSKH:History:Title:Note"),
    pill: null,
  }),
  [HISTORY_KIND.Status]: (entry) => ({
    badge: { text: "TT", tone: "status" },
    title: t(
      "CSKH:History:Title:Status",
      entry.careType ? careTypeLabels()[entry.careType] : t("CSKH:History:CareTask"),
      entry.careStatus ? careStatusLabels()[entry.careStatus] : "",
    ),
    pill: null,
  }),
};

export function lineLook(entry: HistoryEntry): LineLook {
  return LOOKS[entry.kind](entry);
}

/** Who did it: the staff member; the customer for their own chat; the system for a status change without one. */
export function lineActor(entry: HistoryEntry): string {
  if (entry.actorName) return entry.actorName;
  if (entry.kind === HISTORY_KIND.ZaloChat && entry.direction === CHAT_DIRECTION.Inbound) {
    return t("CSKH:History:Actor:Customer");
  }
  return t("CSKH:History:Actor:System");
}
