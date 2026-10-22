import type { CareDateMode, CareTabKey } from "./careTabs";
import { MESSAGE_CHANNEL, type MessageChannel } from "./api/templateApi";

/** "Mẫu tin nhắn" is a tab of /cskh-grouping; its editor has a page of its own. */
export const TEMPLATE_LIST_PATH = "/cskh-grouping?tab=template";

/** "new" opens a blank editor; an id opens that template. */
export const templateEditorPath = (id: string) => `/cskh-grouping/templates/${id}`;

/** How the channel reads in the Gửi tin nhắn URL. */
export const CHANNEL_SLUG: Record<MessageChannel, string> = {
  [MESSAGE_CHANNEL.Sms]: "sms",
  [MESSAGE_CHANNEL.Zalo]: "zalo",
  [MESSAGE_CHANNEL.Email]: "email",
};

/** What Gửi tin nhắn opens with; anything left out takes the screen's default. */
export interface SendPathParams {
  channel?: MessageChannel;
  templateId?: string;
  /** A CSKH tab over the period the board was showing. */
  page?: CareTabKey;
  dateMode?: CareDateMode;
  date?: string;
  /** A row's SMS / Zalo button: Khách lẻ, locked to that customer. */
  patientId?: string;
  /** That row, so a Zalo sent from it marks it as sent. */
  careRecordId?: string;
}

export function sendPath(params: SendPathParams = {}): string {
  const query = new URLSearchParams();
  if (params.channel !== undefined) query.set("channel", CHANNEL_SLUG[params.channel]);
  if (params.templateId) query.set("templateId", params.templateId);
  if (params.page) query.set("page", params.page);
  if (params.dateMode) query.set("care_dateMode", params.dateMode);
  if (params.date) query.set("care_date", params.date);
  if (params.patientId) query.set("patientId", params.patientId);
  if (params.careRecordId) query.set("careRecordId", params.careRecordId);
  const search = query.toString();
  return search ? `/cskh-grouping/send?${search}` : "/cskh-grouping/send";
}

/** The CSKH board on a tab over a period: where Gửi tin nhắn leads back to. */
export function careBoardPath(page: CareTabKey, dateMode: CareDateMode, date: string): string {
  return `/cskh-grouping?${new URLSearchParams({ page, care_dateMode: dateMode, care_date: date })}`;
}
