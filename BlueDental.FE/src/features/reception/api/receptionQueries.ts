import { useQuery } from "@tanstack/react-query";
import { receptionApi, MOCK_DOCTORS } from "./receptionApi";
import { staffApi } from "@/features/staff/api/staffApi";
import type { ReceptionFilter } from "../types/reception";

export function useReceptionList(filter: ReceptionFilter = {}) {
  return useQuery({
    queryKey: ["receptions", filter],
    queryFn: () => receptionApi.getList(filter),
  });
}

export function useReceptionMetrics() {
  return useQuery({
    queryKey: ["receptionMetrics"],
    queryFn: () => receptionApi.getMetrics(),
  });
}

export function useReceptionDoctors() {
  return useQuery({
    queryKey: ["receptionDoctors"],
    queryFn: async () => {
      try {
        const result = await staffApi.list({ maxResultCount: 50, isActive: true });
        if (result.items.length > 0) {
          return result.items.map((s) => ({
            id: s.id,
            name: s.name,
            title: s.roleNames[0] ?? "Bác sĩ",
          }));
        }
      } catch {
        // Fallthrough to mock when BE unreachable
      }
      return MOCK_DOCTORS;
    },
  });
}
