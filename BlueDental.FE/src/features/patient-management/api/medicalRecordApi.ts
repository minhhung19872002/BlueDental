import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/**
 * Bệnh án — the sheets a patient's record is made of.
 *
 * The reference reads them per patient behind
 * `GET /patient-medical-record/files/{patientId}`; BlueDental exposes the same
 * collection as an ordinary branch-scoped list. See docs/clone/api.md.
 */

/** Mirrors BlueDental.PatientManagement.MedicalRecordForm. */
export const MEDICAL_RECORD_FORM = {
  Cover: 1,
  OutpatientDental: 2,
  Orthodontic: 3,
  GeneralConsultation: 4,
  TreatmentConsent: 5,
  SurgeryConsent: 6,
  SurgeryRecord: 7,
  TreatmentFollowUp: 8,
  CareSheet: 9,
} as const;

export type MedicalRecordForm =
  (typeof MEDICAL_RECORD_FORM)[keyof typeof MEDICAL_RECORD_FORM];

export interface PatientMedicalRecordDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  form: MedicalRecordForm;
  title: string;
  sortOrder: number;
  /** The filled cells, as JSON. Null until the clinic writes on the sheet. */
  content: string | null;
  creationTime: string;
  lastModificationTime: string | null;
}

const BASE = "/v1/app/patient-medical-records";

const medicalRecordApi = {
  list: (patientId: string): Promise<PagedResult<PatientMedicalRecordDto>> =>
    api
      .get<PagedResult<PatientMedicalRecordDto>>(BASE, {
        params: { patientId, maxResultCount: 100 },
      })
      .then((r) => r.data),

  create: (input: {
    patientId: string;
    form: MedicalRecordForm;
    title: string;
  }): Promise<PatientMedicalRecordDto> =>
    api.post<PatientMedicalRecordDto>(BASE, input).then((r) => r.data),

  update: (
    id: string,
    input: { title?: string; content?: string | null },
  ): Promise<PatientMedicalRecordDto> =>
    api.put<PatientMedicalRecordDto>(`${BASE}/${id}`, input).then((r) => r.data),

  remove: (id: string): Promise<void> => api.delete(`${BASE}/${id}`).then(() => undefined),
};

export const medicalRecordKeys = {
  all: ["patient-medical-records"] as const,
  list: (patientId: string) => [...medicalRecordKeys.all, patientId] as const,
};

export function usePatientMedicalRecords(patientId: string) {
  return useQuery({
    queryKey: medicalRecordKeys.list(patientId),
    queryFn: () => medicalRecordApi.list(patientId),
    enabled: Boolean(patientId),
  });
}

/** Every write refreshes the patient's own stack of sheets. */
function useRecordMutation<TVariables, TData>(
  patientId: string,
  fn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: medicalRecordKeys.list(patientId) }),
  });
}

export function useAddMedicalRecord(patientId: string) {
  return useRecordMutation(patientId, (input: { form: MedicalRecordForm; title: string }) =>
    medicalRecordApi.create({ patientId, ...input }),
  );
}

export function useSaveMedicalRecord(patientId: string) {
  return useRecordMutation(
    patientId,
    (input: { id: string; content: string | null }) =>
      medicalRecordApi.update(input.id, { content: input.content }),
  );
}

/** The pencil on a sheet card: its title, nothing else. */
export function useRenameMedicalRecord(patientId: string) {
  return useRecordMutation(patientId, (input: { id: string; title: string }) =>
    medicalRecordApi.update(input.id, { title: input.title }),
  );
}

export function useDeleteMedicalRecord(patientId: string) {
  return useRecordMutation(patientId, (id: string) => medicalRecordApi.remove(id));
}
