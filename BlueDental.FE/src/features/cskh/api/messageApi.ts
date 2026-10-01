import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/** Mirrors BlueDental.Notifications.SmsTemplateDto. */
export interface SmsTemplateDto {
  id: string;
  name: string;
  content: string;
}

/** Mirrors BlueDental.Notifications.ClinicConfigureDto. */
export interface ClinicConfigureDto {
  id: string;
  module: string;
  name: string;
  isEnabled: boolean;
}

/** The reference fetches both lists with perPage=50. */
const PAGE_SIZE = 50;

const messageApi = {
  /** Mẫu tin nhắn — reference GET /sender-sms-templates?search=. */
  templates: (search: string): Promise<PagedResult<SmsTemplateDto>> =>
    api
      .get<PagedResult<SmsTemplateDto>>("/v1/app/sender-sms-templates", {
        params: { maxResultCount: PAGE_SIZE, filter: search || undefined },
      })
      .then((r) => r.data),

  /** Cấu hình — reference GET /clinic-configure?module=sms&isEnabled=true. */
  configures: (search: string): Promise<PagedResult<ClinicConfigureDto>> =>
    api
      .get<PagedResult<ClinicConfigureDto>>("/v1/app/clinic-configure", {
        params: {
          maxResultCount: PAGE_SIZE,
          module: "sms",
          isEnabled: true,
          filter: search || undefined,
        },
      })
      .then((r) => r.data),
};

export const messageKeys = {
  all: ["messaging"] as const,
  templates: (search: string) => [...messageKeys.all, "sms-templates", search] as const,
  configures: (search: string) => [...messageKeys.all, "sms-configures", search] as const,
};

export function useSmsTemplates(search: string, enabled = true) {
  return useQuery({
    queryKey: messageKeys.templates(search),
    queryFn: () => messageApi.templates(search),
    enabled,
  });
}

export function useSmsConfigures(search: string, enabled = true) {
  return useQuery({
    queryKey: messageKeys.configures(search),
    queryFn: () => messageApi.configures(search),
    enabled,
  });
}

/** One ZNS template as Zalo lists it — mirrors BlueDental.Zalo.ZaloTemplateDto. */
export interface ZaloTemplateDto {
  templateId: string;
  name: string;
  status: string | null;
  quality: string | null;
}

/** Mirrors BlueDental.Zalo.SendZaloMessageInput. */
export interface SendZaloMessageInput {
  careRecordId: string;
  templateId: string;
}

/**
 * Mẫu ZBS for the Gửi dialog: the branch's approved templates, read from Zalo
 * through the endpoint Công cụ ▸ Zalo OA ▸ Mẫu ZBS lists, under the same key
 * prefix so its Làm mới refreshes this too. Zalo filters to ENABLE itself
 * (status=1), so rejected or pending ones never crowd approved ones out of the
 * 100-row page. Zalo has no name search, so the keyword narrows on the client.
 */
export function useZaloTemplates(search: string, enabled = true) {
  return useQuery({
    queryKey: ["zalo-oa", "templates", { skipCount: 0, maxResultCount: 100, status: 1 }],
    queryFn: () =>
      api
        .get<PagedResult<ZaloTemplateDto>>("/v1/app/zalo/templates", {
          params: { skipCount: 0, maxResultCount: 100, status: 1 },
        })
        .then((r) => r.data),
    enabled,
    retry: false,
    select: (data) => {
      const needle = search.trim().toLowerCase();
      // Zalo refuses a send on any template that is not approved (ENABLE).
      const items = data.items.filter((item) => item.status?.toUpperCase() === "ENABLE");
      return needle ? items.filter((item) => item.name.toLowerCase().includes(needle)) : items;
    },
  });
}

/** Gửi ZBS — POST /zalo/messages; the server fills the template from the record. */
export function useSendZaloMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendZaloMessageInput) =>
      api.post<{ id: string; status: number }>("/v1/app/zalo/messages", input).then((r) => r.data),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["care-records"] });
      void queryClient.invalidateQueries({ queryKey: ["zalo-oa", "messages"] });
      void queryClient.invalidateQueries({ queryKey: ["zalo-oa", "stats"] });
    },
  });
}
