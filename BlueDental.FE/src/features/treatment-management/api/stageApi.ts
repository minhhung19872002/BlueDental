import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";
import type { ToothSelectionDto } from "./consultingApi";

import { t } from "@/lib/i18n";
/** Matches BlueDental.TreatmentManagement.TreatmentStageStatus. */
export const STAGE_STATUS = { Pending: 1, InProgress: 2, Completed: 3 } as const;
export type TreatmentStageStatus = (typeof STAGE_STATUS)[keyof typeof STAGE_STATUS];

export const stageStatusConfig = (): Record<
  TreatmentStageStatus,
  { label: string; color: string }
> => ({
  [STAGE_STATUS.Pending]: { label: t("Chưa làm"), color: "default" },
  [STAGE_STATUS.InProgress]: { label: t("Đang làm"), color: "processing" },
  [STAGE_STATUS.Completed]: { label: t("Hoàn thành"), color: "green" },
});

export interface TreatmentStageDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  treatmentId: string | null;
  treatmentServiceId: string;
  serviceId: string;
  sequenceNumber: number;
  name: string;
  note: string | null;
  staffId: string;
  /** Bác sĩ hỗ trợ — the reference's `assistantStaffId`. */
  secondStaffId: string | null;
  /** Phụ tá — the reference's `subStaffId`. */
  subStaffId: string | null;
  scheduledDate: string | null;
  status: TreatmentStageStatus;
  isImageRequired: boolean;
  /** Bảo hành — a warranty visit rather than an ordinary step. */
  isGuarantee: boolean;
  startedAt: string | null;
  completedAt: string | null;
  teeth: ToothSelectionDto[];
  imageUrls: string[];
  staffName: string | null;
  secondStaffName: string | null;
  subStaffName: string | null;
  serviceName: string | null;
  creationTime: string;
}

export interface TreatmentStageProgressDto {
  treatmentServiceId: string;
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  progressPercent: number;
}

export interface LatestTreatmentStageDto {
  treatmentServiceId: string;
  treatmentId: string | null;
  stageId: string;
  serviceName: string | null;
  stageNote: string | null;
  stageDate: string;
}

export interface CreateTreatmentStageInput {
  patientId: string;
  clinicBranchId: string;
  treatmentId?: string | null;
  treatmentServiceId: string;
  serviceId: string;
  name: string;
  note?: string;
  staffId: string;
  /** Bác sĩ hỗ trợ. */
  secondStaffId?: string;
  /** Phụ tá. */
  subStaffId?: string;
  scheduledDate?: string;
  teeth?: ToothSelectionDto[];
  /** Set by "Tạo bảo hành". */
  isGuarantee?: boolean;
}

/** What the reference's PUT /patient-stages/{id} carries. */
export interface UpdateTreatmentStageInput {
  name: string;
  note?: string;
  staffId: string;
  secondStaffId?: string;
  subStaffId?: string;
  scheduledDate?: string;
  teeth?: ToothSelectionDto[];
}

export interface StageListInput {
  patientId?: string;
  clinicBranchId?: string;
  /** The slip. The reference scopes its stage list by this, not in the browser. */
  treatmentId?: string;
  treatmentServiceId?: string;
  status?: TreatmentStageStatus;
  maxResultCount?: number;
}

const STAGES = "/v1/app/treatment-stages";

const stageApi = {
  list: (params: StageListInput): Promise<PagedResult<TreatmentStageDto>> =>
    api.get<PagedResult<TreatmentStageDto>>(STAGES, { params }).then((r) => r.data),

  latest: (patientId: string): Promise<LatestTreatmentStageDto | null> =>
    api
      .get<LatestTreatmentStageDto | null>(`${STAGES}/latest`, { params: { patientId } })
      .then((r) => r.data ?? null),

  progress: (treatmentServiceId: string): Promise<TreatmentStageProgressDto> =>
    api
      .get<TreatmentStageProgressDto>(`${STAGES}/progress`, { params: { treatmentServiceId } })
      .then((r) => r.data),

  create: (input: CreateTreatmentStageInput): Promise<TreatmentStageDto> =>
    api.post<TreatmentStageDto>(STAGES, input).then((r) => r.data),

  update: (id: string, input: UpdateTreatmentStageInput): Promise<TreatmentStageDto> =>
    api.put<TreatmentStageDto>(`${STAGES}/${id}`, input).then((r) => r.data),

  continue: (id: string): Promise<TreatmentStageDto> =>
    api.post<TreatmentStageDto>(`${STAGES}/${id}/continue`).then((r) => r.data),

  complete: (id: string): Promise<TreatmentStageDto> =>
    api.post<TreatmentStageDto>(`${STAGES}/${id}/complete`).then((r) => r.data),

  /** Un-ticks Hoàn thành — the reference's own `revert-status`. */
  revert: (id: string): Promise<TreatmentStageDto> =>
    api.post<TreatmentStageDto>(`${STAGES}/${id}/revert-status`).then((r) => r.data),

  attachImage: (id: string, imageUrl: string): Promise<TreatmentStageDto> =>
    api.post<TreatmentStageDto>(`${STAGES}/${id}/images`, { imageUrl }).then((r) => r.data),
};

