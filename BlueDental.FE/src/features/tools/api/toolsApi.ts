import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

// ── Call Assignment ───────────────────────────────────────────────────────

export interface CallAssignmentDto {
  id: string;
  patientId: string;
  staffId: string;
  patientName: string;
  phoneNumber: string;
  staffName?: string;
  notes?: string;
  status: number;
  calledAt?: string;
  creationTime: string;
}

export interface CreateCallAssignmentDto {
  patientId: string;
  staffId: string;
  patientName: string;
  phoneNumber: string;
  notes?: string;
}

export function useCallAssignments(params?: { status?: number; staffId?: string; filter?: string }) {
  return useQuery({
    queryKey: ["call-assignments", params],
    queryFn: () =>
      api
        .get<PagedResult<CallAssignmentDto>>("/v1/app/tools/call-assignments", {
          params: { ...params, maxResultCount: 100 },
        })
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

export function useUpdateCallAssignmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: number; notes?: string }) =>
      api.put<CallAssignmentDto>(`/v1/app/tools/call-assignments/${id}/status`, { status, notes }).then((r) => r.data),
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

export interface CallLogDto {
  id: string;
  patientId?: string;
  staffId?: string;
  patientName: string;
  phoneNumber: string;
  staffName?: string;
  durationSeconds: number;
  direction: number;
  status: number;
  notes?: string;
  creationTime: string;
}

export function useCallLogs(params?: { direction?: number; status?: number; filter?: string }) {
  return useQuery({
    queryKey: ["call-logs", params],
    queryFn: () =>
      api
        .get<PagedResult<CallLogDto>>("/v1/app/tools/call-logs", {
          params: { ...params, maxResultCount: 100 },
        })
        .then((r) => r.data),
  });
}

export function useDeleteCallLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/app/tools/call-logs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call-logs"] }),
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
