import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface PatientImageDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  treatmentPlanId: string | null;
  treatmentStageId: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  note: string | null;
  staffId: string;
  takenAt: string;
  /** Server-side path to the bytes; MinIO holds the file, never PostgreSQL. */
  url: string;
  staffName: string | null;
}

export interface UploadPatientImageInput {
  patientId: string;
  clinicBranchId: string;
  note?: string;
  file: File;
}

const BASE = "/v1/app/patient-images";

const patientImageApi = {
  list: (params: {
    patientId?: string;
    clinicBranchId?: string;
    maxResultCount?: number;
  }): Promise<PagedResult<PatientImageDto>> =>
    api.get<PagedResult<PatientImageDto>>(BASE, { params }).then((r) => r.data),

  upload: (input: UploadPatientImageInput): Promise<PatientImageDto> => {
    const form = new FormData();
    form.append("file", input.file);
    form.append("patientId", input.patientId);
    form.append("clinicBranchId", input.clinicBranchId);
    if (input.note) form.append("note", input.note);

    return api.post<PatientImageDto>(BASE, form).then((r) => r.data);
  },

  remove: (id: string): Promise<void> => api.delete(`${BASE}/${id}`).then(() => undefined),
};

export const patientImageKeys = {
  all: ["patient-images"] as const,
  list: (patientId: string) => [...patientImageKeys.all, "list", patientId] as const,
};

export function usePatientImages(patientId: string, clinicBranchId: string) {
  return useQuery({
    queryKey: patientImageKeys.list(patientId),
    queryFn: () => patientImageApi.list({ patientId, clinicBranchId, maxResultCount: 100 }),
    enabled: Boolean(patientId),
  });
}

function useImageMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientImageKeys.all });
    },
  });
}

export function useUploadPatientImage() {
  return useImageMutation(patientImageApi.upload);
}

export function useDeletePatientImage() {
  return useImageMutation((id: string) => patientImageApi.remove(id));
}
