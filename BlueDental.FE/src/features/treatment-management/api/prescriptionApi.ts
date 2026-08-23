import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

import { t } from "@/lib/i18n";
/** Matches BlueDental.TreatmentManagement.PrescriptionStatus. */
export const PRESCRIPTION_STATUS = {
  Active: 1,
  Dispensed: 2,
  Expired: 3,
  Cancelled: 4,
} as const;
export type PrescriptionStatus =
  (typeof PRESCRIPTION_STATUS)[keyof typeof PRESCRIPTION_STATUS];

export const prescriptionStatusConfig = (): Record<
  PrescriptionStatus,
  { label: string; color: string }
> => ({
  [PRESCRIPTION_STATUS.Active]: { label: t("Chưa phát"), color: "processing" },
  [PRESCRIPTION_STATUS.Dispensed]: { label: t("Đã phát"), color: "green" },
  [PRESCRIPTION_STATUS.Expired]: { label: t("Hết hạn"), color: "default" },
  [PRESCRIPTION_STATUS.Cancelled]: { label: t("Đã huỷ"), color: "red" },
});

export interface PrescriptionItemDto {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  instructions: string | null;
}

export interface PrescriptionDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  code: string;
  staffId: string;
  patientDiagnosisId: string | null;
  diagnosisText: string | null;
  followUpDate: string | null;
  note: string | null;
  status: PrescriptionStatus;
  issuedAt: string;
  items: PrescriptionItemDto[];
  staffName: string | null;
  creationTime: string;
}

export interface CreatePrescriptionItemInput {
  medicationId: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  instructions?: string;
}

export interface CreatePrescriptionInput {
  patientId: string;
  clinicBranchId: string;
  staffId: string;
  diagnosisText?: string;
  followUpDate?: string;
  note?: string;
  items: CreatePrescriptionItemInput[];
}

const BASE = "/v1/app/prescriptions";

const prescriptionApi = {
  list: (params: {
    patientId?: string;
    clinicBranchId?: string;
    maxResultCount?: number;
  }): Promise<PagedResult<PrescriptionDto>> =>
    api.get<PagedResult<PrescriptionDto>>(BASE, { params }).then((r) => r.data),

  create: (input: CreatePrescriptionInput): Promise<PrescriptionDto> =>
    api.post<PrescriptionDto>(BASE, input).then((r) => r.data),

  dispense: (id: string): Promise<PrescriptionDto> =>
    api.post<PrescriptionDto>(`${BASE}/${id}/dispense`).then((r) => r.data),

  cancel: (id: string): Promise<PrescriptionDto> =>
    api.post<PrescriptionDto>(`${BASE}/${id}/cancel`).then((r) => r.data),
};

export const prescriptionKeys = {
  all: ["prescriptions"] as const,
  list: (patientId: string) => [...prescriptionKeys.all, "list", patientId] as const,
};

export function usePrescriptions(patientId: string, clinicBranchId: string) {
  return useQuery({
    queryKey: prescriptionKeys.list(patientId),
    queryFn: () => prescriptionApi.list({ patientId, clinicBranchId, maxResultCount: 50 }),
    enabled: Boolean(patientId),
  });
}

function usePrescriptionMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: prescriptionKeys.all });
    },
  });
}

export function useCreatePrescription() {
  return usePrescriptionMutation(prescriptionApi.create);
}

export function useDispensePrescription() {
  return usePrescriptionMutation((id: string) => prescriptionApi.dispense(id));
}

export function useCancelPrescription() {
  return usePrescriptionMutation((id: string) => prescriptionApi.cancel(id));
}
