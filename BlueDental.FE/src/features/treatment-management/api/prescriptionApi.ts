import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { invalidateEntities } from "@/lib/queryEntities";
import type { PagedResult } from "@/types";
import type { RxDiagnosisRow } from "../types/prescription";

/** Matches BlueDental.TreatmentManagement.PrescriptionTreatmentType. */
export const PRESCRIPTION_TREATMENT_TYPE = { Outpatient: 1, Inpatient: 2 } as const;
export type PrescriptionTreatmentType =
  (typeof PRESCRIPTION_TREATMENT_TYPE)[keyof typeof PRESCRIPTION_TREATMENT_TYPE];

/** "Điều trị" options in the reference's order — ngoại trú is the default. */
export function treatmentTypeOptions(): { value: PrescriptionTreatmentType; label: string }[] {
  return [
    { value: PRESCRIPTION_TREATMENT_TYPE.Outpatient, label: t("Treatment:Prescription:Outpatient") },
    { value: PRESCRIPTION_TREATMENT_TYPE.Inpatient, label: t("Treatment:Prescription:Inpatient") },
  ];
}

/** The dose of one line by session — 0 when the session is skipped (F-58). */
export interface PrescriptionSessionDose {
  morning: number;
  noon: number;
  afternoon: number;
  evening: number;
  days: number;
}

/** Mirrors BlueDental.TreatmentManagement.PrescriptionItemDto. */
export interface PrescriptionItemDto extends PrescriptionSessionDose {
  id: string;
  medicationId: string;
  medicationName: string;
  /** Computed by the server: (sáng + trưa + chiều + tối) × days. */
  quantity: number;
  /** Flags of PRESCRIPTION_USAGE. */
  usage: number;
  otherUsage: string | null;
  sortOrder: number;
}

/** One diagnosis picked from a phiếu điều trị, as it stood when the slip was saved. */
export interface PrescriptionDiagnosisDto {
  treatmentPlanId: string;
  diagnosisId: string;
  planCode: string;
  diagnosisName: string;
  toothCodes: number[];
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
  /** The diagnosis as printed — built from `diagnoses` since F-58. */
  diagnosisText: string | null;
  diagnosisNote: string | null;
  diagnoses: PrescriptionDiagnosisDto[];
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
export interface PrescriptionLineInput extends PrescriptionSessionDose {
  medicationId: string;
  usage: number;
  otherUsage: string | null;
}

/** Mirrors CreatePrescriptionDto. */
export interface CreatePrescriptionRequest {
  patientId: string;
  clinicBranchId: string;
  staffId: string;
  diagnosisText: string | null;
  diagnosisNote: string | null;
  /** The server rebuilds the snapshot from these and checks they are the patient's. */
  diagnoses: { treatmentPlanId: string; diagnosisId: string }[];
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

/** Mirrors PrescriptionDiagnosisSourceDto — one diagnosis of one phiếu điều trị. */
interface PrescriptionDiagnosisSourceDto {
  treatmentPlanId: string;
  planCode: string;
  planCreationTime: string;
  diagnosisId: string;
  diagnosisName: string;
  toothCodes: number[];
  notes: string[];
}

const BASE = "/v1/app/prescriptions";

export const prescriptionKeys = {
  all: ["prescriptions"] as const,
  list: (patientId: string, branchId: string) =>
    [...prescriptionKeys.all, "list", patientId, branchId] as const,
  diagnosisSources: (patientId: string, branchId: string) =>
    [...prescriptionKeys.all, "diagnosis-sources", patientId, branchId] as const,
};

export function rxDiagnosisKey(treatmentPlanId: string, diagnosisId: string): string {
  return `${treatmentPlanId}:${diagnosisId}`;
}

function adaptDiagnosisSource(dto: PrescriptionDiagnosisSourceDto): RxDiagnosisRow {
  return {
    key: rxDiagnosisKey(dto.treatmentPlanId, dto.diagnosisId),
    treatmentPlanId: dto.treatmentPlanId,
    diagnosisId: dto.diagnosisId,
    planCode: dto.planCode,
    planDate: dto.planCreationTime,
    diagnosisName: dto.diagnosisName,
    toothCodes: dto.toothCodes,
    notes: dto.notes,
  };
}

/** A saved pick read back — the snapshot carries no notes and no plan date. */
export function adaptPickedDiagnosis(dto: PrescriptionDiagnosisDto): RxDiagnosisRow {
  return {
    key: rxDiagnosisKey(dto.treatmentPlanId, dto.diagnosisId),
    treatmentPlanId: dto.treatmentPlanId,
    diagnosisId: dto.diagnosisId,
    planCode: dto.planCode,
    planDate: null,
    diagnosisName: dto.diagnosisName,
    toothCodes: dto.toothCodes,
    notes: [],
  };
}

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

/**
 * The diagnoses of the patient's phiếu điều trị on the current branch, one row
 * per diagnosis of a plan, newest plan first; cancelled plans are left out.
 */
export function usePrescriptionDiagnosisSources(patientId: string, enabled: boolean) {
  const branchId = useCurrentBranchId();

  return useQuery({
    queryKey: prescriptionKeys.diagnosisSources(patientId, branchId),
    queryFn: () =>
      api
        .get<{ items: PrescriptionDiagnosisSourceDto[] }>(`${BASE}/diagnosis-sources`, {
          params: { patientId, clinicBranchId: branchId },
        })
        .then((r) => r.data.items.map(adaptDiagnosisSource)),
    enabled: enabled && Boolean(patientId) && Boolean(branchId),
    // Phiếu điều trị are made on other tabs while this one stays mounted: every
    // opening of the dialog must see them, not a list cached minutes earlier.
    staleTime: 0,
  });
}

/**
 * Saving with "Lưu đơn thuốc mẫu" ticked adds a catalog entry, so every catalog
 * reader refreshes too — the pickers and Danh mục's own tables. Only then,
 * which is why it is not a static `meta.invalidates`.
 */
function useInvalidateAfterSave() {
  const queryClient = useQueryClient();
  return (savedTemplate: boolean) => {
    void queryClient.invalidateQueries({ queryKey: prescriptionKeys.all });
    if (savedTemplate) invalidateEntities(queryClient, ["catalog"]);
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
