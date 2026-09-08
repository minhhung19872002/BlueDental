import { DISCOUNT_TYPE, type DiscountType } from "../../api/consultingApi";
import type { CatalogOption } from "@/hooks/useCatalogOptions";

/** What the clinician has typed on one ticked row of "Chọn Dịch Vụ". */
export interface AdviseRowDraft {
  price: number;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  note: string;
}

export interface AdviseTotals {
  gross: number;
  discount: number;
  effective: number;
}

/** The header fields the dialog keeps in its Ant Design form. */
export interface AdviseHeaderValues {
  staffId?: string;
  secondStaffId?: string;
  diagnoserId?: string;
  secondDiagnoserId?: string;
  search?: string;
}

/** A fresh row starts at the catalogue price, one unit, no discount. */
export function newRowDraft(service: CatalogOption): AdviseRowDraft {
  return {
    price: service.price ?? 0,
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
  return { gross, discount: capped, effective: gross - capped };
}

export function sumTotals(rows: Iterable<AdviseRowDraft>): AdviseTotals {
  let gross = 0;
  let discount = 0;
  for (const row of rows) {
    const totals = rowTotals(row);
    gross += totals.gross;
    discount += totals.discount;
  }
  return { gross, discount, effective: gross - discount };
}

/** Same loose matching the plan's service picker uses. */
export function matchesSearch(name: string, search: string): boolean {
  const needle = search.trim().toLocaleLowerCase("vi");
  return needle.length === 0 || name.toLocaleLowerCase("vi").includes(needle);
}
