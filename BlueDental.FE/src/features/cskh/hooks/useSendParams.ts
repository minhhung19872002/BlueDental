import { useSearchParams } from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";
import { MESSAGE_CHANNELS, type MessageChannel } from "../api/templateApi";
import {
  anchorForMode,
  careDateModeOf,
  careDateRange,
  careTabByKey,
  type CareDateMode,
  type CareTabKey,
} from "../careTabs";
import { CHANNEL_SLUG } from "../templatePaths";

/** Danh sách CSKH (a tab over a period) or Khách lẻ (customers picked one by one). */
export type SendSource = "list" | "individual";

function channelOf(slug: string | null): MessageChannel | null {
  return MESSAGE_CHANNELS.find((channel) => CHANNEL_SLUG[channel] === slug) ?? null;
}

/**
 * What Gửi tin nhắn was opened with lives in the URL, as /cskh-grouping keeps
 * page / care_dateMode / care_date, so a reload lands on the same send.
 */
export function useSendParams() {
  const [params, setParams] = useSearchParams();

  const lockedPatientId = params.get("patientId");
  const source: SendSource = lockedPatientId || params.get("to") === "individual" ? "individual" : "list";
  const careTab = careTabByKey(params.get("page"));
  const mode = careDateModeOf(params.get("care_dateMode"));
  const rawParam = params.get("care_date");
  const rawDate = rawParam ? dayjs(rawParam) : null;
  const date = rawDate?.isValid() ? rawDate : anchorForMode(mode, dayjs());

  const update = (mutate: (next: URLSearchParams) => void) =>
    setParams(
      (next) => {
        mutate(next);
        return next;
      },
      { replace: true },
    );

  return {
    channelParam: channelOf(params.get("channel")),
    templateId: params.get("templateId"),
    source,
    lockedPatientId,
    careTab,
    mode,
    date,
    period: careDateRange(mode, date),
    /** A template belongs to one channel, so switching channel drops the pick. */
    setChannel: (channel: MessageChannel) =>
      update((next) => {
        next.set("channel", CHANNEL_SLUG[channel]);
        next.delete("templateId");
      }),
    setTemplate: (id: string) => update((next) => next.set("templateId", id)),
    setSource: (value: SendSource) => update((next) => next.set("to", value)),
    setCareTab: (key: CareTabKey) => update((next) => next.set("page", key)),
    setMode: (value: CareDateMode) =>
      update((next) => {
        next.set("care_dateMode", value);
        next.set("care_date", anchorForMode(value, dayjs()).format("YYYY-MM-DD"));
      }),
    setDate: (value: Dayjs) => update((next) => next.set("care_date", value.format("YYYY-MM-DD"))),
  };
}

export type SendParams = ReturnType<typeof useSendParams>;
