import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adaptXrayInboxItem, adaptXraySuggestion } from "./xrayInboxAdapters";
import { xrayInboxHttp, type XrayInboxListQuery } from "./xrayInboxApi";

export const xrayInboxKeys = {
  all: ["xray-inbox"] as const,
  list: (query: XrayInboxListQuery) => [...xrayInboxKeys.all, "list", query] as const,
  count: (clinicBranchId: string | undefined) =>
    [...xrayInboxKeys.all, "count", clinicBranchId ?? "all"] as const,
  suggestions: (id: string) => [...xrayInboxKeys.all, "suggestions", id] as const,
};

/** One page of "Ảnh chưa gán hồ sơ", newest first. */
export function useXrayInboxList(query: XrayInboxListQuery) {
  return useQuery({
    queryKey: xrayInboxKeys.list(query),
    queryFn: async () => {
      const page = await xrayInboxHttp.list(query);
      return { totalCount: page.totalCount, items: page.items.map(adaptXrayInboxItem) };
    },
    placeholderData: keepPreviousData,
  });
}

/** The menu badge: re-asked every minute, since the X-ray PC sends at any time. */
export function useXrayInboxCount(clinicBranchId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: xrayInboxKeys.count(clinicBranchId),
    queryFn: () => xrayInboxHttp.count(clinicBranchId),
    enabled,
    refetchInterval: 60_000,
  });
}

/** Records whose code or name and birth year the file named; staff still confirm. */
export function useXraySuggestions(id: string | null) {
  return useQuery({
    queryKey: xrayInboxKeys.suggestions(id ?? ""),
    queryFn: async () => (await xrayInboxHttp.suggestions(id ?? "")).map(adaptXraySuggestion),
    enabled: id !== null,
  });
}
