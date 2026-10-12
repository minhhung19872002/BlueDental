import {
  PLAN_STATUS,
  type PatientPaymentDto,
  type TreatmentPlanSlipDto,
  type TreatmentServiceDto,
} from "@/features/treatment-management/api/treatmentPlanApi";

/** "Chưa thanh toán" = nothing collected on the slip yet; otherwise "Thanh toán một phần". */
export type SlipPaymentState = "unpaid" | "partial";

/** One row of the "Số phiếu cần thanh toán" dropdown. */
export interface SlipOption {
  slip: TreatmentPlanSlipDto;
  state: SlipPaymentState;
  /** Còn nợ — what the slip's lines still owe, VAT included. */
  debt: number;
  /** How many of its services still owe something. */
  owingCount: number;
}

/** What the services ticked in the dialog add up to ("Tổng tiền dịch vụ đã chọn"). */
export interface SelectedTotals {
  gross: number;
  discount: number;
  afterDiscount: number;
  tax: number;
  payable: number;
  paid: number;
  due: number;
}

const owing = (line: TreatmentServiceDto) => line.outstandingAmount > 0;

/**
 * Only lines that still owe something can be paid; a settled one has nothing
 * for the dialog to collect. A receipt being reopened keeps its own lines in
 * view even when another receipt has since settled them, so they can be unticked.
 */
export function payableLines(
  slip: TreatmentPlanSlipDto | null,
  revision: PatientPaymentDto | null,
): TreatmentServiceDto[] {
  const onReceipt = new Set(revision?.lines.map((line) => line.treatmentServiceId));
  return (slip?.services ?? []).filter((line) => owing(line) || onReceipt.has(line.id));
}

/**
 * The patient's slips that still owe money, newest first as the list comes.
 * A fully paid or cancelled slip is not offered (owner 2026-10-12); the slip
 * the dialog was opened on stays listed so its code still shows.
 */
export function owingSlipOptions(slips: TreatmentPlanSlipDto[], keepId: string | null): SlipOption[] {
  return slips
    .map((slip) => {
      const owingLines = slip.services.filter(owing);
      return {
        slip,
        state: slip.payment.totalPaid > 0 ? ("partial" as const) : ("unpaid" as const),
        debt: owingLines.reduce((sum, line) => sum + line.outstandingAmount, 0),
        owingCount: owingLines.length,
      };
    })
    .filter(
      (option) =>
        option.slip.id === keepId || (option.debt > 0 && option.slip.status !== PLAN_STATUS.Cancelled),
    );
}

/**
 * Gross prices and every discount — the line's own and its share of the slip
 * discount and voucher — so the block reads like the slip's own totals (R-586),
 * only over the ticked services.
 */
export function selectedTotals(lines: TreatmentServiceDto[]): SelectedTotals {
  const sum = (pick: (line: TreatmentServiceDto) => number) =>
    lines.reduce((total, line) => total + pick(line), 0);
  const gross = sum((line) => line.grossAmount);
  const afterDiscount = sum((line) => line.chargedAmount);
  return {
    gross,
    discount: gross - afterDiscount,
    afterDiscount,
    tax: sum((line) => line.taxAmount),
    payable: sum((line) => line.payableAmount),
    paid: sum((line) => line.paidAmount),
    due: sum((line) => line.outstandingAmount),
  };
}
