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
  secondStaffId: string | null;
  scheduledDate: string | null;
  status: TreatmentStageStatus;
  isImageRequired: boolean;
  startedAt: string | null;
  completedAt: string | null;
  teeth: ToothSelectionDto[];
  imageUrls: string[];
  staffName: string | null;
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
  scheduledDate?: string;
  teeth?: ToothSelectionDto[];
}

export interface StageListInput {
  patientId?: string;
  clinicBranchId?: string;
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

  continue: (id: string): Promise<TreatmentStageDto> =>
    api.post<TreatmentStageDto>(`${STAGES}/${id}/continue`).then((r) => r.data),

  complete: (id: string): Promise<TreatmentStageDto> =>
    api.post<TreatmentStageDto>(`${STAGES}/${id}/complete`).then((r) => r.data),

  attachImage: (id: string, imageUrl: string): Promise<TreatmentStageDto> =>
    api.post<TreatmentStageDto>(`${STAGES}/${id}/images`, { imageUrl }).then((r) => r.data),
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

/** Every stage change moves the list, the progress and the "latest" card together. */
function useStageMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stageKeys.all });
    },
  });
}

export function useCreateStage() {
  return useStageMutation(stageApi.create);
}

export function useContinueStage() {
  return useStageMutation((id: string) => stageApi.continue(id));
}

export function useCompleteStage() {
  return useStageMutation((id: string) => stageApi.complete(id));
}

export function useAttachStageImage() {
  return useStageMutation((input: { id: string; imageUrl: string }) =>
    stageApi.attachImage(input.id, input.imageUrl),
  );
}
