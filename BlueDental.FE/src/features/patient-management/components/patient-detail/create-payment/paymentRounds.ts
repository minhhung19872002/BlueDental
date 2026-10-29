import {
  PAYMENT_STATUS,
  type PatientPaymentDto,
  type PatientPaymentLineDto,
  type TreatmentServiceDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { calculateVoucherDiscount, type VoucherDto } from "@/features/voucher/api/voucherApi";
import { t } from "@/lib/i18n";
import { voucherTargets } from "../../../utils/planVoucherPricing";

/**
 * The đợt of a slip (P2910, F-83) as the dialog previews them. Every figure
 * here mirrors the server's `PaymentRound` and `TreatmentPlan` arithmetic, so
 * what the cashier sees is what the receipt will hold; the server works it all
 * out again on save. "Before" is the line as its paid receipts left it: a
 * pending receipt — the one being corrected included — counts nowhere.
 */

/** Giảm giá thu ngân typed in đồng or as % of what the line still owes before VAT. */
export type DiscountUnit = "money" | "percent";

/** What the cashier sets on one ticked line of this đợt. */
export interface LineTerms {
  /** "Tên trên phiếu gửi khách"; null keeps the default name. */
  receiptName: string | null;
  unit: DiscountUnit;
  /** Đồng, or a percentage 0–100. */
  value: number | undefined;
  reason: string;
}

export const BLANK_TERMS: LineTerms = { receiptName: null, unit: "money", value: undefined, reason: "" };

/** One earlier đợt of a line: the receipt and what it did to that line. */
export interface EarlierRound {
  receipt: PatientPaymentDto;
  line: PatientPaymentLineDto;
}

/** A receipt still standing — whatever its status, short of cancelled. */
export const isLive = (receipt: PatientPaymentDto) =>
  !receipt.isDeleted && receipt.status !== PAYMENT_STATUS.Cancelled;

/**
 * The live receipts that came before this đợt, oldest first. Correcting a
 * receipt keeps its own number: only those written before it count.
 */
export function earlierReceipts(
  receipts: PatientPaymentDto[],
  revision: PatientPaymentDto | null,
): PatientPaymentDto[] {
  return receipts
    .filter((receipt) => isLive(receipt) && receipt.id !== revision?.id)
    .filter((receipt) => !revision || receipt.creationTime < revision.creationTime)
    .sort((a, b) => a.creationTime.localeCompare(b.creationTime));
}

/** The earlier đợt that paid or let off `lineId`, oldest first. */
export function roundsOfLine(receipts: PatientPaymentDto[], lineId: string): EarlierRound[] {
  return receipts.flatMap((receipt) => {
    const line = receipt.lines.find((item) => item.treatmentServiceId === lineId);
    return line ? [{ receipt, line }] : [];
  });
}

/** "Tên DV – Đợt N" from đợt 2 on; đợt 1 keeps the plain name. */
export function defaultReceiptName(serviceName: string, round: number): string {
  return round > 1 ? t("Patient:Payment:RoundName", serviceName, round) : serviceName;
}

/**
 * The "Tên trên phiếu" a line is saved with: what the cashier typed, else the
 * đợt's default. The server prints the service's own name for null, so a name
 * that is blank or just that name is not sent.
 */
export function receiptNameToSend(terms: LineTerms, serviceName: string, round: number): string | null {
  const name = (terms.receiptName ?? defaultReceiptName(serviceName, round)).trim();
  return name && name !== serviceName ? name : null;
}

/** Còn nợ chưa thuế: the ceiling of TN giảm and the base of its %. */
export function cashierDiscountOf(terms: LineTerms | undefined, line: TreatmentServiceDto): number {
  if (!terms || terms.value === undefined) return 0;
  const room = line.preTaxOutstandingAmount;
  const raw = terms.unit === "percent" ? Math.round((room * terms.value) / 100) : terms.value;
  return Math.min(Math.max(raw, 0), room);
}

/**
 * `PaymentRound.SplitEvenly`: equal whole-đồng shares, the odd đồng on the
 * last line; a line full at its room passes the rest on, round after round.
 */
export function splitEvenly(amount: number, room: Map<string, number>): Map<string, number> {
  const shares = new Map([...room.keys()].map((id) => [id, 0]));
  let open = [...room.entries()].filter(([, value]) => value > 0).map(([id]) => id);
  let left = amount;

  while (left > 0 && open.length > 0) {
    const each = Math.floor(left / open.length);
    const odd = left - each * open.length;
    const last = open[open.length - 1];
    for (const id of open) {
      const give = Math.min(id === last ? each + odd : each, (room.get(id) ?? 0) - (shares.get(id) ?? 0));
      shares.set(id, (shares.get(id) ?? 0) + give);
      left -= give;
    }
    open = open.filter((id) => (shares.get(id) ?? 0) < (room.get(id) ?? 0));
  }
  return shares;
}

/** What a payment-time voucher reaches and takes off, line by line. */
export interface RoundVoucherPrice {
  /** Σ of what the lines it reaches still owe before VAT, after TN giảm — its order amount. */
  base: number;
  total: number;
  shares: Map<string, number>;
}

const NO_VOUCHER: RoundVoucherPrice = { base: 0, total: 0, shares: new Map() };

/** The room a voucher has on each chosen line it reaches: Còn nợ chưa thuế once TN giảm is off. */
function voucherRoom(voucher: VoucherDto, lines: TreatmentServiceDto[], discounts: Map<string, number>) {
  return new Map(
    lines
      .filter((line) => voucher.scopeTarget !== "service" || voucherTargets(voucher, line))
      .map((line) => [line.id, Math.max(0, line.preTaxOutstandingAmount - (discounts.get(line.id) ?? 0))]),
  );
}

/** `PaymentRound.UseVoucher`'s pricing: on the room it reaches, split evenly over it. */
export function priceRoundVoucher(
  voucher: VoucherDto | null,
  lines: TreatmentServiceDto[],
  discounts: Map<string, number>,
): RoundVoucherPrice {
  if (!voucher) return NO_VOUCHER;
  const room = voucherRoom(voucher, lines, discounts);
  const base = [...room.values()].reduce((sum, value) => sum + value, 0);
  if (base <= 0) return { ...NO_VOUCHER, base };
  const total = Math.min(Math.round(calculateVoucherDiscount(voucher, base)), base);
  return { base, total, shares: splitEvenly(total, room) };
}

/** Whether the voucher would take anything off these lines, its minimum order met. */
export function voucherApplies(voucher: VoucherDto, lines: TreatmentServiceDto[], discounts: Map<string, number>) {
  const { base } = priceRoundVoucher(voucher, lines, discounts);
  return base > 0 && (voucher.minOrderValue === null || base >= voucher.minOrderValue);
}

/** One chosen line with this đợt's relief applied. */
export interface LineFigures {
  line: TreatmentServiceDto;
  /** TN giảm in đồng. */
  discount: number;
  voucherShare: number;
  /** The line's whole VAT once every relief, this đợt's included, is off. */
  tax: number;
  /** Còn nợ once this đợt's relief is off: the most this đợt may collect. */
  cap: number;
  /** The VAT inside the money the line collected before, backed out of its figures. */
  paidTax: number;
}

const taxOn = (line: TreatmentServiceDto, amount: number) =>
  line.taxPercent === 0 ? 0 : Math.round((amount * line.taxPercent) / 100);

/**
 * The VAT the earlier đợt carried. The server sends Còn nợ chưa thuế as
 * charged − relief − (cash − tax), so the tax falls back out of it.
 */
function paidTaxOf(line: TreatmentServiceDto): number {
  const tax = line.preTaxOutstandingAmount - (line.chargedAmount - line.reliefAmount) + line.paidAmount;
  return Math.min(Math.max(tax, 0), line.paidAmount);
}

export function lineFigures(line: TreatmentServiceDto, discount: number, voucherShare: number): LineFigures {
  const charged = Math.max(0, line.chargedAmount - line.reliefAmount - discount - voucherShare);
  const tax = taxOn(line, charged);
  return {
    line,
    discount,
    voucherShare,
    tax,
    cap: Math.max(0, charged + tax - line.paidAmount),
    paidTax: paidTaxOf(line),
  };
}

/**
 * `TreatmentPlan.RoundTaxOf`: the VAT inside `amount`, backed out at the
 * line's rate — or, on the đợt that clears the line, its whole VAT less what
 * the earlier đợt carried, so the rounding lands on the last.
 */
export function roundTaxOf(figures: LineFigures, amount: number): number {
  const { line, tax, cap, paidTax } = figures;
  if (line.taxPercent === 0 || amount <= 0) return 0;
  const owed = Math.max(0, tax - paidTax);
  const share = cap - amount <= 0 ? owed : Math.round((amount * line.taxPercent) / (100 + line.taxPercent));
  return Math.min(Math.max(share, 0), Math.min(amount, owed));
}

/** Tự động: the amount poured over the lines in slip order, each up to its cap — as the server spreads it. */
export function spreadAuto(amount: number, figures: LineFigures[]): Map<string, number> {
  let left = amount;
  return new Map(
    figures.map((item) => {
      const take = Math.min(Math.max(left, 0), item.cap);
      left -= take;
      return [item.line.id, take];
    }),
  );
}
