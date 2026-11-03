import { useCallback } from "react";
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
 * "Giai đoạn điều trị" — the reference keeps two values, hard-coded in its
 * bundle rather than read from a catalogue; "Trong điều trị" is the clinic's
 * own (2026-11-03), numbered after them so stored pictures keep their stage.
 * Serialised as a number, the way the backend writes every enum.
 */
export const PATIENT_IMAGE_TYPE = {
  before: 1,
  after: 2,
  during: 3,
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
  /** Xóa ảnh is offered: false on a công đoạn picture once its upload day is over (R-1111). */
  deletable: boolean;
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

/** The longest "Ghi chú" a picture keeps (PatientImage.MaxNoteLength). */
export const PATIENT_IMAGE_NOTE_MAX = 1000;

/** The reference reads the tab 25 images at a time (`take=25`). */
export const PATIENT_IMAGE_PAGE_SIZE = 25;

const BASE = "/v1/app/patient-images";

const patientImageApi = {
  list: (params: {
    patientId?: string;
    clinicBranchId?: string;
    type?: PatientImageType;
    /** Matched against the "Ghi chú", any case, with or without marks. */
    filter?: string;
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
  pages: (patientId: string, type: PatientImageType | null, filter = "") =>
    [...patientImageKeys.all, "pages", patientId, type ?? "all", filter] as const,
};

/** Every image at once, for the consulting tab's "Chọn ảnh hiển thị" dialog. */
export function usePatientImages(patientId: string, clinicBranchId: string) {
  return useQuery({
    queryKey: patientImageKeys.list(patientId),
    queryFn: () => patientImageApi.list({ patientId, clinicBranchId, maxResultCount: 100 }),
    enabled: Boolean(patientId),
  });
}

/**
 * A Hình ảnh column's feed: newest first, a page at a time as the column is
 * scrolled, narrowed to the pictures whose note matches `filter` when one is typed.
 */
export function usePatientImagePages(
  patientId: string,
  clinicBranchId: string,
  type: PatientImageType | null,
  filter = "",
) {
  return useInfiniteQuery({
    queryKey: patientImageKeys.pages(patientId, type, filter),
    queryFn: ({ pageParam }) =>
      patientImageApi.list({
        patientId,
        clinicBranchId,
        type: type ?? undefined,
        filter: filter || undefined,
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

/**
 * "Tải ảnh" / "Chụp ảnh" send a batch of any size one file at a time. Sending
 * does not touch the cache; the caller refreshes the feed once the batch is
 * over, instead of reloading every page of it after each file.
 */
export function usePatientImageBatchUpload() {
  const queryClient = useQueryClient();
  const { mutateAsync: send } = useMutation({ mutationFn: patientImageApi.upload });
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: patientImageKeys.all }),
    [queryClient],
  );
  return { send, refresh };
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
