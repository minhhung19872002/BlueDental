import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";
import type { DiscountType, ToothSelectionDto } from "./consultingApi";

import { t } from "@/lib/i18n";
import { PLAN_STATUS, planStatusLabels, type TreatmentPlanStatus } from "@/utils/planStatus";

export { PLAN_STATUS, type TreatmentPlanStatus };

export const planStatusConfig = (): Record<TreatmentPlanStatus, { label: string; color: string }> => {
  const labels = planStatusLabels();
  return {
    [PLAN_STATUS.Draft]: { label: labels[PLAN_STATUS.Draft], color: "default" },
    [PLAN_STATUS.PendingApproval]: { label: labels[PLAN_STATUS.PendingApproval], color: "gold" },
    [PLAN_STATUS.Approved]: { label: labels[PLAN_STATUS.Approved], color: "blue" },
    [PLAN_STATUS.InProgress]: { label: labels[PLAN_STATUS.InProgress], color: "processing" },
    [PLAN_STATUS.Completed]: { label: labels[PLAN_STATUS.Completed], color: "green" },
    [PLAN_STATUS.Cancelled]: { label: labels[PLAN_STATUS.Cancelled], color: "red" },
  };
};

/** Matches BlueDental.TreatmentManagement.TreatmentServiceStatus. */
export const SERVICE_LINE_STATUS = {
  Created: 1,
  InProgress: 2,
  Done: 3,
  Cancelled: 4,
  Replaced: 5,
  /** Bảo hành — the reference's seventh status on a line. */
  Warranty: 6,
  /** Đã chuyển — the line was moved to another slip. */
  Transferred: 7,
} as const;
export type TreatmentServiceStatus =
  (typeof SERVICE_LINE_STATUS)[keyof typeof SERVICE_LINE_STATUS];

export const serviceLineStatusConfig = (): Record<
  TreatmentServiceStatus,
  { label: string; color: string }
> => ({
  [SERVICE_LINE_STATUS.Created]: { label: t("Chưa điều trị"), color: "default" },
  [SERVICE_LINE_STATUS.InProgress]: { label: t("Đang điều trị"), color: "processing" },
  [SERVICE_LINE_STATUS.Done]: { label: t("Hoàn thành"), color: "green" },
  [SERVICE_LINE_STATUS.Cancelled]: { label: t("Đã huỷ"), color: "red" },
  [SERVICE_LINE_STATUS.Replaced]: { label: t("Đã thay thế"), color: "purple" },
  [SERVICE_LINE_STATUS.Warranty]: { label: t("Bảo hành"), color: "gold" },
  [SERVICE_LINE_STATUS.Transferred]: { label: t("Đã chuyển"), color: "purple" },
});

/** Matches BlueDental.Billing.PatientPaymentKind. */
export const PAYMENT_KIND = { Payment: 1, Refund: 2, Prepaid: 3 } as const;
export type PatientPaymentKind = (typeof PAYMENT_KIND)[keyof typeof PAYMENT_KIND];

export const paymentKindConfig = (): Record<PatientPaymentKind, { label: string; color: string }> => ({
  [PAYMENT_KIND.Payment]: { label: t("Thu tiền"), color: "green" },
  [PAYMENT_KIND.Refund]: { label: t("Hoàn tiền"), color: "red" },
  [PAYMENT_KIND.Prepaid]: { label: t("Nạp quỹ"), color: "blue" },
});

/** Matches BlueDental.Billing.PaymentMethodKind. */
export const PAYMENT_METHOD = {
  Cash: 1,
  Banking: 2,
  Card: 3,
  OutstandingDebt: 4,
  EWallet: 5,
} as const;
export type PaymentMethodKind = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

