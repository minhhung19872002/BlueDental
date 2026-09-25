import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { QueryEntity } from "@/lib/queryEntities";
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
  [SERVICE_LINE_STATUS.Created]: { label: t("Treatment:Service:StatusCreated"), color: "default" },
  [SERVICE_LINE_STATUS.InProgress]: { label: t("Treatment:Service:StatusInProgress"), color: "processing" },
  [SERVICE_LINE_STATUS.Done]: { label: t("Treatment:Care:StatusDone"), color: "green" },
  [SERVICE_LINE_STATUS.Cancelled]: { label: t("Treatment:Service:StatusCancelled"), color: "red" },
  [SERVICE_LINE_STATUS.Replaced]: { label: t("Treatment:Service:StatusReplaced"), color: "purple" },
  [SERVICE_LINE_STATUS.Warranty]: { label: t("Treatment:Service:StatusWarranty"), color: "gold" },
  [SERVICE_LINE_STATUS.Transferred]: { label: t("Treatment:Service:StatusTransferred"), color: "purple" },
});

/** Matches BlueDental.Billing.PatientPaymentKind. */
export const PAYMENT_KIND = { Payment: 1, Refund: 2, Prepaid: 3 } as const;
export type PatientPaymentKind = (typeof PAYMENT_KIND)[keyof typeof PAYMENT_KIND];

export const paymentKindConfig = (): Record<PatientPaymentKind, { label: string; color: string }> => ({
  [PAYMENT_KIND.Payment]: { label: t("Treatment:Payment:PaymentKindPayment"), color: "green" },
  [PAYMENT_KIND.Refund]: { label: t("Treatment:Refund:Refund"), color: "red" },
  [PAYMENT_KIND.Prepaid]: { label: t("Treatment:Payment:PaymentKindPrepaid"), color: "blue" },
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
  [PAYMENT_METHOD.Cash]: t("Treatment:Payment:Cash"),
  [PAYMENT_METHOD.Banking]: t("Treatment:Payment:Banking"),
  [PAYMENT_METHOD.EWallet]: t("Treatment:Payment:EWallet"),
  [PAYMENT_METHOD.Card]: t("Treatment:Payment:Card"),
  [PAYMENT_METHOD.OutstandingDebt]: t("Treatment:Debt:OutstandingDebt"),
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
  [CARE_STATUS.New]: t("Treatment:Care:StatusNew"),
  [CARE_STATUS.Contacted]: t("Treatment:Care:StatusContacted"),
  [CARE_STATUS.Succeeded]: t("Treatment:Care:StatusSucceeded"),
  [CARE_STATUS.Failed]: t("Treatment:Care:StatusFailed"),
  [CARE_STATUS.Cancelled]: t("Treatment:Care:StatusCancelled"),
});

/**
 * "Lịch sử dư nợ" — the six movements the reference's own table knows, read
 * off its published bundle 2026-09-22.
 */
export const DEBT_MOVEMENT = {
  Topup: 1,
  Use: 2,
  Withdraw: 3,
  Replace: 4,
  Refund: 5,
  Cancel: 6,
} as const;
export type DebtMovementType = (typeof DEBT_MOVEMENT)[keyof typeof DEBT_MOVEMENT];

/** The reference's wording, verbatim. */
export const debtMovementLabels = (): Record<DebtMovementType, string> => ({
  [DEBT_MOVEMENT.Topup]: t("Treatment:Debt:DebtTopup"),
  [DEBT_MOVEMENT.Use]: t("Treatment:Debt:DebtUse"),
  [DEBT_MOVEMENT.Withdraw]: t("Treatment:Debt:DebtWithdraw"),
  [DEBT_MOVEMENT.Replace]: t("Treatment:Debt:DebtReplace"),
  [DEBT_MOVEMENT.Refund]: t("Treatment:Debt:DebtRefund"),
  [DEBT_MOVEMENT.Cancel]: t("Treatment:Debt:DebtCancel"),
});

/** The three that put money back on the account; the rest take it off. */
const DEBT_CREDITS: DebtMovementType[] = [
  DEBT_MOVEMENT.Topup,
  DEBT_MOVEMENT.Refund,
  DEBT_MOVEMENT.Cancel,
];

/**
 * Which way a movement goes. "Thay thế dịch vụ" is the one type that can go
 * either way, so it reads its own sign; the others are decided by the type.
 */
export function isDebtCredit(type: DebtMovementType, amount: number): boolean {
  return type === DEBT_MOVEMENT.Replace ? amount >= 0 : DEBT_CREDITS.includes(type);
}

