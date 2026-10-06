import { TAX_PERCENT, roundToCents } from "./servicePricing";
import type { ServiceTaxRate } from "./taxonomyApi";

/** What the combo view needs of one "Thành phần combo" row. */
export interface ComboPricingRow {
  quantity: number;
  /** "Đơn giá" — the service's own price in master data. */
  unitPrice: number;
  /** "Thành tiền" — the price of one unit inside the combo. */
  unitAmount: number;
}

export interface ComboPricing {
  /** "Tổng giá lẻ" — Σ đơn giá × SL. */
  retailTotal: number;
  /** "Giá combo" — the price the combo is sold at, as typed (it starts at {@link comboRowsTotal}). */
  comboPrice: number;
  /** "Tiền thuế". */
  taxAmount: number;
  /** "Thực thu (Đã gồm VAT)". */
  amountCollected: number;
  /** "Khách tiết kiệm" — never below zero. */
  savings: number;
  /** The saving as a share of Tổng giá lẻ, 0–100. */
  savingsPercent: number;
}

const sum = (rows: ComboPricingRow[], pick: (row: ComboPricingRow) => number) =>
  rows.reduce((total, row) => total + pick(row) * row.quantity, 0);

/**
 * Giá combo as the formula gives it: Σ thành tiền × SL. The dialog fills the
 * field with it whenever the rows change; the user may then type over it
 * (BA 2026-10-06), and the typed figure is what gets saved.
 */
export function comboRowsTotal(rows: ComboPricingRow[]): number {
  return roundToCents(sum(rows, (row) => row.unitAmount));
}

/**
 * The combo view's figures for the price it is sold at, as the BA wrote them
 * (2026-10-06), mirroring
 * `CatalogServiceConfig.TaxAmount` / `AmountCollected` for a combo:
 *
 * - Trước thuế: Tiền thuế = Giá combo × r;            Thực thu = Giá combo + Tiền thuế
 * - Sau thuế:   Tiền thuế = Giá combo × r ÷ (1 + r);  Thực thu = Giá combo − Tiền thuế
 *
 * r is 0 for KCT, KKKNT and 0%. Two decimals like the API.
 */
export function computeComboPricing(
  rows: ComboPricingRow[],
  price: number,
  taxRate: ServiceTaxRate,
  priceIncludesTax: boolean,
): ComboPricing {
  const retailTotal = roundToCents(sum(rows, (row) => row.unitPrice));
  const comboPrice = roundToCents(Math.max(price, 0));
  const rate = TAX_PERCENT[taxRate] / 100;
  const taxAmount = roundToCents(
    priceIncludesTax ? (comboPrice * rate) / (1 + rate) : comboPrice * rate,
  );
  const amountCollected = roundToCents(
    priceIncludesTax ? comboPrice - taxAmount : comboPrice + taxAmount,
  );
  const savings = Math.max(retailTotal - comboPrice, 0);

  return {
    retailTotal,
    comboPrice,
    taxAmount,
    amountCollected,
    savings,
    savingsPercent: retailTotal > 0 ? (savings / retailTotal) * 100 : 0,
  };
}
