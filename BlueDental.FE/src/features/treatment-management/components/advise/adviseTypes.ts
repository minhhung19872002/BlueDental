import { DISCOUNT_TYPE, type DiscountType } from "../../api/consultingApi";
import type { CatalogComboOption } from "@/hooks/useCatalogCombos";
import type { CatalogOption } from "@/hooks/useCatalogOptions";

/** What the clinician has typed on one ticked row of "Chọn Dịch Vụ". */
export interface AdviseRowDraft {
  /**
   * The service as it was ticked. The list is paged and filtered on the
   * server, so a ticked row may no longer be on screen when Lưu is pressed;
   * the draft carries what saving needs (the reference keeps the same cache).
   */
  service: CatalogOption;
  price: number;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  note: string;
}

export interface AdviseTotals {
  /** "Tổng cộng (giá gốc)" — a combo counts at its Tổng giá lẻ. */
  gross: number;
  /** What was typed off the single rows. */
  discount: number;
  /** "Giảm giá combo" — what the picked combos save against buying their parts. */
  comboDiscount: number;
  effective: number;
}

/** The header fields the dialog keeps in its Ant Design form. */
export interface AdviseHeaderValues {
  staffId?: string;
  secondStaffId?: string;
}

/**
 * A fresh row starts at the service's "Giá sau giảm" — the catalogue price
 * less the discount set on it in Danh mục — one unit, no discount of its own.
 * A discount typed here comes off that price, and is the only one Phiếu tư
 * vấn's Giảm giá counts (project owner, 2026-09-30).
 */
export function newRowDraft(service: CatalogOption): AdviseRowDraft {
  return {
    service,
    price: service.salePrice ?? 0,
    quantity: 1,
    discountType: DISCOUNT_TYPE.Percentage,
    discountValue: 0,
    note: "",
  };
}

/** Mirrors PatientAdvise.EffectiveAmount so the row shows what will be stored. */
export function rowTotals(row: AdviseRowDraft): AdviseTotals {
  const gross = row.price * row.quantity;
  const discount =
    row.discountType === DISCOUNT_TYPE.Money
      ? row.discountValue
      : row.discountType === DISCOUNT_TYPE.Percentage
        ? (gross * row.discountValue) / 100
        : 0;
  const capped = Math.min(Math.max(discount, 0), gross);
  return { gross, discount: capped, comboDiscount: 0, effective: gross - capped };
}

/**
 * The summary card's figures: the single rows as the server will price them,
 * and each picked combo at its Tổng giá lẻ less what it saves — so Thành
 * tiền is what the combo lines are sold at.
 */
export function sumTotals(
  rows: Iterable<AdviseRowDraft>,
  combos: Iterable<CatalogComboOption> = [],
): AdviseTotals {
  let gross = 0;
  let discount = 0;
  let comboDiscount = 0;
  for (const row of rows) {
    const totals = rowTotals(row);
    gross += totals.gross;
    discount += totals.discount;
  }
  for (const combo of combos) {
    const retail = Math.max(combo.retailPrice, combo.salePrice);
    gross += retail;
    comboDiscount += retail - combo.salePrice;
  }
  return { gross, discount, comboDiscount, effective: gross - discount - comboDiscount };
}
