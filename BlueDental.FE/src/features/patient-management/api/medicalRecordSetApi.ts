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

/** A slip of the set, as its sheets print it. */
export interface SheetFactsPlanDto {
  treatmentPlanId: string;
  planCode: string;
  creationTime: string;
  attachedAt: string;
  /** Bác sĩ điều trị — the slip's doctor. */
  dentistName: string | null;
  /** Chức vụ on the staff record. */
  dentistPosition: string | null;
  /** `YYYY-MM-DD`; null while the slip is still being treated. */
  endDate: string | null;
}

export interface SheetFactsServiceDto {
  treatmentPlanId: string;
  serviceName: string;
  toothCodes: number[];
  diagnosisCode: string | null;
  diagnosisName: string | null;
  /** Thành tiền. */
  amount: number;
  consultedAt: string | null;
  /** Nhân sự tư vấn 1. */
  consultantName: string | null;
}

/** One công đoạn. */
export interface SheetFactsVisitDto {
  /** `YYYY-MM-DD` — the clinic day it was worked. */
  treatmentDate: string;
  recordedAt: string;
  serviceName: string;
  toothCodes: number[];
  diagnosisCode: string | null;
  diagnosisName: string | null;
  /** Nội dung điều trị. */
  content: string | null;
  doctorName: string | null;
}

/**
 * What a set's sheets print about its treatment slips (save/P1810.drawio).
 * Mirrors BlueDental.PatientManagement.MedicalRecordSheetFactsDto.
 */
export interface SheetFactsDto {
  /** Mã lưu trữ — NK-{MMyy}{patient code}{oldest slip}. */
  storageCode: string | null;
  /** Số ngoại trú — NGT-{MMyy of the treatment start}{patient code}-{xxxx}. */
  outpatientNumber: string | null;
  /** The year the oldest slip was opened. */
  year: number | null;
  treatmentStartDate: string | null;
  /** Null until every service of every slip is finished. */
  treatmentEndDate: string | null;
  /** Oldest first. */
  plans: SheetFactsPlanDto[];
  services: SheetFactsServiceDto[];
  /** Oldest first. */
  visits: SheetFactsVisitDto[];
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
  sheetFacts: (id: string) =>
    api.get<SheetFactsDto>(`${BASE}/${id}/sheet-facts`).then((r) => r.data),
};

export const recordSetKeys = {
  all: ["medical-record-sets"] as const,
  list: (patientId: string) => [...recordSetKeys.all, patientId] as const,
  plans: (patientId: string) => [...recordSetKeys.all, patientId, "plans"] as const,
  allSheetFacts: () => [...recordSetKeys.all, "sheet-facts"] as const,
  sheetFacts: (setId: string) => [...recordSetKeys.allSheetFacts(), setId] as const,
};

/**
 * What the open set's sheets print about its slips. Under the sets' own root,
 * so a slip or a công đoạn changing anywhere reads it again.
 */
export function useRecordSetSheetFacts(setId: string | undefined) {
  return useQuery({
    queryKey: recordSetKeys.sheetFacts(setId ?? ""),
    queryFn: () => recordSetApi.sheetFacts(setId ?? ""),
    enabled: Boolean(setId),
    refetchOnMount: "always",
  });
}

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

/**
 * A set changing moves slips between sets, so both lists — and the sheets — are
 * read again, and so is what the sheets print: a slip added that is still being
 * treated takes the end date off the cover, and taking it out puts it back.
 */
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
        queryClient.invalidateQueries({ queryKey: recordSetKeys.allSheetFacts() }),
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
