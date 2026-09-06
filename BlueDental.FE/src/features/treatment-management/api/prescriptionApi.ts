import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { catalogOptionKeys } from "@/hooks/useCatalogOptions";
import type { PagedResult } from "@/types";

/** Matches BlueDental.TreatmentManagement.PrescriptionTreatmentType. */
export const PRESCRIPTION_TREATMENT_TYPE = { Outpatient: 1, Inpatient: 2 } as const;
export type PrescriptionTreatmentType =
  (typeof PRESCRIPTION_TREATMENT_TYPE)[keyof typeof PRESCRIPTION_TREATMENT_TYPE];

/** "Điều trị" options in the reference's order — ngoại trú is the default. */
export function treatmentTypeOptions(): { value: PrescriptionTreatmentType; label: string }[] {
  return [
    { value: PRESCRIPTION_TREATMENT_TYPE.Outpatient, label: t("Điều trị ngoại trú") },
    { value: PRESCRIPTION_TREATMENT_TYPE.Inpatient, label: t("Điều trị nội trú") },
  ];
}

/** Mirrors BlueDental.TreatmentManagement.PrescriptionItemDto. */
export interface PrescriptionItemDto {
  id: string;
  medicationId: string;
  medicationName: string;
  timesPerDay: number;
  amountPerTime: number;
  days: number;
  /** Computed by the server: timesPerDay × amountPerTime × days. */
  quantity: number;
  /** Flags of PRESCRIPTION_USAGE. */
  usage: number;
  otherUsage: string | null;
  sortOrder: number;
}

/** Mirrors BlueDental.TreatmentManagement.PrescriptionDto. */
export interface PrescriptionDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  code: string;
  staffId: string;
  staffName: string | null;
  diagnosisText: string | null;
  note: string | null;
  treatmentType: PrescriptionTreatmentType;
  /** "YYYY-MM-DD" or null. */
  followUpDate: string | null;
  issuedAt: string;
  items: PrescriptionItemDto[];
  creationTime: string;
  lastModificationTime: string | null;
}

/** Mirrors CreatePrescriptionItemDto — one medicine line as sent. */
export interface PrescriptionLineInput {
  medicationId: string;
  timesPerDay: number;
  amountPerTime: number;
  days: number;
  usage: number;
  otherUsage: string | null;
}

/** Mirrors CreatePrescriptionDto. */
export interface CreatePrescriptionRequest {
  patientId: string;
  clinicBranchId: string;
  staffId: string;
  diagnosisText: string | null;
  note: string | null;
  treatmentType: PrescriptionTreatmentType;
  /** "YYYY-MM-DD" or null. */
  followUpDate: string | null;
  /** Also files the lines as a Đơn thuốc mẫu named `templateName`. */
  saveAsTemplate: boolean;
  templateName: string | null;
  items: PrescriptionLineInput[];
}

/** Mirrors UpdatePrescriptionDto — the patient and branch never change. */
export type UpdatePrescriptionRequest = Omit<CreatePrescriptionRequest, "patientId" | "clinicBranchId">;

const BASE = "/v1/app/prescriptions";

export const prescriptionKeys = {
  all: ["prescriptions"] as const,
  list: (patientId: string, branchId: string) =>
    [...prescriptionKeys.all, "list", patientId, branchId] as const,
};

/**
 * A patient's slips on the current branch, newest first. The tab pages them
 * on the client like the other record tabs, so one read fetches the lot.
 */
export function usePrescriptions(patientId: string) {
  const branchId = useCurrentBranchId();

  return useQuery({
    queryKey: prescriptionKeys.list(patientId, branchId),
    queryFn: () =>
      api
        .get<PagedResult<PrescriptionDto>>(BASE, {
          params: { patientId, clinicBranchId: branchId, skipCount: 0, maxResultCount: 200 },
        })
        .then((r) => r.data),
    enabled: Boolean(patientId) && Boolean(branchId),
  });
}

/** Saving with "Lưu đơn thuốc mẫu" ticked adds a catalog entry, so those lists refresh too. */
function useInvalidateAfterSave() {
  const queryClient = useQueryClient();
  return (savedTemplate: boolean) => {
    void queryClient.invalidateQueries({ queryKey: prescriptionKeys.all });
    if (savedTemplate) void queryClient.invalidateQueries({ queryKey: catalogOptionKeys.all });
  };
}

export function useCreatePrescription() {
  const invalidate = useInvalidateAfterSave();
  return useMutation({
    mutationFn: (input: CreatePrescriptionRequest) =>
      api.post<PrescriptionDto>(BASE, input).then((r) => r.data),
    onSuccess: (_, input) => invalidate(input.saveAsTemplate),
  });
}

export function useUpdatePrescription() {
  const invalidate = useInvalidateAfterSave();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePrescriptionRequest }) =>
      api.put<PrescriptionDto>(`${BASE}/${id}`, input).then((r) => r.data),
    onSuccess: (_, { input }) => invalidate(input.saveAsTemplate),
  });
}

export function useDeletePrescription() {
  const invalidate = useInvalidateAfterSave();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`).then(() => undefined),
    onSuccess: () => invalidate(false),
  });
}
