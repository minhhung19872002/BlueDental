import { useQuery } from "@tanstack/react-query";
import { staffApi, type GetStaffListInput } from "./staffApi";

export const staffKeys = {
  all: ["staff"] as const,
  lists: () => [...staffKeys.all, "list"] as const,
  list: (params: GetStaffListInput) => [...staffKeys.lists(), params] as const,
  detail: (id: string) => [...staffKeys.all, "detail", id] as const,
};

export function useStaffList(params: GetStaffListInput = {}) {
  return useQuery({
    queryKey: staffKeys.list(params),
    queryFn: () => staffApi.list(params),
  });
}

export function useStaff(id: string) {
  return useQuery({
    queryKey: staffKeys.detail(id),
    queryFn: () => staffApi.get(id),
    enabled: Boolean(id),
  });
}

/** Returns only dentists (staff with "Dentist" role) for calendar doctor columns */
export function useDentistList() {
  return useQuery({
    queryKey: [...staffKeys.lists(), "dentists"],
    queryFn: async () => {
      const result = await staffApi.list({ maxResultCount: 50, isActive: true });
      const dentists = result.items.filter((s) =>
        s.roleNames.some((r) => r.toLowerCase().includes("dentist") || r.toLowerCase().includes("bác sĩ"))
      );
      if (dentists.length === 0) return result.items.slice(0, 8);
      return dentists;
    },
  });
}
