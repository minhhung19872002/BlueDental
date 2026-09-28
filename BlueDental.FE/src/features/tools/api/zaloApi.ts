import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

// ── DTOs — mirror BlueDental.Zalo.ZaloOaDtos ──────────────────────────────

export type ZaloOaStatusText = "none" | "active" | "failed" | "expired";

/** Tokens never leave the server; the status only says whether there are any. */
export interface ZaloOaStatusDto {
  id: string | null;
  branchId: string;
  isConnected: boolean;
  isEnabled: boolean;
  status: ZaloOaStatusText;
  oaId: string | null;
  oaName: string | null;
  avatarUrl: string | null;
  packageName: string | null;
  connectedAt: string | null;
  lastRefreshedAt: string | null;
  accessTokenExpiresAt: string | null;
  lastError: string | null;
  hasBootstrapTokens: boolean;
  canConnect: boolean;
}

export interface ZaloTemplateDto {
  templateId: string;
  name: string;
  status: string | null;
  quality: string | null;
  createdAt: string | null;
  /** Comma-separated parameter names returned by the list endpoint (may be null for older templates). */
  listParams: string | null;
}

export interface ZaloTemplateParamDto {
  name: string;
  required: boolean;
  type: string | null;
  maxLength: number | null;
  minLength: number | null;
  acceptNull: boolean;
}

export interface ZaloTemplateDetailDto extends ZaloTemplateDto {
  previewUrl: string | null;
  price: number | null;
  timeoutMs: number | null;
  params: ZaloTemplateParamDto[];
}

export interface SendZaloMessageInput {
  patientId?: string;
  careRecordId?: string;
  phone?: string;
  templateId: string;
  templateData?: Record<string, string>;
}

/** MessageSendStatus on the server. */
export const ZALO_MESSAGE_STATUS = { Pending: 0, Sent: 1, Failed: 2, Delivered: 3 } as const;

export interface ZaloMessageDto {
  id: string;
  patientId: string | null;
  recipientName: string;
  recipientPhone: string;
  content: string;
  status: number;
  cost: number | null;
  sentAt: string | null;
  errorMessage: string | null;
  externalTemplateId: string | null;
  externalMessageId: string | null;
  creationTime: string;
  /** Name of the ZBS template used to send this message. */
  templateName: string | null;
}

export interface ZaloMessageStatsDto {
  total: number;
  success: number;
  failed: number;
}

export interface GetZaloTemplatesInput {
  skipCount?: number;
  maxResultCount?: number;
  status?: number;
}

export interface GetZaloMessagesInput {
  skipCount?: number;
  maxResultCount?: number;
  filter?: string;
  status?: number;
  succeeded?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

// ── Plain calls ───────────────────────────────────────────────────────────

const BASE = "/v1/app/zalo";

const zaloApi = {
  status: () => api.get<ZaloOaStatusDto>(`${BASE}/status`).then((r) => r.data),
  connectUrl: () => api.get<{ url: string }>(`${BASE}/connect-url`).then((r) => r.data),
  importBootstrap: () => api.post<ZaloOaStatusDto>(`${BASE}/bootstrap-import`).then((r) => r.data),
  setEnabled: (isEnabled: boolean) =>
    api.put<ZaloOaStatusDto>(`${BASE}/enabled`, { isEnabled }).then((r) => r.data),
  disconnect: () => api.delete(`${BASE}/connection`).then(() => undefined),
  refreshToken: () => api.post<ZaloOaStatusDto>(`${BASE}/refresh-token`).then((r) => r.data),
  templates: (params: GetZaloTemplatesInput) =>
    api.get<PagedResult<ZaloTemplateDto>>(`${BASE}/templates`, { params }).then((r) => r.data),
  templateDetail: (templateId: string) =>
    api.get<ZaloTemplateDetailDto>(`${BASE}/templates/${templateId}`).then((r) => r.data),
  send: (input: SendZaloMessageInput) =>
    api.post<ZaloMessageDto>(`${BASE}/messages`, input).then((r) => r.data),
  messages: (params: GetZaloMessagesInput) =>
    api.get<PagedResult<ZaloMessageDto>>(`${BASE}/messages`, { params }).then((r) => r.data),
  stats: () => api.get<ZaloMessageStatsDto>(`${BASE}/messages/stats`).then((r) => r.data),
};

export const zaloKeys = {
  all: ["zalo-oa"] as const,
  status: () => [...zaloKeys.all, "status"] as const,
  templates: (params: GetZaloTemplatesInput) => [...zaloKeys.all, "templates", params] as const,
  templateDetail: (id: string) => [...zaloKeys.all, "template", id] as const,
  messages: (params: GetZaloMessagesInput) => [...zaloKeys.all, "messages", params] as const,
  stats: () => [...zaloKeys.all, "stats"] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────

export function useZaloStatus() {
  return useQuery({ queryKey: zaloKeys.status(), queryFn: zaloApi.status });
}

/**
 * Mẫu ZBS comes straight from Zalo, so a refusal ("Chưa kết nối Zalo OA")
 * is the normal first answer; the screen shows it rather than retrying.
 */
export function useZaloTemplates(params: GetZaloTemplatesInput, enabled = true) {
  return useQuery({
    queryKey: zaloKeys.templates(params),
    queryFn: () => zaloApi.templates(params),
    enabled,
    retry: false,
  });
}

export function useZaloTemplateDetail(templateId: string | undefined) {
  return useQuery({
    queryKey: zaloKeys.templateDetail(templateId ?? ""),
    queryFn: () => zaloApi.templateDetail(templateId ?? ""),
    enabled: Boolean(templateId),
    retry: false,
  });
}

export function useZaloMessages(params: GetZaloMessagesInput) {
  return useQuery({ queryKey: zaloKeys.messages(params), queryFn: () => zaloApi.messages(params) });
}

export function useZaloMessageStats() {
  return useQuery({ queryKey: zaloKeys.stats(), queryFn: zaloApi.stats });
}

// ── Mutations ─────────────────────────────────────────────────────────────

function useConnectionMutation<TInput = void, TResult = unknown>(fn: (input: TInput) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: zaloKeys.all }),
  });
}

export function useZaloConnectUrl() {
  return useMutation({ mutationFn: zaloApi.connectUrl });
}

export function useImportZaloBootstrap() {
  return useConnectionMutation<void, ZaloOaStatusDto>(zaloApi.importBootstrap);
}

export function useSetZaloEnabled() {
  return useConnectionMutation(zaloApi.setEnabled);
}

export function useDisconnectZalo() {
  return useConnectionMutation<void, undefined>(zaloApi.disconnect);
}

export function useRefreshZaloToken() {
  return useConnectionMutation<void, ZaloOaStatusDto>(zaloApi.refreshToken);
}

/** The failed send is stored too, so the list and counters refresh either way. */
export function useSendZaloMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: zaloApi.send,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [...zaloKeys.all, "messages"] });
      void qc.invalidateQueries({ queryKey: zaloKeys.stats() });
    },
  });
}
