import { Form, type FormInstance } from "antd";
import { SERVICE_TAX_RATE, type ServiceTaxRate } from "../api/taxonomyApi";
import { computeServicePricing, type ServicePricing } from "../api/servicePricing";

/**
 * Watches the price block of the service form and prices it as it is typed,
 * so "Giá sau giảm" and "Thực thu từ khách" follow every keystroke.
 */
export function useServicePricePreview(form: FormInstance): ServicePricing {
  const price = Form.useWatch<number | undefined>("price", form) ?? 0;
  const discountValue = Form.useWatch<number | undefined>("discountValue", form) ?? 0;
  const discountIsPercent = Form.useWatch<boolean | undefined>("discountIsPercent", form) ?? true;
  const taxRate =
    Form.useWatch<ServiceTaxRate | undefined>("taxRate", form) ?? SERVICE_TAX_RATE.NotTaxable;
  const priceIncludesTax = Form.useWatch<boolean | undefined>("priceIncludesTax", form) ?? false;

  return computeServicePricing({ price, discountValue, discountIsPercent, taxRate, priceIncludesTax });
}
