import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { receptionApi } from "./receptionApi";
import { staffApi } from "@/features/staff/api/staffApi";
import type { ReceptionFilter } from "../types/reception";

const PAGE_SIZE = 20;

export function useReceptionList(filter: ReceptionFilter = {}) {
  return useInfiniteQuery({
    queryKey: ["receptions", filter],
    queryFn: ({ pageParam = 0 }) =>
      receptionApi.getList(filter, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
}

export function useReceptionMetrics(filter: ReceptionFilter = {}) {
  return useQuery({
    queryKey: ["receptionMetrics", filter],
    queryFn: () => receptionApi.getMetrics(filter),
  });
}

export function useReceptionDoctors(branchId?: string) {
  return useQuery({
    queryKey: ["receptionDoctors", branchId],
    queryFn: async () => {
      const result = await staffApi.list({ maxResultCount: 50, isActive: true, branchId });
      return result.items.map((s) => ({
        id: s.id,
        name: s.name ?? s.userName ?? "",
        title: s.roleNames[0] ?? "Bác sĩ",
        branchIds: s.branchIds,
      }));
    },
  });
}
