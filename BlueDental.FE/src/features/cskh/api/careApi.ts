import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { downloadFile } from "@/lib/download";
import { t } from "@/lib/i18n";
import type { PagedResult } from "@/types";

/** Matches BlueDental.CustomerCare.CareType. */
export const CARE_TYPE = {
  AfterTreatment: 1,
  Birthday: 2,
  AppointmentReminder: 3,
  Periodic: 4,
  Special: 5,
  Base: 6,
} as const;
export type CareType = (typeof CARE_TYPE)[keyof typeof CARE_TYPE];

/** Matches BlueDental.CustomerCare.CareStatus. */
export const CARE_STATUS = { New: 1, Contacted: 2, Succeeded: 3, Failed: 4, Cancelled: 5 } as const;
export type CareStatus = (typeof CARE_STATUS)[keyof typeof CARE_STATUS];

/** Matches BlueDental.CustomerCare.CareOutcome — Nhãn màu of a base task. */
export const CARE_OUTCOME = { NotRated: 0, Good: 1, Fair: 2, Normal: 3, Complaint: 4 } as const;
export type CareOutcome = (typeof CARE_OUTCOME)[keyof typeof CARE_OUTCOME];

/** Matches BlueDental.CustomerCare.CareTreatmentStatus (grouping tab). */
export const CARE_TREATMENT_STATUS = { Created: 1, InProgress: 2, Done: 3 } as const;
export type CareTreatmentStatus = (typeof CARE_TREATMENT_STATUS)[keyof typeof CARE_TREATMENT_STATUS];

/** Matches BlueDental.PatientManagement.Gender. */
export const CARE_GENDER = { Male: 1, Female: 2, Other: 3, PreferNotToSay: 4 } as const;
export type CareGender = (typeof CARE_GENDER)[keyof typeof CARE_GENDER];

/** Matches BlueDental.Appointments.AppointmentStatus (reminder tab column). */
export const CARE_APPOINTMENT_STATUS = {
  Scheduled: 1,
  Confirmed: 2,
  CheckedIn: 3,
  InProgress: 4,
  Completed: 5,
  Cancelled: 6,
  NoShow: 7,
} as const;
export type CareAppointmentStatus =
  (typeof CARE_APPOINTMENT_STATUS)[keyof typeof CARE_APPOINTMENT_STATUS];

export const careStatusLabels = (): Record<CareStatus, string> => ({
  [CARE_STATUS.New]: t("CSKH:Status:New"),
  [CARE_STATUS.Contacted]: t("CSKH:Status:Contacted"),
  [CARE_STATUS.Succeeded]: t("CSKH:Status:Succeeded"),
  [CARE_STATUS.Failed]: t("CSKH:Status:Failed"),
  [CARE_STATUS.Cancelled]: t("CSKH:Status:Cancelled"),
});

export const careTypeLabels = (): Record<CareType, string> => ({
  [CARE_TYPE.AfterTreatment]: t("CSKH:Type:AfterTreatment"),
  [CARE_TYPE.Birthday]: t("CSKH:Type:Birthday"),
  [CARE_TYPE.AppointmentReminder]: t("CSKH:Type:AppointmentReminder"),
  [CARE_TYPE.Periodic]: t("CSKH:Type:Periodic"),
  [CARE_TYPE.Special]: t("CSKH:Type:Special"),
  [CARE_TYPE.Base]: t("CSKH:Type:Base"),
});

export const careGenderLabels = (): Record<CareGender, string> => ({
  [CARE_GENDER.Male]: t("Common:Gender:Male"),
  [CARE_GENDER.Female]: t("Common:Gender:Female"),
  [CARE_GENDER.Other]: t("Common:Gender:Other"),
  [CARE_GENDER.PreferNotToSay]: t("Common:Gender:PreferNotToSay"),
});

export const careAppointmentStatusLabels = (): Record<CareAppointmentStatus, string> => ({
  [CARE_APPOINTMENT_STATUS.Scheduled]: t("Common:Appointment:Scheduled"),
  [CARE_APPOINTMENT_STATUS.Confirmed]: t("Common:Appointment:Confirmed"),
  [CARE_APPOINTMENT_STATUS.CheckedIn]: t("Common:Appointment:CheckedIn"),
  [CARE_APPOINTMENT_STATUS.InProgress]: t("Common:Appointment:InProgress"),
  [CARE_APPOINTMENT_STATUS.Completed]: t("Common:Appointment:Completed"),
  [CARE_APPOINTMENT_STATUS.Cancelled]: t("Common:Appointment:Cancelled"),
  [CARE_APPOINTMENT_STATUS.NoShow]: t("Common:Appointment:NoShow"),
});

export const treatmentStatusLabels = (): Record<CareTreatmentStatus, string> => ({
  [CARE_TREATMENT_STATUS.Created]: t("CSKH:Treatment:Created"),
  [CARE_TREATMENT_STATUS.InProgress]: t("CSKH:Treatment:InProgress"),
  [CARE_TREATMENT_STATUS.Done]: t("CSKH:Treatment:Done"),
});

