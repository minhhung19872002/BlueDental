import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import {
  paymentMethodLabels,
  type PatientPaymentDto,
  type TreatmentPlanSlipDto,
  type TreatmentServiceDto,
} from "../../api/treatmentPlanApi";

/** One service row of "Chi tiết dịch vụ". */
export interface ReceiptLine {
  service: TreatmentServiceDto;
}

/** One row of "Tổng thanh toán dịch vụ"; the last one is red on the reference. */
export interface ReceiptTotal {
  label: string;
  value: number;
  tone?: "debt";
}

/**
 * What "Chi tiết phiếu" prints — the same shape for a single receipt (the
 * eye on a row) and for "In hóa đơn tổng", which folds every receipt of the
 * slip into one document.
 */
export interface ReceiptView {
  code: string;
  createdLabel: string;
  methodLabel: string;
  note: string;
  lines: ReceiptLine[];
  totals: ReceiptTotal[];
  /** The printed sheet: "Ngày 7 tháng 9 năm 2026", who collected, and the sum it is for. */
  sheetDateLabel: string;
  staffName: string | null;
  amount: number;
}

/** "Ngày 7 tháng 9 năm 2026" — how every printed sheet dates itself. */
export function longDate(value: Date): string {
  return t("Ngày {0} tháng {1} năm {2}", value.getDate(), value.getMonth() + 1, value.getFullYear());
}

function linesOf(plan: TreatmentPlanSlipDto, covers: (service: TreatmentServiceDto) => boolean): ReceiptLine[] {
  return plan.services.filter(covers).map((service) => ({ service }));
}

/** The receipt behind one row of the Thanh toán table. */
export function receiptOf(
  payment: PatientPaymentDto,
  plan: TreatmentPlanSlipDto,
  receipts: PatientPaymentDto[],
): ReceiptView {
  const paidBefore = receipts
    .filter((other) => other.id !== payment.id && other.paidAt < payment.paidAt)
    .reduce((sum, other) => sum + other.amount, 0);
  const covered = new Set(payment.lines.map((line) => line.treatmentServiceId));
  return {
    code: payment.code,
    createdLabel: formatDateTime(payment.paidAt),
    methodLabel: paymentMethodLabels()[payment.method],
    note: payment.note ?? "",
    lines: linesOf(plan, (service) => covered.has(service.id)),
    sheetDateLabel: longDate(new Date(payment.paidAt)),
    staffName: payment.staffName,
    amount: payment.amount,
    totals: [
      { label: t("Tổng phí"), value: plan.payment.totalPrice },
      { label: t("Giảm giá"), value: plan.payment.discount },
      { label: t("Đã trả trước đó"), value: paidBefore },
      { label: t("Số tiền TT"), value: payment.amount },
      { label: t("Tổng còn nợ"), value: Math.max(0, plan.totalAmount - paidBefore - payment.amount), tone: "debt" },
    ],
  };
}

/** "In hóa đơn tổng": every service of the slip and everything collected on it, dated today. */
export function aggregateReceiptOf(plan: TreatmentPlanSlipDto, today: Date): ReceiptView {
  const combined = t("Tổng hợp");
  return {
    code: combined,
    createdLabel: longDate(today),
    methodLabel: combined,
    note: "",
    lines: linesOf(plan, () => true),
    sheetDateLabel: longDate(today),
    staffName: null,
    amount: plan.payment.totalPaid,
    totals: [
      { label: t("Doanh thu dự kiến"), value: plan.payment.totalPrice },
      { label: t("Đã thanh toán"), value: plan.payment.totalPaid },
      { label: t("Công nợ"), value: plan.payment.debt, tone: "debt" },
    ],
  };
}
