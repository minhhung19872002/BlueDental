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

const owing = (line: TreatmentServiceDto) => line.outstandingAmount > 0;

/**
 * "Giá gốc" of a line: the giá gốc the slip holds for it times the quantity —
 * the price the plan was made at, not Danh mục's price today, which may have
 * moved since (owner 2026-11-01, R-1102, over R-1045's catalog price). A line
 * with no giá gốc falls back to its price, as the server does.
 */
export function listAmount(line: TreatmentServiceDto): number {
  return (line.originalPrice || line.price) * line.quantity;
}

/** "Voucher dịch vụ" and "Voucher KHDT": what the slip's vouchers took off the line. */
export function slipVoucherOf(line: TreatmentServiceDto): number {
  return line.serviceVoucherAmount + line.planVoucherShare;
}

/**
 * "Giảm giá bác sĩ": what the doctor took off the line on the slip — a unit
 * price below giá gốc, the line's own discount and its share of the slip's
 * discount. The slip's vouchers are not the doctor's; they read as Voucher.
 */
export function doctorDiscountOf(line: TreatmentServiceDto): number {
  return Math.max(0, listAmount(line) - line.chargedAmount - slipVoucherOf(line));
}

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
