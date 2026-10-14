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

  uploadDrawing: (id: string, png: Blob): Promise<MedicalRecordDrawingDto> => {
    const form = new FormData();
    form.append("file", png, "drawing.png");
    return api.post<MedicalRecordDrawingDto>(`${BASE}/${id}/drawings`, form).then((r) => r.data);
  },
};

/** A drawing on a sheet, stored on its own; the sheet links to it by `url`. */
export interface MedicalRecordDrawingDto {
  id: string;
  url: string;
}

/**
 * A drawing made since the sheet was last saved: still the PNG itself, as the
 * drawing pad hands it over. Matches drawing/drawingField.ts.
 */
const UNSAVED_DRAWING = /data:image\/png;base64,[A-Za-z0-9+/]+={0,2}/g;

function pngOf(dataUrl: string): Blob {
  const text = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(text.length);
  for (let at = 0; at < text.length; at += 1) bytes[at] = text.charCodeAt(at);
  return new Blob([bytes], { type: "image/png" });
}

/**
 * Stores every drawing still carried inside the content and links to it
 * instead, so what is saved on the sheet is only words and links — a picture
 * in the row would ship again with every read of the patient's sheets.
 *
 * Read off the content as text, so it holds wherever on the sheet a drawing
 * sits. The server drops a drawing once the sheet stops linking to it.
 */
async function uploadUnsavedDrawings(id: string, content: string | null): Promise<string | null> {
  if (!content) return content;

  let saved = content;
  for (const png of new Set(content.match(UNSAVED_DRAWING) ?? [])) {
    const { url } = await medicalRecordApi.uploadDrawing(id, pngOf(png));
    saved = saved.split(png).join(url);
  }
  return saved;
}

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
    async (input: { id: string; content: string | null }) =>
      medicalRecordApi.update(input.id, { content: await uploadUnsavedDrawings(input.id, input.content) }),
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