export interface DebtHistoryEntryDto {
  id: string;
  date: string;
  type: DebtMovementType;
  amount: number;
  note: string | null;
  staffName: string | null;
}

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

/**
 * One labo order sent for a service line — the reference's
 * `include=labOrders[id,statusClinic,status]`. Numeric codes mirror the labo
 * feature's `LABO_STATUS` / `LABO_ORDER_KIND`; only `isUnfinished` is read here.
 */
export interface TreatmentServiceLaboOrderDto {
  id: string;
  orderCode: string;
  status: number;
  kind: number;
  /** Still with the labo: the line cannot be cancelled or converted yet. */
  isUnfinished: boolean;
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
  /** 1-based position on the slip; 0 on lines never dragged. */
  sortOrder: number;
  /** The other half of a "Chuyển đổi dịch vụ", on both the old and new line. */
  replacedId: string | null;
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
  /**
   * Tooth codes the line's công đoạn already hold — "Chỉnh sửa" keeps them
   * picked ("Răng … đang điều trị — không thể bỏ chọn").
   */
  stagedTeeth: number[];
  /** Đã thu on this line alone — slip-wide payments are not counted here. */
  paidAmount: number;
  /** Còn nợ of the line; what the payment dialog offers to collect. */
  outstandingAmount: number;
  /** Null when no care record covers the line's stages — "Chưa chăm sóc". */
  afterCareStatus: CareStatusCode | null;
  /** The labo orders raised on this line, oldest first. */
  labOrders: TreatmentServiceLaboOrderDto[];
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

/**
 * PUT patient-treatments/{id}/services/{lineId} — "Chỉnh sửa" on a saved line.
 * The service and its status stay as they are.
 */
export type UpdateTreatmentServiceInput = Omit<
  AddTreatmentServiceInput,
  "serviceId" | "status" | "discountType" | "discountValue"
>;

/** "Loại chuyển đổi" — the reference's two conversion kinds. */
export const CONVERSION_TYPE = { Replace: 1, OldService: 2 } as const;
export type ConversionType = (typeof CONVERSION_TYPE)[keyof typeof CONVERSION_TYPE];

/** "Xử lý chênh lệch" — what happens to money collected beyond the new price. */
export const DIFFERENCE_HANDLING = { Refund: 1, Debt: 2 } as const;
export type DifferenceHandling =
  (typeof DIFFERENCE_HANDLING)[keyof typeof DIFFERENCE_HANDLING];

export interface ConvertServiceInput {
  conversionType: ConversionType;
  /** Required for Thay thế; ignored for Dịch vụ cũ. */
  serviceId: string | null;
  /** "Thanh toán" — null charges the new service's full price. */
  paymentAmount: number | null;
  differenceHandling: DifferenceHandling | null;
  note: string;
  teeth: ToothSelectionDto[];
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
  /** Which of the clinic's accounts took the money; only Ngân hàng and Ví momo carry one. */
  paymentAccountId: string | null;
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
  /** The plan-level voucher worked out on Chẩn đoán & Tư vấn. */
  voucherDiscountAmount?: number;
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

  updateService: (
    planId: string,
    lineId: string,
    input: UpdateTreatmentServiceInput,
  ): Promise<TreatmentPlanSlipDto> =>
    api
      .put<TreatmentPlanSlipDto>(`${PLANS}/${planId}/services/${lineId}`, input)
      .then((r) => r.data),

  completeService: (planId: string, lineId: string): Promise<TreatmentPlanSlipDto> =>
    api
      .post<TreatmentPlanSlipDto>(`${PLANS}/${planId}/services/${lineId}/complete`)
      .then((r) => r.data),

  cancelService: (planId: string, lineId: string): Promise<TreatmentPlanSlipDto> =>
    api
      .post<TreatmentPlanSlipDto>(`${PLANS}/${planId}/services/${lineId}/cancel`)
      .then((r) => r.data),

  /** "Hủy phiếu Labo": closes every unfinished labo order of the line. */
  cancelServiceLaboOrders: (planId: string, lineId: string): Promise<TreatmentPlanSlipDto> =>
    api
      .post<TreatmentPlanSlipDto>(`${PLANS}/${planId}/services/${lineId}/cancel-labo-orders`)
      .then((r) => r.data),

  convertService: (
    planId: string,
    lineId: string,
    input: ConvertServiceInput,
  ): Promise<TreatmentPlanSlipDto> =>
    api
      .post<TreatmentPlanSlipDto>(`${PLANS}/${planId}/services/${lineId}/convert`, input)
      .then((r) => r.data),

