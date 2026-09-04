import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";
import { t } from "@/lib/i18n";

/** Matches BlueDental.TreatmentManagement.PatientDiagnosisStatus */
export const DIAGNOSIS_STATUS = {
  Created: 1,
  InProgress: 2,
  Treated: 3,
  Cancelled: 4,
} as const;
export type PatientDiagnosisStatus =
  (typeof DIAGNOSIS_STATUS)[keyof typeof DIAGNOSIS_STATUS];

/** Matches BlueDental.TreatmentManagement.PatientAdviseStatus */
export const ADVISE_STATUS = {
  Created: 1,
  Accepted: 2,
  Converted: 3,
  Rejected: 4,
  Cancelled: 5,
} as const;
export type PatientAdviseStatus = (typeof ADVISE_STATUS)[keyof typeof ADVISE_STATUS];

/** Matches BlueDental.TreatmentManagement.DiscountType */
export const DISCOUNT_TYPE = {
  None: 0,
  Money: 1,
  Percentage: 2,
} as const;
export type DiscountType = (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE];

/**
 * One tooth plus the surfaces involved — the reference's dental chart primitive.
 */
export interface ToothSelectionDto {
  toothCode: number;
  selected: boolean;
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
  center: boolean;
}

export interface PatientDiagnosisDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  diagnosisId: string;
  staffId: string;
  secondStaffId: string | null;
  code: string;
  note: string | null;
  status: PatientDiagnosisStatus;
  hasTreatmentService: boolean;
  teeth: ToothSelectionDto[];
  diagnosisName: string | null;
  staffName: string | null;
  secondStaffName: string | null;
  creationTime: string;
}

export interface PatientAdviseDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  serviceId: string;
  diagnosisId: string;
  patientDiagnosisId: string;
  treatmentPlanId: string | null;
  adviseGroupId: string | null;
  staffId: string;
  secondStaffId: string | null;
  code: string;
  note: string | null;
  originalPrice: number;
  price: number;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  voucherDiscountAmount: number | null;
  status: PatientAdviseStatus;
  sortOrder: number;
  teeth: ToothSelectionDto[];
  imageIds: string[];
  grossAmount: number;
  discountAmount: number;
  effectiveAmount: number;
  serviceName: string | null;
  staffName: string | null;
  secondStaffName: string | null;
  diagnosisName: string | null;
  creationTime: string;
}

export interface PatientAdviseSummaryDto {
  totalCount: number;
  acceptedCount: number;
  convertedCount: number;
  totalGrossAmount: number;
  totalDiscountAmount: number;
  totalEffectiveAmount: number;
}

export interface AdviseGroupDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  adviseCount: number;
  totalEffectiveAmount: number;
}

export interface CreatePatientDiagnosisDto {
  patientId: string;
  clinicBranchId: string;
  diagnosisId: string;
  staffId: string;
  secondStaffId?: string;
  note?: string;
  teeth: ToothSelectionDto[];
}

export interface CreatePatientAdviseDto {
  patientId: string;
  clinicBranchId: string;
  patientDiagnosisId: string;
  diagnosisId: string;
  serviceId: string;
  staffId: string;
  secondStaffId?: string;
  adviseGroupId?: string;
  originalPrice: number;
  price: number;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  sortOrder?: number;
  note?: string;
  teeth: ToothSelectionDto[];
}

export interface ListByPatientInput {
  patientId?: string;
  clinicBranchId?: string;
  skipCount?: number;
  maxResultCount?: number;
}

export const consultingApi = {
  diagnoses: (params: ListByPatientInput): Promise<PagedResult<PatientDiagnosisDto>> =>
    api
      .get<PagedResult<PatientDiagnosisDto>>("/v1/app/patient-diagnoses", { params })
      .then((r) => r.data),

  createDiagnosis: (data: CreatePatientDiagnosisDto): Promise<PatientDiagnosisDto> =>
    api.post<PatientDiagnosisDto>("/v1/app/patient-diagnoses", data).then((r) => r.data),

  cancelDiagnosis: (id: string): Promise<PatientDiagnosisDto> =>
    api.post<PatientDiagnosisDto>(`/v1/app/patient-diagnoses/${id}/cancel`).then((r) => r.data),

  advises: (params: ListByPatientInput): Promise<PagedResult<PatientAdviseDto>> =>
    api
      .get<PagedResult<PatientAdviseDto>>("/v1/app/patient-advises", { params })
      .then((r) => r.data),

  adviseSummary: (params: ListByPatientInput): Promise<PatientAdviseSummaryDto> =>
    api
      .get<PatientAdviseSummaryDto>("/v1/app/patient-advises/summary", { params })
      .then((r) => r.data),

  createAdvise: (data: CreatePatientAdviseDto): Promise<PatientAdviseDto> =>
    api.post<PatientAdviseDto>("/v1/app/patient-advises", data).then((r) => r.data),

  acceptAdvise: (id: string): Promise<PatientAdviseDto> =>
    api.post<PatientAdviseDto>(`/v1/app/patient-advises/${id}/accept`).then((r) => r.data),

  rejectAdvise: (id: string): Promise<PatientAdviseDto> =>
    api.post<PatientAdviseDto>(`/v1/app/patient-advises/${id}/reject`).then((r) => r.data),

  adviseGroups: (params: ListByPatientInput): Promise<PagedResult<AdviseGroupDto>> =>
    api.get<PagedResult<AdviseGroupDto>>("/v1/app/advise-groups", { params }).then((r) => r.data),
};

/**
 * "18, 36 (mặt nhai)" — how the reference renders a tooth set in list rows.
 */
export function formatTeeth(teeth: ToothSelectionDto[]): string {
  if (teeth.length === 0) return "—";

  return teeth
    .map((tooth) => {
      const surfaces: string[] = [];
      if (tooth.top) surfaces.push(t("trên"));
      if (tooth.bottom) surfaces.push(t("dưới"));
      if (tooth.left) surfaces.push(t("trái"));
      if (tooth.right) surfaces.push(t("phải"));
      if (tooth.center) surfaces.push(t("giữa"));

      return surfaces.length > 0 && !tooth.selected
        ? `${tooth.toothCode} (${surfaces.join(", ")})`
        : String(tooth.toothCode);
    })
    .join(", ");
}
