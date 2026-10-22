import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { t } from "@/lib/i18n";
import type { CareType } from "./careApi";

/** Matches BlueDental.Tools.MessageChannelType. */
export const MESSAGE_CHANNEL = { Sms: 0, Zalo: 1, Email: 2 } as const;
export type MessageChannel = (typeof MESSAGE_CHANNEL)[keyof typeof MESSAGE_CHANNEL];

/** List order of the channel pills and the editor's cards (BA: "Sort theo Kênh"). */
export const MESSAGE_CHANNELS: readonly MessageChannel[] = [
  MESSAGE_CHANNEL.Sms,
  MESSAGE_CHANNEL.Zalo,
  MESSAGE_CHANNEL.Email,
];

export const channelLabels = (): Record<MessageChannel, string> => ({
  [MESSAGE_CHANNEL.Sms]: t("CSKH:Channel:Sms"),
  [MESSAGE_CHANNEL.Zalo]: t("CSKH:Channel:Zalo"),
  [MESSAGE_CHANNEL.Email]: t("CSKH:Channel:Email"),
});

/** Mirrors BlueDental.Tools.MessageTemplateConsts. */
export const MESSAGE_TEMPLATE_LIMITS = { name: 200, subject: 200 } as const;

/** Matches BlueDental.Tools.MessageTemplateStatus. */
export const TEMPLATE_STATUS = { Draft: 0, Ready: 1, PendingApproval: 2, Rejected: 3, Disabled: 4 } as const;
export type TemplateStatus = (typeof TEMPLATE_STATUS)[keyof typeof TEMPLATE_STATUS];

/** Matches BlueDental.Tools.MessageVariableGroup. */
export const VARIABLE_GROUP = { Customer: 1, Appointment: 2, Treatment: 3, System: 4 } as const;
export type VariableGroup = (typeof VARIABLE_GROUP)[keyof typeof VARIABLE_GROUP];

/** Matches BlueDental.Tools.MessageVariableWhenEmpty. */
export const WHEN_EMPTY = { UseFallback: 1, SkipCustomer: 2, AlwaysPresent: 3 } as const;
export type WhenEmpty = (typeof WHEN_EMPTY)[keyof typeof WHEN_EMPTY];

/** Mirrors BlueDental.CustomerCare.Messaging.SmsMeasureDto. */
export interface SmsMeasure {
  characters: number;
  segments: number;
  perMessage: number;
  unicode: boolean;
}

/** Mirrors BlueDental.CustomerCare.Messaging.MessageTemplateDto. */
export interface MessageTemplateDto {
  id: string;
  name: string;
  content: string;
  channel: MessageChannel;
  purpose: CareType | null;
  status: TemplateStatus;
  subject: string | null;
  externalTemplateId: string | null;
  paramMap: Record<string, string>;
  removeDiacritics: boolean;
  variables: string[];
  sentCount: number;
  lastUsedAt: string | null;
  measure: SmsMeasure | null;
  creationTime: string;
  lastModificationTime: string | null;
}

export interface MessageTemplateList {
  items: MessageTemplateDto[];
  allCount: number;
  smsCount: number;
  zaloCount: number;
  emailCount: number;
}

export interface TemplateListFilter {
  channel: MessageChannel | null;
  purpose: CareType | null;
  filter: string;
}

/** Mirrors SaveMessageTemplateInput; `publish` = Lưu mẫu, otherwise Lưu nháp. */
export interface SaveTemplateInput {
  publish: boolean;
  name: string;
  purpose: CareType | null;
  content: string | null;
  subject: string | null;
  externalTemplateId: string | null;
  paramMap: Record<string, string> | null;
  removeDiacritics: boolean;
}

export interface PreviewTemplateInput {
  channel: MessageChannel;
  content: string | null;
  subject: string | null;
  paramMap: Record<string, string> | null;
  removeDiacritics: boolean;
  patientId: string | null;
}

export interface MessagePreview {
  text: string;
  subject: string | null;
  params: { name: string; value: string }[];
  missing: string[];
  unknown: string[];
  measure: SmsMeasure | null;
  isSample: boolean;
}

export interface SampleCustomer {
  patientId: string | null;
  name: string | null;
  code: string | null;
}

export interface MessageVariable {
  key: string;
  group: VariableGroup;
  example: string;
  whenEmpty: WhenEmpty;
  fallback: string | null;
  isCommon: boolean;
}

/** Mirrors BlueDental.Zalo.ZaloTemplateDto / ZaloTemplateDetailDto. */
export interface ZnsTemplate {
  templateId: string;
  name: string;
  status: string | null;
  quality: string | null;
}

export interface ZnsTemplateParam {
  name: string;
  required: boolean;
  type: string | null;
  maxLength: number | null;
  minLength: number | null;
  acceptNull: boolean;
}

export interface ZnsTemplateDetail extends ZnsTemplate {
  previewUrl: string | null;
  params: ZnsTemplateParam[];
}

