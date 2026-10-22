import { keepPreviousData, skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { careKeys, type CareType } from "./careApi";
import { templateKeys, type MessageChannel, type MessagePreview, type MessageTemplateDto } from "./templateApi";

/** Matches BlueDental.Tools.MessageRecipientSource. */
export const RECIPIENT_SOURCE = { CareList: 0, Individual: 1 } as const;
export type RecipientSource = (typeof RECIPIENT_SOURCE)[keyof typeof RECIPIENT_SOURCE];

/** Matches BlueDental.Tools.MessageSkipReason. */
export const SKIP_REASON = { NoContact: 1, RecentlySent: 2, MissingVariable: 3 } as const;
export type SkipReason = (typeof SKIP_REASON)[keyof typeof SKIP_REASON];

/** Matches BlueDental.Tools.MessageSendBatchStatus. */
export const SEND_BATCH_STATUS = { Queued: 0, Sending: 1, Completed: 2, Cancelled: 3 } as const;
export type SendBatchStatus = (typeof SEND_BATCH_STATUS)[keyof typeof SEND_BATCH_STATUS];

/** Mirrors BlueDental.CustomerCare.Messaging.MessageSendLimits. */
export const SEND_LIMITS = { maxRecipients: 5000, maxCustomerResults: 20 } as const;

export interface SendChannelInfo {
  channel: MessageChannel;
  /** False shows "Chưa kết nối gửi": only Zalo sends, once the branch's OA is linked. */
  connected: boolean;
  readyCount: number;
}

export interface SendTemplates {
  items: MessageTemplateDto[];
  channels: SendChannelInfo[];
}

export interface SendListCount {
  type: CareType;
  count: number;
}

export interface SendPeriod {
  fromDate: string;
  toDate: string;
}

/** Mirrors MessageRecipientsInput: a CSKH tab over a period, or customers picked one by one. */
export interface RecipientsInput {
  channel: MessageChannel;
  templateId: string | null;
  source: RecipientSource;
  careType: CareType | null;
  fromDate: string | null;
  toDate: string | null;
  patientIds: string[];
  /** The rows still on screen after "Xóa"; null keeps the whole list. */
  keys: string[] | null;
  skipRecentDuplicates: boolean;
}

export interface CreateSendInput extends RecipientsInput {
  /** "Hẹn giờ gửi"; null sends now. */
  scheduledAt: string | null;
}

export interface MessageRecipient {
  /** `p:` + patient id, or `a:` + booking id for a "Lịch tạm" guest. */
  key: string;
  patientId: string | null;
  careRecordId: string | null;
  name: string;
  code: string | null;
  phone: string | null;
  email: string | null;
  dentistName: string | null;
  receivedAt: string | null;
  skipReason: SkipReason | null;
  missing: string[];
}

export interface RecipientList {
  items: MessageRecipient[];
  pricePerMessage: number | null;
}

export interface SendPreviewInput {
  templateId: string;
  patientId: string | null;
  appointmentId: string | null;
}

export interface SendCustomer {
  patientId: string;
  name: string;
  code: string;
  phone: string | null;
}

export interface SendBatch {
  id: string;
  channel: MessageChannel;
  templateId: string;
  templateName: string;
  source: RecipientSource;
  careType: CareType | null;
  fromDate: string | null;
  toDate: string | null;
  skipRecentDuplicates: boolean;
  scheduledAt: string | null;
  status: SendBatchStatus;
  recipientCount: number;
  skippedCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  creationTime: string;
  completedAt: string | null;
}

const BASE = "/v1/app/message-sends";

const sendApi = {
  templates: () => api.get<SendTemplates>(`${BASE}/templates`).then((r) => r.data),
  lists: (period: SendPeriod) => api.get<SendListCount[]>(`${BASE}/lists`, { params: period }).then((r) => r.data),
  recipients: (input: RecipientsInput) => api.post<RecipientList>(`${BASE}/recipients`, input).then((r) => r.data),
  preview: (input: SendPreviewInput) => api.post<MessagePreview>(`${BASE}/preview`, input).then((r) => r.data),
  customers: (filter: string) =>
    api.get<SendCustomer[]>(`${BASE}/customers`, { params: { filter: filter || undefined } }).then((r) => r.data),
  create: (input: CreateSendInput) => api.post<SendBatch>(BASE, input).then((r) => r.data),
  batches: (status: SendBatchStatus | null) =>
    api.get<SendBatch[]>(BASE, { params: { status: status ?? undefined } }).then((r) => r.data),
  cancel: (id: string) => api.post<SendBatch>(`${BASE}/${id}/cancel`).then((r) => r.data),
  test: (input: SendPreviewInput) => api.post<{ phone: string }>(`${BASE}/test`, input).then((r) => r.data),
};

export const sendKeys = {
  all: ["message-sends"] as const,
  lists: (period: SendPeriod) => [...sendKeys.all, "lists", period] as const,
  recipients: (input: RecipientsInput) => [...sendKeys.all, "recipients", input] as const,
  preview: (input: SendPreviewInput) => [...sendKeys.all, "preview", input] as const,
  customers: (filter: string) => [...sendKeys.all, "customers", filter] as const,
  batches: (status: SendBatchStatus | null) => [...sendKeys.all, "batches", status] as const,
};

export function useSendTemplates() {
  return useQuery({ queryKey: templateKeys.sendable(), queryFn: sendApi.templates });
}

/** The 10 list chips with their counts over the period on screen. */
export function useSendLists(period: SendPeriod, enabled: boolean) {
  return useQuery({
    queryKey: sendKeys.lists(period),
    queryFn: () => sendApi.lists(period),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/**
 * POST read: a picked list can be too long for a query string. The rows on
 * screen stay while the next read loads, unless the source changed: a care
 * list must not show up as unticked "Khách lẻ" rows.
 */
export function useRecipients(input: RecipientsInput, enabled: boolean) {
  return useQuery({
    queryKey: sendKeys.recipients(input),
    queryFn: () => sendApi.recipients(input),
    enabled,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2].source === input.source ? previous : undefined,
  });
}

export function useSendPreview(input: SendPreviewInput | null) {
  return useQuery({
    queryKey: sendKeys.preview(input ?? { templateId: "", patientId: null, appointmentId: null }),
    queryFn: input ? () => sendApi.preview(input) : skipToken,
    placeholderData: keepPreviousData,
  });
}

export function useSendCustomers(filter: string, enabled: boolean) {
  return useQuery({
    queryKey: sendKeys.customers(filter),
    queryFn: () => sendApi.customers(filter),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSendBatches(status: SendBatchStatus | null) {
  return useQuery({ queryKey: sendKeys.batches(status), queryFn: () => sendApi.batches(status) });
}

/** A send changes "đã gửi", the "Đã nhận" column and the CSKH rows' Zalo mark. */
function useInvalidateAfterSend() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: sendKeys.all });
    void queryClient.invalidateQueries({ queryKey: templateKeys.all });
    void queryClient.invalidateQueries({ queryKey: careKeys.all });
  };
}

export function useCreateSend() {
  const invalidate = useInvalidateAfterSend();
  return useMutation({ mutationFn: sendApi.create, onSuccess: invalidate });
}

export function useCancelSend() {
  const invalidate = useInvalidateAfterSend();
  return useMutation({ mutationFn: sendApi.cancel, onSuccess: invalidate });
}

export function useSendTest() {
  return useMutation({ mutationFn: sendApi.test });
}