  reorderService: (
    planId: string,
    input: { serviceLineId: string; sortOrder: number },
  ): Promise<TreatmentPlanSlipDto> =>
    api
      .post<TreatmentPlanSlipDto>(`${PLANS}/${planId}/services/reorder`, input)
      .then((r) => r.data),

  debtHistory: (params: {
    patientId: string;
    clinicBranchId?: string;
    skipCount: number;
    maxResultCount: number;
  }): Promise<PagedResult<DebtHistoryEntryDto>> =>
    api
      .get<PagedResult<DebtHistoryEntryDto>>(`${PAYMENTS}/debt-history`, { params })
      .then((r) => r.data),

  account: (patientId: string, clinicBranchId: string): Promise<PatientAccountDto> =>
    api
      .get<PatientAccountDto>(`${PAYMENTS}/account`, { params: { patientId, clinicBranchId } })
      .then((r) => r.data),

  recordPayment: (input: RecordPaymentInput): Promise<PatientPaymentDto> =>
    api.post<PatientPaymentDto>(PAYMENTS, input).then((r) => r.data),

  updatePayment: (id: string, input: UpdatePaymentInput): Promise<PatientPaymentDto> =>
    api.put<PatientPaymentDto>(`${PAYMENTS}/${id}`, input).then((r) => r.data),

  deletePayment: (id: string): Promise<void> =>
    api.delete(`${PAYMENTS}/${id}`).then(() => undefined),
};

/** Body of `PUT patient-payments/{id}` — how the money was taken, not how much. */
export interface UpdatePaymentInput {
  method: PaymentMethodKind;
  paidAt?: string;
  note?: string | null;
  paymentAccountId?: string | null;
}

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
 * change invalidates the whole treatment namespace as well as the consulting one
 * — the "treatment" entity. Money that moves adds "payment" (reports, Tài chính,
 * CSKH); a write reaching labo orders adds "laboOrder".
 */
function useTreatmentMutation<TVariables, TData>(
  fn: (variables: TVariables) => Promise<TData>,
  also: readonly QueryEntity[] = [],
) {
  return useMutation({
    mutationFn: fn,
    meta: { invalidates: ["treatment", ...also] },
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

export function useUpdateServiceLine() {
  return useTreatmentMutation(
    (input: { planId: string; lineId: string; line: UpdateTreatmentServiceInput }) =>
      treatmentApi.updateService(input.planId, input.lineId, input.line),
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

/** "Lịch sử dư nợ" of one patient, newest first. */
export function usePatientDebtHistory(
  patientId: string,
  clinicBranchId: string | undefined,
  page: { skipCount: number; maxResultCount: number },
) {
  return useQuery({
    queryKey: [...treatmentKeys.all, "debt-history", patientId, clinicBranchId, page],
    queryFn: () => treatmentApi.debtHistory({ patientId, clinicBranchId, ...page }),
    enabled: Boolean(patientId),
  });
}

/** "Hủy phiếu Labo" on the Chuyển đổi dialog — the line's open labo orders. */
export function useCancelServiceLaboOrders() {
  return useTreatmentMutation(
    (input: { planId: string; lineId: string }) =>
      treatmentApi.cancelServiceLaboOrders(input.planId, input.lineId),
    ["laboOrder"],
  );
}

/** "Chuyển đổi dịch vụ" on a service line. */
export function useConvertServiceLine() {
  return useTreatmentMutation(
    (input: { planId: string; lineId: string; body: ConvertServiceInput }) =>
      treatmentApi.convertService(input.planId, input.lineId, input.body),
  );
}

/** Where a dragged service line was dropped — `sortOrder` is 1-based. */
export function useReorderServiceLine() {
  return useTreatmentMutation(
    (input: { planId: string; serviceLineId: string; sortOrder: number }) =>
      treatmentApi.reorderService(input.planId, {
        serviceLineId: input.serviceLineId,
        sortOrder: input.sortOrder,
      }),
  );
}

export function useRecordPayment() {
  return useTreatmentMutation(treatmentApi.recordPayment, ["payment"]);
}

/**
 * "Chỉnh sửa" on a receipt row: the channel, the account, the date and the
 * note. The amount and the per-service split cannot move — the slip's rollup is
 * built from them, so a wrong amount is voided and collected again instead.
 */
export function useUpdatePayment() {
  return useTreatmentMutation((input: { id: string } & UpdatePaymentInput) => {
    const { id, ...body } = input;
    return treatmentApi.updatePayment(id, body);
  }, ["payment"]);
}

/** "Huỷ" on a receipt row — the movement is taken back off the slip. */
export function useDeletePayment() {
  return useTreatmentMutation(
    (input: { id: string }) => treatmentApi.deletePayment(input.id),
    ["payment"],
  );
}