/** The reference's own wording, in the order its payment dialog offers them. */
export const paymentMethodLabels = (): Record<PaymentMethodKind, string> => ({
  [PAYMENT_METHOD.Cash]: t("Tiền mặt"),
  [PAYMENT_METHOD.Banking]: t("Ngân hàng"),
  [PAYMENT_METHOD.EWallet]: t("Ví momo"),
  [PAYMENT_METHOD.Card]: t("Quẹt thẻ"),
  [PAYMENT_METHOD.OutstandingDebt]: t("Dư nợ"),
});

/** Left to right, as the dialog lays the pills out. */
export const PAYMENT_METHOD_ORDER: PaymentMethodKind[] = [
  PAYMENT_METHOD.Cash,
  PAYMENT_METHOD.Banking,
  PAYMENT_METHOD.EWallet,
  PAYMENT_METHOD.Card,
  PAYMENT_METHOD.OutstandingDebt,
];

/** Matches BlueDental.CustomerCare.CareStatus. */
export const CARE_STATUS = {
  New: 1,
  Contacted: 2,
  Succeeded: 3,
  Failed: 4,
  Cancelled: 5,
} as const;
export type CareStatusCode = (typeof CARE_STATUS)[keyof typeof CARE_STATUS];

/**
 * "Chăm sóc sau điều trị" as the treatment table prints it. A line with no care
 * record at all reads the same as one whose record is still New — the reference
 * shows "Chưa chăm sóc" for both.
 */
export const afterCareLabels = (): Record<CareStatusCode, string> => ({
  [CARE_STATUS.New]: t("Chưa chăm sóc"),
  [CARE_STATUS.Contacted]: t("Đã liên hệ"),
  [CARE_STATUS.Succeeded]: t("Đã chăm sóc"),
  [CARE_STATUS.Failed]: t("Chăm sóc thất bại"),
  [CARE_STATUS.Cancelled]: t("Đã huỷ chăm sóc"),
});

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

/** One step of a service — the reference's service.stages[] entry. */
export interface ServiceStepDto {
  id: string;
  name: string;
  /** The reference's "Giá trị" — what the step pays. Not used on this screen. */
  value: number;
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
  /** Warranty period of the service, in days; 0 means "Không bảo hành". */
  warrantyDays: number;
  /**
   * "Danh sách công đoạn" — the steps this service declares in Danh mục, in
   * their own order. The công đoạn form lists them as checkboxes.
   */
  serviceSteps: ServiceStepDto[];
  /** Nội dung điều trị — the notes on this line's stages, in order. */
  stageNotes: string[];
  /** Đã thu on this line alone — slip-wide payments are not counted here. */
  paidAmount: number;
  /** Còn nợ of the line; what the payment dialog offers to collect. */
  outstandingAmount: number;
  /** Null when no care record covers the line's stages — "Chưa chăm sóc". */
  afterCareStatus: CareStatusCode | null;
  /**
   * The inline row's own columns (Thêm dịch vụ mới). Null on a line pulled
   * from a consulting line — the table falls back to the advise / the slip.
   */
  diagnosisId: string | null;
  diagnosisName: string | null;
  dentistId: string | null;
  dentistName: string | null;
  note: string | null;
  diagnoserStaffId: string | null;
  diagnoserName: string | null;
  secondDiagnoserStaffId: string | null;
  secondDiagnoserName: string | null;
  consultantStaffId: string | null;
  consultantName: string | null;
  secondConsultantStaffId: string | null;
  secondConsultantName: string | null;
}

