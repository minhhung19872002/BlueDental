import { SERVICE_TAX_RATE, type ServiceTaxRate } from "./taxonomyApi";

/** The percentage each "% thuế" choice charges; the two non-numeric ones charge nothing. */
const TAX_PERCENT: Record<ServiceTaxRate, number> = {
  [SERVICE_TAX_RATE.NotTaxable]: 0,
  [SERVICE_TAX_RATE.NotDeclared]: 0,
  [SERVICE_TAX_RATE.Zero]: 0,
  [SERVICE_TAX_RATE.Five]: 5,
  [SERVICE_TAX_RATE.Eight]: 8,
  [SERVICE_TAX_RATE.Ten]: 10,
};

export interface ServicePricingInput {
  price: number;
  discountIsPercent: boolean;
  discountValue: number;
  taxRate: ServiceTaxRate;
  priceIncludesTax: boolean;
}

export interface ServicePricing {
  /** "Giá sau giảm" — the discounted price without VAT. */
  priceAfterDiscount: number;
  /** "Thực thu từ khách (Đã gồm VAT)". */
  amountCollected: number;
}

const roundToCents = (value: number) => Math.round(value * 100) / 100;

/**
 * Mirrors `CatalogServiceConfig.PriceAfterDiscount` / `AmountCollected` so the
 * dialog can show both boxes while the user types, the way the reference does.
 * Measured on staging 2026-09-24 (docs/clone/pages/taxonomy.md): the discount
 * comes off first, never below zero; "Sau thuế" means the typed price already
 * carries VAT, so it is backed out of the first box; "Trước thuế" adds it to
 * the second. Two decimals like the API; the dialog then shows whole đồng.
 */
export function computeServicePricing(input: ServicePricingInput): ServicePricing {
  const discounted = input.discountIsPercent
    ? input.price * (1 - input.discountValue / 100)
    : input.price - input.discountValue;
  const net = Math.max(discounted, 0);
  const taxFactor = 1 + TAX_PERCENT[input.taxRate] / 100;

  return input.priceIncludesTax
    ? { priceAfterDiscount: roundToCents(net / taxFactor), amountCollected: roundToCents(net) }
    : { priceAfterDiscount: roundToCents(net), amountCollected: roundToCents(net * taxFactor) };
}
