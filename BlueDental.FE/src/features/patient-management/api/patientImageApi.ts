import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/**
 * "Giai đoạn điều trị" — the reference keeps exactly two values, hard-coded in
 * its bundle rather than read from a catalogue. Serialised as a number, the
 * way the backend writes every enum.
 */
export const PATIENT_IMAGE_TYPE = {
  before: 1,
  after: 2,
} as const;

export type PatientImageType = (typeof PATIENT_IMAGE_TYPE)[keyof typeof PATIENT_IMAGE_TYPE];

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
  type: PatientImageType;
  /** 1-based position in the patient's sequence; drag-to-sort rewrites it. */
  ordering: number;
  /** Server-side path to the bytes; MinIO holds the file, never PostgreSQL. */
  url: string;
  staffName: string | null;
}

export interface UploadPatientImageInput {
  patientId: string;
  clinicBranchId: string;
  note?: string;
  type?: PatientImageType;
  /** Ties the picture to a plan, and to one công đoạn when it is known. */
  treatmentPlanId?: string;
  treatmentStageId?: string;
  file: File;
}

export interface ReorderPatientImageInput {
  id: string;
  /** The position the image should take; the server shifts the others around it. */
  ordering: number;
}

export type PatientImagePages = InfiniteData<PagedResult<PatientImageDto>, number>;

/** The reference reads the tab 25 images at a time (`take=25`). */
export const PATIENT_IMAGE_PAGE_SIZE = 25;

const BASE = "/v1/app/patient-images";

const patientImageApi = {
  list: (params: {
    patientId?: string;
    clinicBranchId?: string;
    type?: PatientImageType;
    skipCount?: number;
    maxResultCount?: number;
  }): Promise<PagedResult<PatientImageDto>> =>
    api.get<PagedResult<PatientImageDto>>(BASE, { params }).then((r) => r.data),

  upload: (input: UploadPatientImageInput): Promise<PatientImageDto> => {
    const form = new FormData();
    form.append("file", input.file);
    form.append("patientId", input.patientId);
    form.append("clinicBranchId", input.clinicBranchId);
    if (input.note) form.append("note", input.note);
    if (input.type) form.append("type", String(input.type));
    if (input.treatmentPlanId) form.append("treatmentPlanId", input.treatmentPlanId);
    if (input.treatmentStageId) form.append("treatmentStageId", input.treatmentStageId);

    return api.post<PatientImageDto>(BASE, form).then((r) => r.data);
  },

  reorder: (input: ReorderPatientImageInput): Promise<void> =>
    api.put(`${BASE}/reorder`, input).then(() => undefined),

  remove: (id: string): Promise<void> => api.delete(`${BASE}/${id}`).then(() => undefined),
};

export const patientImageKeys = {
  all: ["patient-images"] as const,
  list: (patientId: string) => [...patientImageKeys.all, "list", patientId] as const,
  pages: (patientId: string, type: PatientImageType | null) =>
    [...patientImageKeys.all, "pages", patientId, type ?? "all"] as const,
};

/** Every image at once, for the consulting tab's "Chọn ảnh hiển thị" dialog. */
export function usePatientImages(patientId: string, clinicBranchId: string) {
  return useQuery({
    queryKey: patientImageKeys.list(patientId),
    queryFn: () => patientImageApi.list({ patientId, clinicBranchId, maxResultCount: 100 }),
    enabled: Boolean(patientId),
  });
}

/** The Hình ảnh tab's feed: newest first, a page at a time as the timeline is scrolled. */
export function usePatientImagePages(
  patientId: string,
  clinicBranchId: string,
  type: PatientImageType | null,
) {
  return useInfiniteQuery({
    queryKey: patientImageKeys.pages(patientId, type),
    queryFn: ({ pageParam }) =>
      patientImageApi.list({
        patientId,
        clinicBranchId,
        type: type ?? undefined,
        skipCount: pageParam,
        maxResultCount: PATIENT_IMAGE_PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.totalCount && lastPage.items.length > 0 ? loaded : undefined;
    },
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

/**
 * Persists a drag. Deliberately does not invalidate on its own: the gallery
 * hook shows the dragged order straight away and settles the cache itself, so
 * a save never flashes the old order and a failure snaps back.
 */
export function useReorderPatientImage() {
  return useMutation({ mutationFn: patientImageApi.reorder });
}
