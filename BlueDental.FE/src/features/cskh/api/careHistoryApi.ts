import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { CareStatus, CareType } from "./careApi";
import type { CareNote } from "./careNoteApi";
import type { ChatDirection, ConversationStatus, ZnsState } from "./inboxApi";
import type { MessageChannel } from "./templateApi";

/** Matches BlueDental.CustomerCare.CareHistoryKind. */
export const HISTORY_KIND = { ZaloChat: 1, Message: 2, Call: 3, Note: 4, Status: 5 } as const;
export type HistoryKind = (typeof HISTORY_KIND)[keyof typeof HISTORY_KIND];

/** Matches BlueDental.CustomerCare.CareHistoryFilter — the chips over the history. */
export const HISTORY_FILTER = { All: 0, ZaloChat: 1, Message: 2, Call: 3, Note: 4 } as const;
export type HistoryFilter = (typeof HISTORY_FILTER)[keyof typeof HISTORY_FILTER];

/** Matches BlueDental.Tools.CallLogStatus. */
export const CALL_STATUS = { Answered: 0, Missed: 1, Busy: 2 } as const;
export type CallStatus = (typeof CALL_STATUS)[keyof typeof CALL_STATUS];

/** Matches BlueDental.CustomerCare.PatientContactState. */
export const CONTACT_STATE = { NotContacted: 0, Contacted: 1 } as const;
export type ContactState = (typeof CONTACT_STATE)[keyof typeof CONTACT_STATE];

export interface HistoryInput {
  /** ISO instants; both null = "Tất cả thời gian", the BA's default. */
  fromDate: string | null;
  toDate: string | null;
  kind: HistoryFilter;
}

export interface HistoryEntry {
  key: string;
  kind: HistoryKind;
  at: string;
  text: string | null;
  actorName: string | null;
  direction: ChatDirection | null;
  channel: MessageChannel | null;
  templateName: string | null;
  messageState: ZnsState | null;
  callStatus: CallStatus | null;
  careStatus: CareStatus | null;
  careType: CareType | null;
  note: CareNote | null;
}

export interface CareCostSummary {
  year: number;
  znsSent: number;
  znsFailed: number;
  smsSent: number;
  zaloChatMessages: number;
  calls: number;
  messageCost: number;
}

export interface CareOverview {
  contactState: ContactState;
  contactWindowDays: number;
  lastContactAt: string | null;
  conversationId: string | null;
  zaloStatus: ConversationStatus | null;
  year: CareCostSummary;
}

const historyPath = (patientId: string) => `/v1/app/patients/${patientId}/care-history`;

const careHistoryApi = {
  list: (patientId: string, input: HistoryInput) =>
    api
      .get<HistoryEntry[]>(historyPath(patientId), {
        params: { fromDate: input.fromDate ?? undefined, toDate: input.toDate ?? undefined, kind: input.kind },
      })
      .then((r) => r.data),
  overview: (patientId: string) => api.get<CareOverview>(`${historyPath(patientId)}/overview`).then((r) => r.data),
};

/** "care-history" is the root the note mutations refresh too (careNoteApi). */
export const careHistoryKeys = {
  all: ["care-history"] as const,
  list: (patientId: string, input: HistoryInput) => [...careHistoryKeys.all, patientId, "list", input] as const,
  overview: (patientId: string) => [...careHistoryKeys.all, patientId, "overview"] as const,
};

export function useCareHistory(patientId: string, input: HistoryInput) {
  return useQuery({
    queryKey: careHistoryKeys.list(patientId, input),
    queryFn: () => careHistoryApi.list(patientId, input),
    placeholderData: keepPreviousData,
  });
}

export function useCareOverview(patientId: string) {
  return useQuery({ queryKey: careHistoryKeys.overview(patientId), queryFn: () => careHistoryApi.overview(patientId) });
}