/** Mirrors BlueDental.CustomerCare.CareRecordDto. */
export interface CareRecordDto {
  id: string;
  patientId: string;
  branchId: string;
  assignedStaffId: string | null;
  careStaffId: string | null;
  type: CareType;
  status: CareStatus;
  outcome: CareOutcome;
  subject: string;
  description: string | null;
  resolution: string | null;
  careServiceId: string | null;
  appointmentId: string | null;
  dueAt: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  completedAt: string | null;
  zaloSentAt: string | null;
  stageIds: string[];
  patientName: string | null;
  patientCode: string | null;
  patientPhone: string | null;
  patientGender: CareGender | null;
  patientDateOfBirth: string | null;
  assignedStaffName: string | null;
  careStaffName: string | null;
  careServiceName: string | null;
  serviceNames: string[];
  nextAppointmentAt: string | null;
  appointmentStatus: CareAppointmentStatus | null;
  appointmentContent: string | null;
  creationTime: string;
}

export interface CreateCareRecordInput {
  patientId: string;
  branchId: string;
  assignedStaffId?: string;
  careStaffId?: string;
  type: CareType;
  subject: string;
  description?: string;
  careServiceId?: string;
  dueAt?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  status?: CareStatus;
  outcome?: CareOutcome;
}

/** Reference's full-object PUT: inline note edits and the care-result dialog. */
export interface UpdateCareRecordInput {
  subject?: string;
  description?: string;
  assignedStaffId?: string;
  careStaffId?: string;
  dueAt?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  status?: CareStatus;
  outcome?: CareOutcome;
  stageIds?: string[];
}

export interface GetCareRecordListInput {
  skipCount?: number;
  maxResultCount?: number;
  branchId?: string;
  patientId?: string;
  status?: CareStatus;
  outcome?: CareOutcome;
  type?: CareType;
  careStaffId?: string;
  assignedStaffId?: string;
  fromDate?: string;
  toDate?: string;
  filter?: string;
}

export interface CareStatsDto {
  totalPatients: number;
  succeeded: number;
  failed: number;
  notCaredYet: number;
  zaloSent: number;
  good: number;
  fair: number;
  normal: number;
  complaint: number;
  special: number;
  periodic: number;
  base: number;
}

export interface GetCareGroupingPatientsInput {
  skipCount?: number;
  maxResultCount?: number;
  branchId?: string;
  taxonomyId?: string;
  tagId?: string;
  birthdayDate?: string;
  staffId?: string;
  filter?: string;
}

export interface CareGroupingPatientDto {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  dateOfBirth: string | null;
  treatmentStatus: CareTreatmentStatus;
  serviceNames: string[];
  staffNames: string[];
  totalAmount: number;
  totalRevenue: number;
  totalDebt: number;
  nextAppointmentAt: string | null;
  lastVisitAt: string | null;
  createdAt: string;
}

const BASE = "/v1/app/care-records";

const careApi = {
  list: (params: GetCareRecordListInput): Promise<PagedResult<CareRecordDto>> =>
    api.get<PagedResult<CareRecordDto>>(BASE, { params }).then((r) => r.data),

  stats: (params: GetCareRecordListInput): Promise<CareStatsDto> =>
    api.get<CareStatsDto>(`${BASE}/stats`, { params }).then((r) => r.data),

  create: (input: CreateCareRecordInput): Promise<CareRecordDto> =>
    api.post<CareRecordDto>(BASE, input).then((r) => r.data),

  update: (id: string, input: UpdateCareRecordInput): Promise<CareRecordDto> =>
    api.put<CareRecordDto>(`${BASE}/${id}`, input).then((r) => r.data),

  /** Soft delete — the record leaves every list but stays in the database. */
  remove: (id: string): Promise<void> => api.delete(`${BASE}/${id}`).then(() => undefined),

  groupingPatients: (
    params: GetCareGroupingPatientsInput,
  ): Promise<PagedResult<CareGroupingPatientDto>> =>
    api
      .get<PagedResult<CareGroupingPatientDto>>(`${BASE}/grouping-patients`, { params })
      .then((r) => r.data),
};

export const careKeys = {
  all: ["care-records"] as const,
  list: (params: GetCareRecordListInput) => [...careKeys.all, "list", params] as const,
  stats: (params: GetCareRecordListInput) => [...careKeys.all, "stats", params] as const,
  grouping: (params: GetCareGroupingPatientsInput) =>
    [...careKeys.all, "grouping", params] as const,
};

export function useCareRecordList(params: GetCareRecordListInput, enabled = true) {
  return useQuery({
    queryKey: careKeys.list(params),
    queryFn: () => careApi.list(params),
    enabled,
  });
}

export function useCareStats(params: GetCareRecordListInput, enabled = true) {
  return useQuery({
    queryKey: careKeys.stats(params),
    queryFn: () => careApi.stats(params),
    enabled,
  });
}

export function useCareGroupingPatients(params: GetCareGroupingPatientsInput, enabled = true) {
  return useQuery({
    queryKey: careKeys.grouping(params),
    queryFn: () => careApi.groupingPatients(params),
    enabled,
  });
}

function useCareMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: careKeys.all }),
  });
}

export function useCreateCareRecord() {
  return useCareMutation(careApi.create);
}

export function useUpdateCareRecord() {
  return useCareMutation((input: { id: string } & UpdateCareRecordInput) => {
    const { id, ...body } = input;
    return careApi.update(id, body);
  });
}

export function useDeleteCareRecord() {
  return useCareMutation(careApi.remove);
}

/** Reference downloads e.g. cskh-dac-biet.xlsx; the server names the file. */
export function exportCareExcel(params: GetCareRecordListInput): Promise<void> {
  const rest: Record<string, unknown> = { ...params };
  delete rest.skipCount;
  delete rest.maxResultCount;
  return downloadFile(`${BASE}/excel`, "cskh.xlsx", rest);
}
