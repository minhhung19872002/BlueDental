import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { patientImageKeys, type PatientImageType } from "./patientImageApi";
import { adaptPatientImageFolder } from "./patientImageAdapters";

/** A "Thư mục" of a Hình ảnh stage column (F-98) — one level, the clinic's own. */
export interface PatientImageFolderDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  type: PatientImageType;
  name: string;
  /** How many pictures are filed in it. */
  imageCount: number;
  /** The newest picture, which peeks out of the folder; null when it is empty. */
  coverUrl: string | null;
}

export interface CreatePatientImageFolderInput {
  patientId: string;
  clinicBranchId: string;
  type: PatientImageType;
  name: string;
}

/** The longest name a thư mục keeps (PatientImageFolder.MaxNameLength). */
export const PATIENT_IMAGE_FOLDER_NAME_MAX = 100;

const BASE = "/v1/app/patient-image-folders";

const patientImageFolderApi = {
  list: (params: { patientId: string; clinicBranchId: string; type: PatientImageType }) =>
    api.get<PatientImageFolderDto[]>(BASE, { params }).then((r) => r.data),

  create: (input: CreatePatientImageFolderInput) =>
    api.post<PatientImageFolderDto>(BASE, input).then((r) => r.data),

  rename: ({ id, name }: { id: string; name: string }) =>
    api.put<PatientImageFolderDto>(`${BASE}/${id}`, { name }).then((r) => r.data),

  /** Its pictures go back into the column; none is deleted. */
  remove: (id: string): Promise<void> => api.delete(`${BASE}/${id}`).then(() => undefined),
};

/** One stage column's thư mục, by name. Under the pictures' key, so every picture change refreshes counts and covers. */
export function usePatientImageFolders(patientId: string, clinicBranchId: string, type: PatientImageType) {
  return useQuery({
    queryKey: patientImageKeys.folders(patientId, type),
    queryFn: () => patientImageFolderApi.list({ patientId, clinicBranchId, type }),
    select: (folders) => folders.map(adaptPatientImageFolder),
    enabled: Boolean(patientId),
  });
}

function useFolderMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // The thư mục hooks show the server's message themselves; one toast, not two.
    meta: { skipGlobalErrorToast: true },
    // Deleting a thư mục puts its pictures back in the column's feed, so every feed is refreshed.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: patientImageKeys.all }),
  });
}

export function useCreatePatientImageFolder() {
  return useFolderMutation(patientImageFolderApi.create);
}

export function useRenamePatientImageFolder() {
  return useFolderMutation(patientImageFolderApi.rename);
}

export function useDeletePatientImageFolder() {
  return useFolderMutation(patientImageFolderApi.remove);
}