/** POST patient-treatments/{id}/services — the inline "new row" saved with Lưu. */
export interface AddTreatmentServiceInput {
  serviceId: string;
  price: number;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  teeth: ToothSelectionDto[];
  status: TreatmentServiceStatus;
  diagnosisId: string | null;
  dentistId: string | null;
  note: string | null;
  diagnoserStaffId: string | null;
  secondDiagnoserStaffId: string | null;
  consultantStaffId: string | null;
  secondConsultantStaffId: string | null;
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

/** Matches BlueDental.Billing.PaymentSplitMode. */
export const SPLIT_MODE = { Auto: 1, Manual: 2 } as const;
export type PaymentSplitMode = (typeof SPLIT_MODE)[keyof typeof SPLIT_MODE];

/** One service's share of a receipt. */
export interface PatientPaymentLineDto {
  treatmentServiceId: string;
  amount: number;
}

export interface PatientPaymentDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  treatmentPlanId: string | null;
  splitMode: PaymentSplitMode;
  /** What each service on this receipt was paid. */
  lines: PatientPaymentLineDto[];
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
  /**
   * Every service this one receipt covers — the reference posts a single
   * payment naming them all rather than one payment each.
   */
  treatmentServiceIds?: string[];
  /** Auto lets the server spread `amount`; Manual sends `items`. */
  splitMode?: PaymentSplitMode;
  /** Required when `splitMode` is Manual. */
  items?: PatientPaymentLineDto[];
  kind: PatientPaymentKind;
  method: PaymentMethodKind;
  amount: number;
  staffId: string;
  note?: string;
  /** Required when `method` is Banking or EWallet — the account collected into. */
  paymentAccountId?: string;
}

/** Filters of `GET patient-payments`; the server pages and sorts by `paidAt` desc. */
export interface PatientPaymentListInput {
  patientId: string;
  clinicBranchId: string;
  treatmentPlanId?: string;
  kind?: PatientPaymentKind;
  skipCount?: number;
  maxResultCount?: number;
}

const PLANS = "/v1/app/patient-treatments";

/** `GET {plan}/pdf` — the printable slip; fetched through `downloadFile`. */
export function planPdfUrl(planId: string): string {
  return `${PLANS}/${planId}/pdf`;
}
const PAYMENTS = "/v1/app/patient-payments";

const treatmentApi = {
  plans: (params: {
    patientId?: string;
    clinicBranchId?: string;
    maxResultCount?: number;
  }): Promise<PagedResult<TreatmentPlanSlipDto>> =>
    api.get<PagedResult<TreatmentPlanSlipDto>>(PLANS, { params }).then((r) => r.data),

  plan: (planId: string): Promise<TreatmentPlanSlipDto> =>
    api.get<TreatmentPlanSlipDto>(`${PLANS}/${planId}`).then((r) => r.data),

  payments: (params: PatientPaymentListInput): Promise<PagedResult<PatientPaymentDto>> =>
    api.get<PagedResult<PatientPaymentDto>>(PAYMENTS, { params }).then((r) => r.data),

  openPlan: (input: OpenPlanInput): Promise<TreatmentPlanSlipDto> =>
    api.post<TreatmentPlanSlipDto>(PLANS, input).then((r) => r.data),

  addService: (planId: string, input: AddTreatmentServiceInput): Promise<TreatmentPlanSlipDto> =>
    api.post<TreatmentPlanSlipDto>(`${PLANS}/${planId}/services`, input).then((r) => r.data),

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
  plan: (planId: string) => [...treatmentKeys.all, "plan", planId] as const,
  payments: (params: PatientPaymentListInput) =>
    [...treatmentKeys.all, "payments", params] as const,
};

/** One slip with its service lines and payment summary — the plan-detail page. */
export function usePlanSlip(planId: string) {
  return useQuery({
    queryKey: treatmentKeys.plan(planId),
    queryFn: () => treatmentApi.plan(planId),
    enabled: Boolean(planId),
  });
}

/** The receipts (or refunds, by `kind`) filed against one slip, paged by the server. */
export function usePatientPayments(params: PatientPaymentListInput) {
  return useQuery({
    queryKey: treatmentKeys.payments(params),
    queryFn: () => treatmentApi.payments(params),
    enabled: Boolean(params.patientId),
  });
}

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

export function useAddServiceLine() {
  return useTreatmentMutation((input: { planId: string; line: AddTreatmentServiceInput }) =>
    treatmentApi.addService(input.planId, input.line),
  );
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
