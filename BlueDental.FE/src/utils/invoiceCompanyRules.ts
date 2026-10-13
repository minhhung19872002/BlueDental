import type { FormRule } from "antd";
import { t } from "@/lib/i18n";

/**
 * The company lines of THÔNG TIN XUẤT HÓA ĐƠN, shown only when Loại hóa đơn is
 * Công ty (BA, R-916): Tên công ty and Mã số thuế are then both required — the
 * server's `InvoiceRequestDetails` rule. Built per render so the messages
 * follow the language.
 */
export function invoiceCompanyRules() {
  const required: FormRule = { required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0004") };
  return {
    companyName: [required],
    taxCode: [required, { pattern: /^\d{10}(\d{3})?$/, message: t("BlueDental:InvoiceRequest:0005") }],
  } satisfies Record<string, FormRule[]>;
}
