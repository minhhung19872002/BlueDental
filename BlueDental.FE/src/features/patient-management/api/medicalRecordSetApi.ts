import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { medicalRecordKeys, type MedicalRecordForm } from "./medicalRecordApi";

/**
 * Bộ hồ sơ bệnh án — the bundles a patient's Bệnh án sheets are kept in, each
 * opened for one or more treatment slips. The clinic's own design
 * (save/P1710.drawio, 2026-10-17), not the reference's.
 */

/** Mirrors BlueDental.PatientManagement.MedicalRecordSetStatus. */
export const RECORD_SET_STATUS = { Active: 1, Cancelled: 2 } as const;
export type RecordSetStatus = (typeof RECORD_SET_STATUS)[keyof typeof RECORD_SET_STATUS];

/** Mirrors BlueDental.TreatmentManagement.TreatmentPlanStatus. */
export const SLIP_STATUS = {
  Draft: 1,
  PendingApproval: 2,
  Approved: 3,
  InProgress: 4,
  Completed: 5,
  Cancelled: 6,
} as const;
export type SlipStatus = (typeof SLIP_STATUS)[keyof typeof SLIP_STATUS];

export interface RecordSetPlanDto {
  treatmentPlanId: string;
  /** Mã phiếu điều trị — DT01. */
  planCode: string;
  creationTime: string;
  /** Mã phiếu chẩn đoán — CD26-0039. */
  diagnosisSlipCode: string | null;
  diagnosisName: string | null;
  treatmentName: string | null;
  dentistId: string;
  dentistName: string | null;
  planStatus: SlipStatus;
  /** "Chưa điều trị" — only such a slip may leave or change set. */
  notStarted: boolean;
  /** The live set holding the slip. */
  recordSetId: string | null;
  recordSetCode: string | null;
}

export interface RecordSetDto {
  id: string;
  patientId: string;
  code: string;
  status: RecordSetStatus;
  cancelledAt: string | null;
  cancellerName: string | null;
  visibleForms: MedicalRecordForm[];
  /** Newest slip first. */
  plans: RecordSetPlanDto[];
  creationTime: string;
}

export interface RecordSetInput {
  treatmentPlanIds: string[];
  visibleForms: MedicalRecordForm[];
}

interface ListResult<T> {
  items: T[];
}

const BASE = "/v1/app/medical-record-sets";

const recordSetApi = {
  list: (patientId: string) =>
    api.get<ListResult<RecordSetDto>>(BASE, { params: { patientId } }).then((r) => r.data.items),
  plans: (patientId: string) =>
    api
      .get<ListResult<RecordSetPlanDto>>(`${BASE}/plans`, { params: { patientId } })
      .then((r) => r.data.items),
  create: (patientId: string, input: RecordSetInput) =>
    api.post<RecordSetDto>(BASE, { patientId, ...input }).then((r) => r.data),
  update: (id: string, input: RecordSetInput) =>
    api.put<RecordSetDto>(`${BASE}/${id}`, input).then((r) => r.data),
  cancel: (id: string) => api.post<RecordSetDto>(`${BASE}/${id}/cancel`).then((r) => r.data),
};

export const recordSetKeys = {
  all: ["medical-record-sets"] as const,
  list: (patientId: string) => [...recordSetKeys.all, patientId] as const,
  plans: (patientId: string) => [...recordSetKeys.all, patientId, "plans"] as const,
};

export function useRecordSets(patientId: string) {
  return useQuery({
    queryKey: recordSetKeys.list(patientId),
    queryFn: () => recordSetApi.list(patientId),
    enabled: Boolean(patientId),
    // Opening Bệnh án reads the sets again: another screen or another user may
    // have moved a slip on since.
    refetchOnMount: "always",
  });
}

export function useRecordSetPlans(patientId: string) {
  return useQuery({
    queryKey: recordSetKeys.plans(patientId),
    queryFn: () => recordSetApi.plans(patientId),
    enabled: Boolean(patientId),
    // A slip's status decides whether it may move, so it is never taken from
    // a stale cache — see also ENTITY_QUERY_ROOTS in lib/queryEntities.ts.
    refetchOnMount: "always",
  });
}

/** A set changing moves slips between sets, so both lists — and the sheets — are read again. */
function useRecordSetMutation<TVariables>(
  patientId: string,
  fn: (variables: TVariables) => Promise<RecordSetDto>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: recordSetKeys.list(patientId) }),
        queryClient.invalidateQueries({ queryKey: medicalRecordKeys.list(patientId) }),
      ]),
  });
}

export function useCreateRecordSet(patientId: string) {
  return useRecordSetMutation(patientId, (input: RecordSetInput) =>
    recordSetApi.create(patientId, input),
  );
}

export function useUpdateRecordSet(patientId: string) {
  return useRecordSetMutation(patientId, ({ id, ...input }: RecordSetInput & { id: string }) =>
    recordSetApi.update(id, input),
  );
}

export function useCancelRecordSet(patientId: string) {
  return useRecordSetMutation(patientId, (id: string) => recordSetApi.cancel(id));
}
