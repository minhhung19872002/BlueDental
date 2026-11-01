import { PAYMENT_METHOD, type TreatmentServiceDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { doctorDiscountOf, listAmount, slipVoucherOf } from "./paymentDialogModel";
import { lineFigures, roundTaxOf, spreadAuto, type LineFigures, type RoundVoucherPrice } from "./paymentRounds";
import type { PaymentFormState } from "./usePaymentFields";

/**
 * "Tổng tiền dịch vụ đã chọn" (P2910), in the BA's order. Còn nợ cần thanh
 * toán is Tổng thanh toán less what earlier đợt collected and let off.
 */
export interface RoundTotals {
  /** Tổng tiền — Giá gốc as the slip holds it. */
  gross: number;
  /** Giảm giá bác sĩ — what the doctor took off on the slip, vouchers aside. */
  doctorDiscount: number;
  /** Giảm giá thu ngân of this đợt. */
  cashierDiscount: number;
  /** The slip's vouchers and this đợt's. */
  voucher: number;
  /** Tổng tiền sau giảm — what the slip charges less this đợt's relief. */
  afterDiscount: number;
  /** The lines' whole VAT once every relief, this đợt's included, is off. */
  tax: number;
  /** Tổng thanh toán (gồm VAT). */
  payable: number;
  /** Đã thanh toán — cash of the paid đợt before. */
  paid: number;
  /** Ưu đãi các đợt trước. */
  priorRelief: number;
  /** Còn nợ cần thanh toán — the most this đợt may collect. */
  due: number;
}

interface Input {
  chosen: TreatmentServiceDto[];
  /** Applied TN giảm per line, in đồng. */
  discounts: Map<string, number>;
  voucher: RoundVoucherPrice;
  form: PaymentFormState;
  /** Dư nợ — money the clinic already holds for the patient. */
  heldForPatient: number;
}

const sumOf = <T>(items: T[], pick: (item: T) => number) => items.reduce((sum, item) => sum + pick(item), 0);

/**
 * The đợt's money as the server will work it out: each chosen line with this
 * đợt's TN giảm and voucher share off, the cash spread over them and the VAT
 * inside it, line by line.
 */
export function roundMoney({ chosen, discounts, voucher, form, heldForPatient }: Input) {
  const figures: LineFigures[] = chosen.map((line) =>
    lineFigures(line, discounts.get(line.id) ?? 0, voucher.shares.get(line.id) ?? 0),
  );
  const capOf = new Map(figures.map((item) => [item.line.id, item.cap]));
  const due = sumOf(figures, (item) => item.cap);

  /**
   * What Tự động offers before anything is typed — the whole of what the ticked
   * services owe, Dư nợ capped at the balance actually held for the patient.
   * It is also the ceiling: a figure typed earlier follows it down.
   */
  const autoDefault =
    form.method === PAYMENT_METHOD.OutstandingDebt ? Math.min(Math.max(heldForPatient, 0), due) : due;
  const autoAmount = form.amount === undefined ? autoDefault : Math.min(form.amount, autoDefault);

  /**
   * A box the user has not touched offers the whole of what that line owes,
   * and no box may take more than that (bug list item 24: a receipt above
   * what is owed left the clinic owing the patient).
   */
  const shareOf = (line: TreatmentServiceDto) => {
    const cap = capOf.get(line.id) ?? 0;
    return Math.min(form.manual[line.id] ?? cap, cap);
  };
  const total = form.mode === "auto" ? autoAmount : sumOf(chosen, shareOf);
  const splits =
    form.mode === "auto" ? spreadAuto(total, figures) : new Map(chosen.map((line) => [line.id, shareOf(line)]));
  const cashierDiscount = sumOf(figures, (item) => item.discount);
  const afterDiscount = sumOf(figures, (item) => item.line.chargedAmount - item.discount - item.voucherShare);
  const tax = sumOf(figures, (item) => item.tax);

  const totals: RoundTotals = {
    gross: sumOf(chosen, listAmount),
    doctorDiscount: sumOf(chosen, doctorDiscountOf),
    cashierDiscount,
    voucher: sumOf(chosen, slipVoucherOf) + voucher.total,
    afterDiscount,
    tax,
    payable: afterDiscount + tax,
    paid: sumOf(chosen, (line) => line.paidAmount),
    priorRelief: sumOf(chosen, (line) => line.reliefAmount),
    due,
  };

  return {
    figures,
    capOf: (id: string) => capOf.get(id) ?? 0,
    autoDefault,
    autoAmount,
    shareOf,
    /** What this đợt collects on the line, as the receipt will split it. */
    amountOf: (id: string) => splits.get(id) ?? 0,
    /** Thu đợt này. */
    total,
    /** "trong đó VAT": the VAT inside Thu đợt này, line by line as the receipt stores it. */
    roundTax: sumOf(figures, (item) => roundTaxOf(item, splits.get(item.line.id) ?? 0)),
    /** TN giảm and voucher together: a đợt they settle may collect 0 đ. */
    relief: cashierDiscount + voucher.total,
    totals,
    /** Còn nợ sau đợt này. */
    after: Math.max(0, due - total),
    /** Only meaningful once a line is ticked (R-588). */
    overpaid: chosen.length > 0 && total > due,
  };
}

export type RoundMoney = ReturnType<typeof roundMoney>;
