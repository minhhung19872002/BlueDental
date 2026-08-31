import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

// ── Call Configuration ────────────────────────────────────────────────────

// "Mã bí mật" is write-only: the server never sends it back, so the DTO the
// list reads has no secretKey field at all.
export interface CallConfigurationDto {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  provider: number;
  apiKey: string;
  isActive: boolean;
  creationTime: string;
}

export interface CreateCallConfigurationDto {
  branchId: string;
  name: string;
  provider: number;
  apiKey: string;
  secretKey: string;
  isActive: boolean;
}

export interface UpdateCallConfigurationDto {
  name: string;
  provider: number;
  apiKey: string;
  /** Blank keeps the stored secret — the client never sees it. */
  secretKey?: string;
  isActive: boolean;
}

export function useCallConfigurations(params?: {
  filter?: string;
  skipCount?: number;
  maxResultCount?: number;
}) {
  return useQuery({
    queryKey: ["call-configurations", params],
    queryFn: () =>
      api
        .get<PagedResult<CallConfigurationDto>>("/v1/app/tools/call-configurations", { params })
        .then((r) => r.data),
  });
}

export function useCreateCallConfiguration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCallConfigurationDto) =>
      api.post<CallConfigurationDto>("/v1/app/tools/call-configurations", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call-configurations"] }),
  });
}

export function useUpdateCallConfiguration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCallConfigurationDto }) =>
      api.put<CallConfigurationDto>(`/v1/app/tools/call-configurations/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["call-configurations"] });
      // Assignments show the configuration's name and provider.
      void qc.invalidateQueries({ queryKey: ["call-assignments"] });
    },
  });
}

export function useDeleteCallConfiguration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/app/tools/call-configurations/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["call-configurations"] });
      void qc.invalidateQueries({ queryKey: ["call-assignments"] });
    },
  });
}

// ── Call Assignment ───────────────────────────────────────────────────────

/** A SIP extension handed to a staff member under one configuration. */
export interface CallAssignmentDto {
  id: string;
  sip: string;
  callConfigurationId: string;
  configurationName: string;
  staffId: string;
  staffName: string;
  provider: number;
  isActive: boolean;
  creationTime: string;
}

export interface CreateCallAssignmentDto {
  branchId: string;
  sip: string;
  callConfigurationId: string;
  staffId: string;
  isActive: boolean;
}

export interface UpdateCallAssignmentDto {
  sip: string;
  callConfigurationId: string;
  staffId: string;
  isActive: boolean;
}

export function useCallAssignments(params?: {
  filter?: string;
  skipCount?: number;
  maxResultCount?: number;
}) {
  return useQuery({
    queryKey: ["call-assignments", params],
    queryFn: () =>
      api
        .get<PagedResult<CallAssignmentDto>>("/v1/app/tools/call-assignments", { params })
        .then((r) => r.data),
  });
}

export function useCreateCallAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCallAssignmentDto) =>
      api.post<CallAssignmentDto>("/v1/app/tools/call-assignments", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call-assignments"] }),
  });
}

export function useUpdateCallAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCallAssignmentDto }) =>
      api.put<CallAssignmentDto>(`/v1/app/tools/call-assignments/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call-assignments"] }),
  });
}

export function useDeleteCallAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/app/tools/call-assignments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call-assignments"] }),
  });
}

// ── Call Log ──────────────────────────────────────────────────────────────

/** One PBX call, as the provider recorded it. Read-only in the reference. */
export interface CallLogDto {
  id: string;
  staffId?: string;
  staffName?: string;
  branchName: string;
  callCode: string;
  extensionCode?: string;
  phoneNumber: string;
  status: number;
  provider: number;
  calledAt: string;
}

export function useCallLogs(params?: {
  fromDate?: string;
  toDate?: string;
  staffId?: string;
  skipCount?: number;
  maxResultCount?: number;
}) {
  return useQuery({
    queryKey: ["call-logs", params],
    queryFn: () =>
      api
        .get<PagedResult<CallLogDto>>("/v1/app/tools/call-logs", { params })
        .then((r) => r.data),
  });
}

// ── Message Template ──────────────────────────────────────────────────────

export interface MessageTemplateDto {
  id: string;
  name: string;
  content: string;
  channel: number;
  category?: string;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateMessageTemplateDto {
  name: string;
  content: string;
  channel: number;
  category?: string;
}

export interface UpdateMessageTemplateDto {
  name: string;
  content: string;
  category?: string;
}

export function useMessageTemplates(channel: number, filter?: string) {
  return useQuery({
    queryKey: ["message-templates", channel, filter],
    queryFn: () =>
      api
        .get<PagedResult<MessageTemplateDto>>("/v1/app/tools/message-templates", {
          params: { channel, filter, maxResultCount: 100 },
        })
        .then((r) => r.data),
  });
}

export function useCreateMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMessageTemplateDto) =>
      api.post<MessageTemplateDto>("/v1/app/tools/message-templates", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message-templates"] }),
  });
}

export function useUpdateMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMessageTemplateDto }) =>
      api.put<MessageTemplateDto>(`/v1/app/tools/message-templates/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message-templates"] }),
  });
}

export function useDeleteMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/app/tools/message-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message-templates"] }),
  });
}

// ── Message Log ───────────────────────────────────────────────────────────

export interface MessageLogDto {
  id: string;
  patientId?: string;
  templateId?: string;
  recipientName: string;
  recipientPhone: string;
  content: string;
  channel: number;
  status: number;
  sentAt?: string;
  errorMessage?: string;
  creationTime: string;
}

export function useMessageLogs(channel: number, params?: { status?: number; filter?: string }) {
  return useQuery({
    queryKey: ["message-logs", channel, params],
    queryFn: () =>
      api
        .get<PagedResult<MessageLogDto>>("/v1/app/tools/message-logs", {
          params: { channel, ...params, maxResultCount: 100 },
        })
        .then((r) => r.data),
  });
}
