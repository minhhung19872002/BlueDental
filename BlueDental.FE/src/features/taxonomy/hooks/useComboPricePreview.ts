import { useEffect } from "react";
import { Form, type FormInstance } from "antd";
import { SERVICE_TAX_RATE, type ServiceTaxRate } from "../api/taxonomyApi";
import {
  comboRowsTotal,
  computeComboPricing,
  type ComboPricing,
  type ComboPricingRow,
} from "../api/comboPricing";

/**
 * Prices a combo as it is put together. Giá combo is the form's `price`
 * field: each edit of the rows (`edits` goes up) refills it with Σ thành
 * tiền × SL, and the user may type over it afterwards (BA 2026-10-06). A
 * saved combo opening keeps its stored price — loading is not an edit.
 * Tax, Thực thu and the saving follow whatever the field holds.
 */
export function useComboPricePreview(
  form: FormInstance,
  rows: ComboPricingRow[],
  edits: number,
): ComboPricing {
  const taxRate =
    Form.useWatch<ServiceTaxRate | undefined>("taxRate", form) ?? SERVICE_TAX_RATE.NotTaxable;
  const priceIncludesTax = Form.useWatch<boolean | undefined>("priceIncludesTax", form) ?? false;
  const price = Form.useWatch<number | undefined>("price", form) ?? 0;

  useEffect(() => {
    if (edits === 0) return;
    form.setFieldValue("price", comboRowsTotal(rows));
  }, [edits, form, rows]);

  return computeComboPricing(rows, price, taxRate, priceIncludesTax);
}
