import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter } from "@/lib/clinicBranch";

/**
 * The service catalog's groups, as options for a picker.
 *
 * Shared rather than feature-local: the Vận hành reports filter by service
 * group, and a feature may not reach into the catalog feature's folder.
 */
export interface ServiceGroupOption {
  value: string;
  label: string;
}

export function useServiceGroupOptions() {
  const clinicBranchId = useBranchFilter();

  return useQuery({
    queryKey: ["service-group-options", clinicBranchId],
    queryFn: async (): Promise<ServiceGroupOption[]> => {
      const response = await api.get("/v1/app/taxonomies", {
        params: { ClinicBranchId: clinicBranchId, Group: "care_service", MaxResultCount: 200 },
      });

      const items: { id: string; name: string }[] = response.data?.items ?? [];
      return items.map((row) => ({ value: row.id, label: row.name }));
    },
    // Groups change rarely, and two reports ask for the same list.
    staleTime: 5 * 60 * 1000,
  });
}
