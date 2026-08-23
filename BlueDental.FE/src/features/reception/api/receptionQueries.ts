import { useQuery } from "@tanstack/react-query";
import { receptionApi } from "./receptionApi";
import { staffApi } from "@/features/staff/api/staffApi";
import type { ReceptionFilter } from "../types/reception";
import { t } from "@/lib/i18n";

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
      const result = await staffApi.list({ maxResultCount: 50, isActive: true });

      return result.items.map((s) => ({
        id: s.id,
        // Identity may hold no display name, so fall back to the login name.
        name: s.fullName || s.userName,
        title: s.roleNames[0] ?? t("Bác sĩ"),
      }));
    },
  });
}
