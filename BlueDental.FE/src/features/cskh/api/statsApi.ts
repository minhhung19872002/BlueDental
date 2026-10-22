import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { downloadFile } from "@/lib/download";
import type { PagedResult } from "@/types";
import type { CareType } from "./careApi";
import type { RecipientSource, SendBatchStatus } from "./sendApi";
import type { MessageChannel } from "./templateApi";

/** Matches BlueDental.CustomerCare.Messaging.MessageStatsOutcome. */
export const STATS_OUTCOME = { Succeeded: 1, Failed: 2, Pending: 3 } as const;
export type StatsOutcome = (typeof STATS_OUTCOME)[keyof typeof STATS_OUTCOME];

/** Mirrors MessageStatsLimits: the server refuses longer periods (Tools:0027). */
export const STATS_LIMITS = { maxDays: 1830, maxPageSize: 100, maxFilter: 200 } as const;

/** Mirrors MessageStatsFilterInput; dates are `YYYY-MM-DD`, both ends inclusive. */
export interface StatsFilter {
  fromDate: string;
  toDate: string;
  channel: MessageChannel | null;
  templateId: string | null;
}

export interface StatsOverviewInput extends StatsFilter {
  compareFromDate: string | null;
  compareToDate: string | null;
}

export interface StatsPage {
  skipCount: number;
  maxResultCount: number;
}

export type StatsRecipientSort = "at desc" | "at asc" | "name asc" | "name desc";

export interface StatsRecipientQuery {
  filter: string;
  outcome: StatsOutcome | null;
  sorting: StatsRecipientSort;
}

export interface StatsTotals {
  sent: number;
  succeeded: number;
  failed: number;
}

export interface StatsDay extends StatsTotals {
  date: string;
}

export interface StatsChannel {
  channel: MessageChannel;
  sent: number;
  succeeded: number;
}

export interface StatsTemplate {
  templateId: string | null;
  name: string;
  channel: MessageChannel;
  uses: number;
  sent: number;
  succeeded: number;
  lastSentAt: string | null;
}

export interface StatsOverview {
  totals: StatsTotals;
  /** Null unless a comparison period was asked for. */
  previous: StatsTotals | null;
  days: StatsDay[];
  /** All three channels, sent or not. */
  channels: StatsChannel[];
  templates: StatsTemplate[];
}

export interface StatsTemplateOption {
  id: string;
  name: string;
  channel: MessageChannel;
}

export interface StatsBatch {
  id: string;
  at: string;
  channel: MessageChannel;
  templateId: string;
  templateName: string;
  source: RecipientSource;
  careType: CareType | null;
  fromDate: string | null;
  toDate: string | null;
  senderName: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  status: SendBatchStatus;
  scheduledAt: string | null;
}

export interface StatsRecipient {
  id: string;
  patientId: string | null;
  name: string;
  /** Already masked by the server under "Ẩn số điện thoại". */
  phone: string | null;
  templateName: string | null;
  channel: MessageChannel;
  at: string;
  outcome: StatsOutcome;
  error: string | null;
  scheduled: boolean;
}

const BASE = "/v1/app/message-stats";

/** Leaves out what is not set, so the query string carries only real filters. */
function params(input: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null && value !== ""));
}

const statsApi = {
  overview: (input: StatsOverviewInput) =>
    api.get<StatsOverview>(`${BASE}/overview`, { params: params(input) }).then((r) => r.data),
  templates: () => api.get<StatsTemplateOption[]>(`${BASE}/templates`).then((r) => r.data),
  batches: (filter: StatsFilter, page: StatsPage) =>
    api.get<PagedResult<StatsBatch>>(`${BASE}/batches`, { params: params({ ...filter, ...page }) }).then((r) => r.data),
  recipients: (filter: StatsFilter, query: StatsRecipientQuery, page: StatsPage) =>
    api
      .get<PagedResult<StatsRecipient>>(`${BASE}/recipients`, { params: params({ ...filter, ...query, ...page }) })
      .then((r) => r.data),
  excel: (filter: StatsFilter, query: Omit<StatsRecipientQuery, "sorting">) =>
    downloadFile(`${BASE}/excel`, "thong-ke-cskh.xlsx", params({ ...filter, ...query })),
};

export const statsKeys = {
  all: ["message-stats"] as const,
  overview: (input: StatsOverviewInput) => [...statsKeys.all, "overview", input] as const,
  templates: () => [...statsKeys.all, "templates"] as const,
  batches: (filter: StatsFilter, page: StatsPage) => [...statsKeys.all, "batches", filter, page] as const,
  recipients: (filter: StatsFilter, query: StatsRecipientQuery, page: StatsPage) =>
    [...statsKeys.all, "recipients", filter, query, page] as const,
};

export function useStatsOverview(input: StatsOverviewInput) {
  return useQuery({
    queryKey: statsKeys.overview(input),
    queryFn: () => statsApi.overview(input),
    placeholderData: keepPreviousData,
  });
}

/** Every template the branch ever sent with, deleted ones marked "(đã xoá)". */
export function useStatsTemplateOptions() {
  return useQuery({ queryKey: statsKeys.templates(), queryFn: statsApi.templates });
}

export function useStatsBatches(filter: StatsFilter, page: StatsPage) {
  return useQuery({
    queryKey: statsKeys.batches(filter, page),
    queryFn: () => statsApi.batches(filter, page),
    placeholderData: keepPreviousData,
  });
}

export function useStatsRecipients(filter: StatsFilter, query: StatsRecipientQuery, page: StatsPage) {
  return useQuery({
    queryKey: statsKeys.recipients(filter, query, page),
    queryFn: () => statsApi.recipients(filter, query, page),
    placeholderData: keepPreviousData,
  });
}

/** "Xuất báo cáo Excel": the four tables over the filters on screen. */
export function useExportStats() {
  return useMutation({
    mutationFn: ({ filter, query }: { filter: StatsFilter; query: Omit<StatsRecipientQuery, "sorting"> }) =>
      statsApi.excel(filter, query),
  });
}
