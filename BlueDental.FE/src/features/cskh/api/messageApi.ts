import { useQuery } from "@tanstack/react-query";
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

/** Zalo channel of /tools/message-templates — what Công cụ ▸ Zalo OA calls ZBS. */
const ZALO_CHANNEL = 1;

/** The fields the Gửi ZBS select reads off MessageTemplateDto. */
export interface ZaloTemplateDto {
  id: string;
  name: string;
}

/**
 * Same list Công cụ ▸ Zalo OA ▸ Mẫu ZBS manages, and deliberately the same
 * query key that page uses, so a template saved there refreshes this dropdown.
 */
export function useZaloTemplates(search: string, enabled = true) {
  return useQuery({
    queryKey: ["message-templates", ZALO_CHANNEL, search || undefined],
    queryFn: () =>
      api
        .get<PagedResult<ZaloTemplateDto>>("/v1/app/tools/message-templates", {
          params: {
            channel: ZALO_CHANNEL,
            filter: search || undefined,
            maxResultCount: PAGE_SIZE,
          },
        })
        .then((r) => r.data),
    enabled,
  });
}
