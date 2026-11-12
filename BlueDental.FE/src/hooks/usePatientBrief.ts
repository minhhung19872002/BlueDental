import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

/** Gender codes of BlueDental.PatientManagement.Gender. */
export const PATIENT_GENDER_CODE = { Male: 1, Female: 2, Other: 3, PreferNotToSay: 4 } as const;

/** What a sheet raised for a patient prints beside the name: the birth date and the gender code. */
export interface PatientBrief {
  /** `YYYY-MM-DD`, or null when none was recorded. */
  dateOfBirth: string | null;
  gender: number | null;
}

interface PatientRow {
  dateOfBirth?: string | null;
  gender?: number | null;
}

/**
 * One patient's birth date and gender, for screens outside the patient feature
 * (the Labo Phiếu yêu cầu's "Tuổi · Giới tính") — features do not import each
 * other, so the read lives here beside `usePatientOption`.
 */
export function usePatientBrief(patientId: string | undefined) {
  return useQuery({
    queryKey: ["patient-brief", patientId],
    queryFn: async (): Promise<PatientBrief> => {
      const row = await api.get<PatientRow>(`/v1/app/patients/${patientId}`).then((r) => r.data);
      return { dateOfBirth: row.dateOfBirth ?? null, gender: row.gender ?? null };
    },
    enabled: Boolean(patientId),
    staleTime: 5 * 60_000,
  });
}
