import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

/**
 * Staff, as options for a picker.
 *
 * Lives here rather than in the staff feature because more than one feature
 * needs it — Vận hành filters several of its reports by who did the work — and
 * a feature may not reach into another feature's folder.
 */
export interface StaffOption {
  value: string;
  label: string;
}

interface StaffRow {
  id: string;
  name: string | null;
  surname: string | null;
  userName: string;
}

export function useStaffOptions() {
  return useQuery({
    queryKey: ["staff-options"],
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get("/v1/app/staff", {
        params: { MaxResultCount: 200 },
      });

      const items: StaffRow[] = response.data?.items ?? [];

      return items.map((row) => ({
        value: row.id,
        label: [row.surname, row.name].filter(Boolean).join(" ").trim() || row.userName,
      }));
    },
    // Staff change rarely and every report tab asks for the same list.
    staleTime: 5 * 60 * 1000,
  });
}
