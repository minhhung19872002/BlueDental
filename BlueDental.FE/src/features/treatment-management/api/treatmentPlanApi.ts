import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";
import type { DiscountType, ToothSelectionDto } from "./consultingApi";

/** Matches BlueDental.TreatmentManagement.TreatmentPlanStatus. */
export const PLAN_STATUS = {
  Draft: 1,
  PendingApproval: 2,
  Approved: 3,
  InProgress: 4,
  Completed: 5,
  Cancelled: 6,
} as const;
export type TreatmentPlanStatus = (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];

export const PLAN_STATUS_CONFIG: Record<TreatmentPlanStatus, { label: string; color: string }> = {
  [PLAN_STATUS.Draft]: { label: "Nháp", color: "default" },
  [PLAN_STATUS.PendingApproval]: { label: "Chờ duyệt", color: "gold" },
  [PLAN_STATUS.Approved]: { label: "Đã duyệt", color: "blue" },
  [PLAN_STATUS.InProgress]: { label: "Đang điều trị", color: "processing" },
  [PLAN_STATUS.Completed]: { label: "Hoàn thành", color: "green" },
  [PLAN_STATUS.Cancelled]: { label: "Đã huỷ", color: "red" },
};

/** Matches BlueDental.TreatmentManagement.TreatmentServiceStatus. */
export const SERVICE_LINE_STATUS = {
  Created: 1,
  InProgress: 2,
  Done: 3,
  Cancelled: 4,
  Replaced: 5,
} as const;
export type TreatmentServiceStatus =
  (typeof SERVICE_LINE_STATUS)[keyof typeof SERVICE_LINE_STATUS];

export const SERVICE_LINE_STATUS_CONFIG: Record<
  TreatmentServiceStatus,
  { label: string; color: string }
> = {
  [SERVICE_LINE_STATUS.Created]: { label: "Chưa điều trị", color: "default" },
  [SERVICE_LINE_STATUS.InProgress]: { label: "Đang điều trị", color: "processing" },
  [SERVICE_LINE_STATUS.Done]: { label: "Hoàn thành", color: "green" },
  [SERVICE_LINE_STATUS.Cancelled]: { label: "Đã huỷ", color: "red" },
  [SERVICE_LINE_STATUS.Replaced]: { label: "Đã thay thế", color: "purple" },
};

/** Matches BlueDental.Billing.PatientPaymentKind. */
export const PAYMENT_KIND = { Payment: 1, Refund: 2, Prepaid: 3 } as const;
export type PatientPaymentKind = (typeof PAYMENT_KIND)[keyof typeof PAYMENT_KIND];

export const PAYMENT_KIND_CONFIG: Record<PatientPaymentKind, { label: string; color: string }> = {
  [PAYMENT_KIND.Payment]: { label: "Thu tiền", color: "green" },
  [PAYMENT_KIND.Refund]: { label: "Hoàn tiền", color: "red" },
  [PAYMENT_KIND.Prepaid]: { label: "Nạp quỹ", color: "blue" },
};

/** Matches BlueDental.Billing.PaymentMethodKind — the four the reference reports. */
export const PAYMENT_METHOD = { Cash: 1, Banking: 2, Card: 3, OutstandingDebt: 4 } as const;
export type PaymentMethodKind = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKind, string> = {
  [PAYMENT_METHOD.Cash]: "Tiền mặt",
  [PAYMENT_METHOD.Banking]: "Chuyển khoản",
  [PAYMENT_METHOD.Card]: "Quẹt thẻ",
  [PAYMENT_METHOD.OutstandingDebt]: "Trừ quỹ khách",
};

export interface PaymentSummaryDto {
  totalPrice: number;
  totalPaid: number;
  totalDue: number;
  receivable: number;
  paidUncompleted: number;
  completedValue: number;
  totalRefund: number;
  debt: number;
  discount: number;
  outstandingDebt: number;
  outstandingDebtConsumed: number;
  prepaid: number;
  carryOverAmount: number | null;
}

export interface TreatmentServiceDto {
  id: string;
  treatmentPlanId: string;
  serviceId: string;
  sourceAdviseId: string | null;
  code: string;
  price: number;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  grossAmount: number;
  discountAmount: number;
  effectiveAmount: number;
  status: TreatmentServiceStatus;
  teeth: ToothSelectionDto[];
  serviceName: string | null;
  stageCount: number;
  completedStageCount: number;
}

