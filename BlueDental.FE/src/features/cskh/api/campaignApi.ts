import { useEffect, useMemo, useRef } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { downloadFile } from "@/lib/download";
import type { PagedResult } from "@/types";
import { careKeys, type CareType } from "./careApi";
import {
  SEND_BATCH_STATUS,
  sendKeys,
  useInvalidateAfterSend,
  type RecipientSource,
  type SendBatchStatus,
  type SkipReason,
} from "./sendApi";
import { statsKeys } from "./statsApi";
import type { MessageChannel } from "./templateApi";

/** Matches BlueDental.CustomerCare.Messaging.MessageCampaignOutcome. */
export const CAMPAIGN_OUTCOME = { Succeeded: 1, Failed: 2, Skipped: 3, Pending: 4, Stopped: 5 } as const;
export type CampaignOutcome = (typeof CAMPAIGN_OUTCOME)[keyof typeof CAMPAIGN_OUTCOME];

export interface CampaignPage {
  skipCount: number;
  maxResultCount: number;
}

/** One row of Chiến dịch đã gửi: one press of Gửi or Hẹn gửi (BA P2210, F-79). */
export interface Campaign {
  id: string;
  channel: MessageChannel;
  templateId: string;
  templateName: string;
  source: RecipientSource;
  careType: CareType | null;
  fromDate: string | null;
  toDate: string | null;
  /** The customer's name when the send was for one customer. */
  customerName: string | null;
  selectedCount: number;
  recipientCount: number;
  skippedCount: number;
  succeededCount: number;
  failedCount: number;
  pendingCount: number;
  stoppedCount: number;
  status: SendBatchStatus;
  scheduledAt: string | null;
  creationTime: string;
  lastRunAt: string;
}

export interface CampaignReason {
  outcome: CampaignOutcome;
  skipReason: SkipReason | null;
  /** Already in the viewer's language. */
  label: string;
  count: number;
}

export interface CampaignTabs {
  all: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

export interface CampaignDetail extends Campaign {
  externalTemplateId: string | null;
  senderName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  deliveredCount: number;
  cost: number;
  pricePerMessage: number | null;
  chargedCount: number;
  reasons: CampaignReason[];
  tabs: CampaignTabs;
}

export interface CampaignRecipient {
  id: string;
  patientId: string | null;
  name: string;
  /** Already masked by the server under "Ẩn số điện thoại". */
  phone: string | null;
  outcome: CampaignOutcome;
  detail: string;
  at: string | null;
  cost: number | null;
}

const BASE = "/v1/app/message-campaigns";

const campaignApi = {
  list: (page: CampaignPage) => api.get<PagedResult<Campaign>>(BASE, { params: page }).then((r) => r.data),
  get: (id: string) => api.get<CampaignDetail>(`${BASE}/${id}`).then((r) => r.data),
  recipients: (id: string, outcome: CampaignOutcome | null, page: CampaignPage) =>
    api
      .get<PagedResult<CampaignRecipient>>(`${BASE}/${id}/recipients`, {
        params: { ...page, outcome: outcome ?? undefined },
      })
      .then((r) => r.data),
  stop: (id: string) => api.post<Campaign>(`${BASE}/${id}/stop`).then((r) => r.data),
  failures: (id: string) => downloadFile(`${BASE}/${id}/failures-excel`, "ket-qua-lan-gui.xlsx"),
};

export const campaignKeys = {
  /** Under the sends' keys: a new send, a cancel or a stop refreshes the list too. */
  all: [...sendKeys.all, "campaigns"] as const,
  list: (page: CampaignPage) => [...campaignKeys.all, "list", page] as const,
  detail: (id: string) => [...campaignKeys.all, "detail", id] as const,
  recipients: (id: string, outcome: CampaignOutcome | null, page: CampaignPage) =>
    [...campaignKeys.all, "recipients", id, outcome, page] as const,
};

/** How often a list or result with a send still going looks again. */
const LIVE_REFRESH_MS = 5_000;

export const isCampaignLive = (campaign: Pick<Campaign, "status" | "scheduledAt">) =>
  campaign.status === SEND_BATCH_STATUS.Sending ||
  (campaign.status === SEND_BATCH_STATUS.Queued && campaign.scheduledAt === null);

/**
 * A send that ends changes the CSKH rows — "Đã gửi Zalo" and, for a customer
 * not reached yet, "Đã liên hệ" (R-1024) — and Thống kê CSKH. Gửi refreshed
 * them before the job ran, so they are read again once it has.
 */
function useRefreshWhenSendEnds(campaigns: readonly Campaign[] | undefined) {
  const queryClient = useQueryClient();
  const live = useRef(new Set<string>());
  useEffect(() => {
    if (!campaigns) return;
    const ended = campaigns.some((c) => live.current.has(c.id) && !isCampaignLive(c));
    live.current = new Set(campaigns.filter(isCampaignLive).map((c) => c.id));
    if (ended) {
      void queryClient.invalidateQueries({ queryKey: careKeys.all });
      void queryClient.invalidateQueries({ queryKey: statsKeys.all });
    }
  }, [campaigns, queryClient]);
}

export function useCampaigns(page: CampaignPage) {
  const result = useQuery({
    queryKey: campaignKeys.list(page),
    queryFn: () => campaignApi.list(page),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.items.some(isCampaignLive) ? LIVE_REFRESH_MS : false),
  });
  useRefreshWhenSendEnds(result.data?.items);
  return result;
}

export function useCampaign(id: string) {
  const result = useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => campaignApi.get(id),
    refetchInterval: (query) => (query.state.data && isCampaignLive(query.state.data) ? LIVE_REFRESH_MS : false),
  });
  const campaign = result.data;
  useRefreshWhenSendEnds(useMemo(() => (campaign ? [campaign] : undefined), [campaign]));
  return result;
}

export function useCampaignRecipients(id: string, outcome: CampaignOutcome | null, page: CampaignPage, live: boolean) {
  return useQuery({
    queryKey: campaignKeys.recipients(id, outcome, page),
    queryFn: () => campaignApi.recipients(id, outcome, page),
    placeholderData: keepPreviousData,
    refetchInterval: live ? LIVE_REFRESH_MS : false,
  });
}

/** Tạm dừng changes the list, the result, "Lịch gửi đã hẹn", Thống kê CSKH and the CSKH rows' Zalo mark. */
export function useStopCampaign() {
  const queryClient = useQueryClient();
  const invalidateSends = useInvalidateAfterSend();
  return useMutation({
    mutationFn: campaignApi.stop,
    onSuccess: () => {
      invalidateSends();
      void queryClient.invalidateQueries({ queryKey: statsKeys.all });
    },
  });
}

/** "Xuất Excel danh sách lỗi": the failed and left-out customers of one send. */
export function useExportCampaignFailures() {
  return useMutation({ mutationFn: campaignApi.failures });
}
