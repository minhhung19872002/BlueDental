import type { FormRule } from "antd";
import { t } from "@/lib/i18n";

const COMPANY_FIELDS = ["companyName", "taxCode", "companyAddress"] as const;

/**
 * The paper THÔNG TIN XUẤT HÓA ĐƠN has no "personal / company" switch: the
 * company lines are optional, but once any of them is written, Tên công ty and
 * Mã số thuế are both required — the server's `InvoiceRequestDetails` rule.
 * Built per render so the messages follow the language.
 */
export function invoiceCompanyRules() {
  const requiredOnceCompany: FormRule = ({ getFieldValue }) => ({
    validator: (_, value: string | undefined) => {
      const asksCompany = COMPANY_FIELDS.some((name) => String(getFieldValue(name) ?? "").trim() !== "");
      return asksCompany && !value?.trim()
        ? Promise.reject(new Error(t("BlueDental:InvoiceRequest:0004")))
        : Promise.resolve();
    },
  });
  return {
    companyName: [requiredOnceCompany],
    taxCode: [requiredOnceCompany, { pattern: /^\d{10}(\d{3})?$/, message: t("BlueDental:InvoiceRequest:0005") }],
  } satisfies Record<string, FormRule[]>;
}