export interface TreatmentPlanSlipDto {
  id: string;
  patientId: string;
  branchId: string;
  dentistId: string;
  consultantStaffId: string | null;
  code: string;
  title: string;
  status: TreatmentPlanStatus;
  progressPercent: number;
  discountType: DiscountType;
  discountValue: number;
  voucherDiscountAmount: number | null;
  servicesTotal: number;
  planDiscountAmount: number;
  totalAmount: number;
  payment: PaymentSummaryDto;
  services: TreatmentServiceDto[];
  dentistName: string | null;
  consultantName: string | null;
  creationTime: string;
}

export interface PatientPaymentDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  treatmentPlanId: string | null;
  treatmentServiceId: string | null;
  kind: PatientPaymentKind;
  method: PaymentMethodKind;
  amount: number;
  code: string;
  paidAt: string;
  staffId: string;
  note: string | null;
  staffName: string | null;
  treatmentPlanCode: string | null;
}

export interface PatientAccountDto {
  patientId: string;
  payment: PaymentSummaryDto;
  heldForPatient: number;
  plans: TreatmentPlanSlipDto[];
  payments: PatientPaymentDto[];
}

export interface OpenPlanInput {
  patientId: string;
  clinicBranchId: string;
  dentistId: string;
  consultantStaffId?: string;
  title?: string;
  discountType?: DiscountType;
  discountValue?: number;
  adviseIds?: string[];
}

export interface RecordPaymentInput {
  patientId: string;
  clinicBranchId: string;
  treatmentPlanId?: string;
  kind: PatientPaymentKind;
  method: PaymentMethodKind;
  amount: number;
  staffId: string;
  note?: string;
}

const PLANS = "/v1/app/patient-treatments";
const PAYMENTS = "/v1/app/patient-payments";

const treatmentApi = {
  plans: (params: {
    patientId?: string;
    clinicBranchId?: string;
    maxResultCount?: number;
  }): Promise<PagedResult<TreatmentPlanSlipDto>> =>
    api.get<PagedResult<TreatmentPlanSlipDto>>(PLANS, { params }).then((r) => r.data),

  openPlan: (input: OpenPlanInput): Promise<TreatmentPlanSlipDto> =>
    api.post<TreatmentPlanSlipDto>(PLANS, input).then((r) => r.data),

  completeService: (planId: string, lineId: string): Promise<TreatmentPlanSlipDto> =>
    api
      .post<TreatmentPlanSlipDto>(`${PLANS}/${planId}/services/${lineId}/complete`)
      .then((r) => r.data),

  cancelService: (planId: string, lineId: string): Promise<TreatmentPlanSlipDto> =>
    api
      .post<TreatmentPlanSlipDto>(`${PLANS}/${planId}/services/${lineId}/cancel`)
      .then((r) => r.data),

  account: (patientId: string, clinicBranchId: string): Promise<PatientAccountDto> =>
    api
      .get<PatientAccountDto>(`${PAYMENTS}/account`, { params: { patientId, clinicBranchId } })
      .then((r) => r.data),

  recordPayment: (input: RecordPaymentInput): Promise<PatientPaymentDto> =>
    api.post<PatientPaymentDto>(PAYMENTS, input).then((r) => r.data),
};

export const treatmentKeys = {
  all: ["patient-treatments"] as const,
  plans: (patientId: string) => [...treatmentKeys.all, "plans", patientId] as const,
  account: (patientId: string) => [...treatmentKeys.all, "account", patientId] as const,
};

export function useTreatmentPlans(patientId: string, clinicBranchId: string) {
  return useQuery({
    queryKey: treatmentKeys.plans(patientId),
    queryFn: () => treatmentApi.plans({ patientId, clinicBranchId, maxResultCount: 50 }),
    enabled: Boolean(patientId),
  });
}

export function usePatientAccount(patientId: string, clinicBranchId: string) {
  return useQuery({
    queryKey: treatmentKeys.account(patientId),
    queryFn: () => treatmentApi.account(patientId, clinicBranchId),
    enabled: Boolean(patientId),
  });
}

/**
 * Slips, the patient account and the stage panel all read the same money, so any
 * change invalidates the whole treatment namespace as well as the consulting one.
 */
function useTreatmentMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["consulting"] });
      void queryClient.invalidateQueries({ queryKey: ["treatment-stages"] });
    },
  });
}

export function useOpenTreatmentPlan() {
  return useTreatmentMutation(treatmentApi.openPlan);
}

export function useCompleteServiceLine() {
  return useTreatmentMutation((input: { planId: string; lineId: string }) =>
    treatmentApi.completeService(input.planId, input.lineId),
  );
}

export function useCancelServiceLine() {
  return useTreatmentMutation((input: { planId: string; lineId: string }) =>
    treatmentApi.cancelService(input.planId, input.lineId),
  );
}

export function useRecordPayment() {
  return useTreatmentMutation(treatmentApi.recordPayment);
}
