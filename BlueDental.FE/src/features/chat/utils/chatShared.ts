import dayjs, { type Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import type { ChatSharedFileDto, ChatSharedFilter, ChatSharedLinkDto } from "../types";

export interface DayGroup<T> {
  key: string;
  heading: string;
  items: T[];
}

/** "Ngày 06 Tháng 11", with the year added for another year. */
export function formatDayHeading(day: Dayjs, now = dayjs()): string {
  const date = day.format("DD");
  const month = day.format("MM");
  return day.isSame(now, "year")
    ? t("Chat:DayHeading", date, month)
    : t("Chat:DayHeadingYear", date, month, day.format("YYYY"));
}

/** Items already newest first, cut into one run per local day. */
export function groupByDay<T extends { sentAt: string }>(items: readonly T[], now = dayjs()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const day = dayjs(item.sentAt);
    const key = day.format("YYYY-MM-DD");
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, heading: formatDayHeading(day, now), items: [item] });
  }
  return groups;
}

export interface SharedFilterState {
  senderId: string | undefined;
  period: [Dayjs, Dayjs] | null;
}

export const EMPTY_SHARED_FILTER: SharedFilterState = { senderId: undefined, period: null };

/** The query the server takes: clinic days, both ends included. */
export function toSharedFilter({ senderId, period }: SharedFilterState): ChatSharedFilter {
  return {
    senderId,
    sentFrom: period?.[0].format("YYYY-MM-DD"),
    sentTo: period?.[1].format("YYYY-MM-DD"),
  };
}

export function isFiltered({ senderId, period }: SharedFilterState): boolean {
  return Boolean(senderId || period);
}

/** The server only sends http(s); checked again before it becomes a link. */
export function isWebLink(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** One ticked item of Kho lưu trữ; a tab switch clears them, so they are all one kind. */
export type SharedPick =
  | { kind: "file"; item: ChatSharedFileDto }
  | { kind: "link"; item: ChatSharedLinkDto };

/** What a tab needs from the "Chọn" mode. */
export interface SharedPicking {
  selecting: boolean;
  selected: ReadonlyMap<string, SharedPick>;
  toggle: (key: string, pick: SharedPick) => void;
}

export const linkKey = (link: ChatSharedLinkDto) => `${link.messageId} ${link.url}`;
