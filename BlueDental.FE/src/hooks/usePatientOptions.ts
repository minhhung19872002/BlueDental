import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";

/**
 * Patient lookups shared by feature folders.
 *
 * Reception, the appointment editor, CSKH and Labo all need to pick an existing
 * patient, but features do not import each other, so the read-only lookup lives
 * here.
 */
export interface PatientOption {
  id: string;
  name: string;
  code: string;
  phone: string;
}

/**
 * The three fields a picker needs out of
 * `BlueDental.PatientManagement.PatientListItemDto`. The name arrives already
 * composed in Vietnamese order — this used to rebuild it from `lastName` and
 * `firstName`, which the list stopped sending, and every picker in the app
 * quietly went blank.
 */
interface PatientRow {
  id: string;
  patientCode: string;
  fullName: string;
  phoneNumber: string | null;
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
        .get<PagedResult<PatientRow>>("/v1/app/patients", {
          params: { branchId, filter: keyword || undefined, maxResultCount: 30 },
        })
        .then((r) => r.data);

      return page.items.map((row) => ({
        id: row.id,
        name: row.fullName,
        code: row.patientCode,
        phone: row.phoneNumber ?? "",
      }));
    },
  });
}
