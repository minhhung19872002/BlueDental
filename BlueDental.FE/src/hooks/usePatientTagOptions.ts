import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter } from "@/lib/clinicBranch";

/**
 * The Thẻ hồ sơ catalog's active tags, as options for a picker.
 *
 * Shared rather than feature-local: the CSKH grouping filter and the patient
 * list both pick from this catalog, and a feature may not reach into the
 * taxonomy feature's folder.
 */
export interface PatientTagOption {
  value: string;
  label: string;
  /** Tag colour from the Thẻ hồ sơ catalog; pickers render the option as a chip. */
  color: string;
}

export function usePatientTagOptions() {
  const clinicBranchId = useBranchFilter();

  return useQuery({
    queryKey: ["patient-tag-options", clinicBranchId],
    queryFn: async (): Promise<PatientTagOption[]> => {
      const response = await api.get("/v1/app/patient-tags", {
        params: { ClinicBranchId: clinicBranchId, IsActive: true, MaxResultCount: 200 },
      });

      const items: { id: string; name: string; color: string }[] = response.data?.items ?? [];
      return items.map((row) => ({ value: row.id, label: row.name, color: row.color }));
    },
    // Tags change rarely, and more than one screen asks for the same list.
    staleTime: 5 * 60 * 1000,
  });
}
