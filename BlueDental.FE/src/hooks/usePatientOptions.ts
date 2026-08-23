import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";

/**
 * Patient lookups shared by feature folders.
 *
 * Reception and the appointment editor both need to pick an existing patient,
 * but features do not import each other, so the read-only lookup lives here.
 */
export interface PatientOption {
  id: string;
  name: string;
  code: string;
  phone: string;
}

interface PatientResponse {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  contact?: { phoneNumber?: string | null } | null;
  phoneNumber?: string | null;
}

/**
 * @param keyword server-side search over name, code and phone; omit for the
 * most recent patients.
 */
export function usePatientOptions(keyword?: string) {
  const branchId = useCurrentBranchId();

  return useQuery({
    queryKey: ["patient-options", branchId, keyword ?? ""],
    queryFn: async (): Promise<PatientOption[]> => {
      const page = await api
        .get<PagedResult<PatientResponse>>("/v1/app/patients", {
          params: { branchId, filter: keyword || undefined, maxResultCount: 30 },
        })
        .then((r) => r.data);

      return page.items.map((dto) => ({
        id: dto.id,
        name: `${dto.lastName} ${dto.firstName}`.trim(),
        code: dto.patientCode,
        phone: dto.contact?.phoneNumber ?? dto.phoneNumber ?? "",
      }));
    },
  });
}
