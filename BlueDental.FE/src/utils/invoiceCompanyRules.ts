import type { FormRule } from "antd";
import { t } from "@/lib/i18n";

/**
 * The company lines of THÔNG TIN XUẤT HÓA ĐƠN, shown only when Loại hóa đơn is
 * Công ty (BA, R-916): Tên công ty, Mã số thuế and Địa chỉ công ty are then
 * required. Cá nhân's CCCD is its Mã số thuế (P1811), and EasyInvoice refuses
 * a Mã số thuế without an address, so Địa chỉ cá nhân is required too — the
 * server's `InvoiceRequestDetails` rule. Built per render so the messages
 * follow the language.
 */
export function invoiceCompanyRules() {
  const required: FormRule = { required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0004") };
  const address: FormRule = { required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0018") };
  return {
    companyName: [required],
    taxCode: [required, { pattern: /^\d{10}(\d{3})?$/, message: t("BlueDental:InvoiceRequest:0005") }],
    companyAddress: [address],
    personalAddress: [address],
  } satisfies Record<string, FormRule[]>;
}