/**
 * Tái khám — a follow-up raised from a finished công đoạn.
 *
 * Its own resource, not a flag on a công đoạn: the reference's timeline returns
 * it as `type: "re_examination"` with a code of its own (REX01), and the
 * treatment table gives it a row beside the stages.
 */
export interface PatientReExaminationDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  code: string;
  patientStageId: string;
  treatmentServiceId: string;
  serviceId: string;
  staffId: string;
  subStaffId: string | null;
  secondStaffId: string | null;
  note: string | null;
  /** Only the teeth ticked in the form — the reference's selectedContent. */
  teeth: ToothSelectionDto[];
  imageUrls: string[];
  /** SL on the row, from the service line the source stage belongs to. */
  quantity: number;
  serviceName: string | null;
  staffName: string | null;
  subStaffName: string | null;
  secondStaffName: string | null;
  creationTime: string;
}

export interface CreateReExaminationInput {
  patientId: string;
  clinicBranchId: string;
  patientStageId: string;
  staffId: string;
  subStaffId?: string;
  secondStaffId?: string;
  note?: string;
  teeth: ToothSelectionDto[];
}

const RE_EXAMS = "/v1/app/patient-re-examinations";

export const reExaminationApi = {
  list: (params: {
    patientId?: string;
    clinicBranchId?: string;
    maxResultCount?: number;
  }): Promise<PagedResult<PatientReExaminationDto>> =>
    api.get<PagedResult<PatientReExaminationDto>>(RE_EXAMS, { params }).then((r) => r.data),

  create: (data: CreateReExaminationInput): Promise<PatientReExaminationDto> =>
    api.post<PatientReExaminationDto>(RE_EXAMS, data).then((r) => r.data),

  attachImage: (id: string, imageUrl: string): Promise<PatientReExaminationDto> =>
    api.post<PatientReExaminationDto>(`${RE_EXAMS}/${id}/images`, { imageUrl }).then((r) => r.data),
};

export const reExaminationKeys = {
  all: ["patient-re-examinations"] as const,
  list: (params: { patientId?: string; clinicBranchId?: string }) =>
    [...reExaminationKeys.all, "list", params] as const,
};

export const stageKeys = {
  all: ["treatment-stages"] as const,
  list: (params: StageListInput) => [...stageKeys.all, "list", params] as const,
  latest: (patientId: string) => [...stageKeys.all, "latest", patientId] as const,
  progress: (treatmentServiceId: string) =>
    [...stageKeys.all, "progress", treatmentServiceId] as const,
};

export function useTreatmentStages(params: StageListInput, enabled = true) {
  return useQuery({
    queryKey: stageKeys.list(params),
    queryFn: () => stageApi.list(params),
    enabled: enabled && Boolean(params.patientId ?? params.treatmentServiceId),
    // A stage carries images, and an upload has to show up on the row.
    staleTime: 0,
  });
}

export function useLatestTreatmentStage(patientId: string) {
  return useQuery({
    queryKey: stageKeys.latest(patientId),
    queryFn: () => stageApi.latest(patientId),
    enabled: Boolean(patientId),
  });
}

export function useStageProgress(treatmentServiceId: string) {
  return useQuery({
    queryKey: stageKeys.progress(treatmentServiceId),
    queryFn: () => stageApi.progress(treatmentServiceId),
    enabled: Boolean(treatmentServiceId),
  });
}

/**
 * Every stage change moves the list, the progress and the "latest" card
 * together — and the patient account with them: the profile tab's treatment
 * table reads a line's công đoạn count and its Nội dung điều trị (the stage
 * note) off that rollup, so leaving it alone left the row a reload behind.
 */
function useStageMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stageKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["patient-treatments"] });
    },
  });
}

export function useCreateStage() {
  return useStageMutation(stageApi.create);
}

/** The follow-up list feeding the treatment table's own tái khám rows. */
export function useReExaminations(
  params: { patientId?: string; clinicBranchId?: string; maxResultCount?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: reExaminationKeys.list(params),
    queryFn: () => reExaminationApi.list(params),
    enabled: enabled && Boolean(params.patientId),
    staleTime: 0,
  });
}

/**
 * Raising a follow-up moves three things: the follow-up list, the stage it was
 * raised from (its `hasReExamination` flips) and the slip the row hangs off.
 */
function useReExaminationMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reExaminationKeys.all });
      void queryClient.invalidateQueries({ queryKey: stageKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["patient-treatments"] });
    },
  });
}

export function useCreateReExamination() {
  return useReExaminationMutation(reExaminationApi.create);
}

export function useAttachReExaminationImage() {
  return useReExaminationMutation((input: { id: string; imageUrl: string }) =>
    reExaminationApi.attachImage(input.id, input.imageUrl),
  );
}

export function useUpdateStage() {
  return useStageMutation((input: { id: string } & UpdateTreatmentStageInput) => {
    const { id, ...rest } = input;
    return stageApi.update(id, rest);
  });
}

export function useContinueStage() {
  return useStageMutation((id: string) => stageApi.continue(id));
}

export function useCompleteStage() {
  return useStageMutation((id: string) => stageApi.complete(id));
}

export function useRevertStage() {
  return useStageMutation((id: string) => stageApi.revert(id));
}

export function useAttachStageImage() {
  return useStageMutation((input: { id: string; imageUrl: string }) =>
    stageApi.attachImage(input.id, input.imageUrl),
  );
}
