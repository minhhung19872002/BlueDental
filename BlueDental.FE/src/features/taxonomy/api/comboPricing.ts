import { taxPercentOf } from "./servicePricing";
import type { ServiceTaxRate } from "./taxonomyApi";

/** One "Thành phần combo" row as the dialog holds it. */
export interface ComboRowDraft {
  componentEntryId: string;
  name: string;
  /** "Đơn giá" — the service's own catalogue price, read-only here. */
  retailPrice: number;
  quantity: number;
  /** "Thành tiền" — one unit's price inside the combo, editable. */
  unitPrice: number;
}

export interface ComboPricingInput {
  rows: ComboRowDraft[];
  taxRate: ServiceTaxRate;
  /** "Sau thuế": the combo price already carries VAT. */
  priceIncludesTax: boolean;
}

export interface ComboPricing {
  /** "Tổng giá lẻ" — Σ đơn giá × số lượng. */
  retailTotal: number;
  /** "Giá combo" — Σ thành tiền × số lượng. */
  comboPrice: number;
  /** "Tiền thuế". */
  taxAmount: number;
  /** "Thực thu (Đã gồm VAT)". */
  amountCollected: number;
  /** "Khách tiết kiệm" — never below zero. */
  savings: number;
  /** The same saving as a whole percentage of Tổng giá lẻ. */
  savingsPercent: number;
}

/**
 * The combo dialog's figures, exactly as review P0510 writes them:
 *
 * - Tổng giá lẻ = Σ đơn giá × số lượng; Giá combo = Σ thành tiền × số lượng.
 * - Tiền thuế: "Trước thuế" → Giá combo × % thuế; "Sau thuế" → Giá combo ×
 *   % thuế ÷ (1 + % thuế). KCT, KKKNT and 0% give 0 đ.
 * - Thực thu: "Trước thuế" → Giá combo + Tiền thuế; "Sau thuế" → Giá combo −
 *   Tiền thuế.
 *
 * The "Sau thuế" Thực thu is the review's own formula; it is recorded in
 * docs/clone/unknowns.md because it reads as the price without VAT.
 */
export function computeComboPricing({ rows, taxRate, priceIncludesTax }: ComboPricingInput): ComboPricing {
  const retailTotal = rows.reduce((sum, row) => sum + row.retailPrice * row.quantity, 0);
  const comboPrice = rows.reduce((sum, row) => sum + row.unitPrice * row.quantity, 0);
  const rate = taxPercentOf(taxRate) / 100;
  const taxAmount = Math.round(priceIncludesTax ? (comboPrice * rate) / (1 + rate) : comboPrice * rate);
  const amountCollected = priceIncludesTax ? comboPrice - taxAmount : comboPrice + taxAmount;
  const savings = Math.max(retailTotal - comboPrice, 0);
  const savingsPercent = retailTotal > 0 ? Math.round((savings / retailTotal) * 100) : 0;

  return { retailTotal, comboPrice, taxAmount, amountCollected, savings, savingsPercent };
}