export interface SyncZaloStatusResult {
  connected: boolean;
  updated: number;
  error: string | null;
}

const BASE = "/v1/app/message-templates";

const templateApi = {
  list: (f: TemplateListFilter) =>
    api
      .get<MessageTemplateList>(BASE, {
        params: { channel: f.channel ?? undefined, purpose: f.purpose ?? undefined, filter: f.filter || undefined },
      })
      .then((r) => r.data),
  get: (id: string) => api.get<MessageTemplateDto>(`${BASE}/${id}`).then((r) => r.data),
  create: (input: SaveTemplateInput & { channel: MessageChannel }) =>
    api.post<MessageTemplateDto>(BASE, input).then((r) => r.data),
  update: (id: string, input: SaveTemplateInput) =>
    api.put<MessageTemplateDto>(`${BASE}/${id}`, input).then((r) => r.data),
  duplicate: (id: string) => api.post<MessageTemplateDto>(`${BASE}/${id}/duplicate`).then((r) => r.data),
  variables: () => api.get<MessageVariable[]>(`${BASE}/variables`).then((r) => r.data),
  sampleCustomer: (exceptPatientId: string | null) =>
    api
      .get<SampleCustomer>(`${BASE}/sample-customer`, { params: { exceptPatientId: exceptPatientId ?? undefined } })
      .then((r) => r.data),
  preview: (input: PreviewTemplateInput) => api.post<MessagePreview>(`${BASE}/preview`, input).then((r) => r.data),
  znsTemplates: () => api.get<ZnsTemplate[]>(`${BASE}/zns-templates`).then((r) => r.data),
  znsTemplate: (id: string) =>
    api.get<ZnsTemplateDetail>(`${BASE}/zns-templates/${encodeURIComponent(id)}`).then((r) => r.data),
  syncZaloStatus: () => api.post<SyncZaloStatusResult>(`${BASE}/sync-zalo-status`).then((r) => r.data),
};

export const templateKeys = {
  all: ["message-templates"] as const,
  list: (f: TemplateListFilter) => [...templateKeys.all, "list", f] as const,
  detail: (id: string) => [...templateKeys.all, "detail", id] as const,
  variables: () => [...templateKeys.all, "variables"] as const,
  sample: (exceptPatientId: string | null) => [...templateKeys.all, "sample", exceptPatientId] as const,
  preview: (input: PreviewTemplateInput) => [...templateKeys.all, "preview", input] as const,
  zns: () => [...templateKeys.all, "zns"] as const,
  znsDetail: (id: string) => [...templateKeys.all, "zns", id] as const,
};

export function useMessageTemplates(filter: TemplateListFilter) {
  return useQuery({
    queryKey: templateKeys.list(filter),
    queryFn: () => templateApi.list(filter),
    placeholderData: keepPreviousData,
  });
}

export function useMessageTemplate(id: string | undefined) {
  return useQuery({
    queryKey: templateKeys.detail(id ?? ""),
    queryFn: () => templateApi.get(id ?? ""),
    enabled: !!id,
  });
}

/** The fixed library never changes while the app runs. */
export function useMessageVariables() {
  return useQuery({ queryKey: templateKeys.variables(), queryFn: templateApi.variables, staleTime: Infinity });
}

export function useSampleCustomer(exceptPatientId: string | null) {
  return useQuery({
    queryKey: templateKeys.sample(exceptPatientId),
    queryFn: () => templateApi.sampleCustomer(exceptPatientId),
    staleTime: Infinity,
  });
}

export function useTemplatePreview(input: PreviewTemplateInput, enabled: boolean) {
  return useQuery({
    queryKey: templateKeys.preview(input),
    queryFn: () => templateApi.preview(input),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useZnsTemplates(enabled: boolean) {
  return useQuery({ queryKey: templateKeys.zns(), queryFn: templateApi.znsTemplates, enabled, retry: false });
}

export function useZnsTemplate(id: string | null) {
  return useQuery({
    queryKey: templateKeys.znsDetail(id ?? ""),
    queryFn: () => templateApi.znsTemplate(id ?? ""),
    enabled: !!id,
    retry: false,
  });
}

function useTemplateMutation<TVariables>(fn: (variables: TVariables) => Promise<MessageTemplateDto>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (saved) => {
      queryClient.setQueryData(templateKeys.detail(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: [...templateKeys.all, "list"] });
    },
  });
}

export function useCreateTemplate() {
  return useTemplateMutation(templateApi.create);
}

export function useUpdateTemplate() {
  return useTemplateMutation(({ id, ...input }: SaveTemplateInput & { id: string }) => templateApi.update(id, input));
}

export function useDuplicateTemplate() {
  return useTemplateMutation(templateApi.duplicate);
}

/** Reads Zalo's review status into the list; refreshes the list when something changed. */
export function useSyncZaloStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: templateApi.syncZaloStatus,
    onSuccess: (result) => {
      if (result.updated > 0) void queryClient.invalidateQueries({ queryKey: [...templateKeys.all, "list"] });
    },
  });
}
