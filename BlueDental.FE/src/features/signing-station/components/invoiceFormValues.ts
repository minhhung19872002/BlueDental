import type { Rule } from "antd/es/form";
import { t } from "@/lib/i18n";
import { invoiceCompanyRules } from "@/utils/invoiceCompanyRules";
import type { StationInvoiceRequestDto } from "../api/signingStationApi";

/** Only the lines of the chosen kind are on screen, so any other may be missing. */
export interface StationInvoiceValues {
  isCompany: boolean;
  fullName?: string;
  phone?: string;
  nationalId?: string;
  personalAddress?: string;
  companyName?: string;
  taxCode?: string;
  companyAddress?: string;
  email?: string;
}

/** Doanh nghiệp / Tổ chức is the first segment of the BA mock. */
export const INITIAL_INVOICE_VALUES: StationInvoiceValues = { isCompany: true };

/**
 * Built per render so the messages follow the language. Doanh nghiệp needs
 * MST, tên, địa chỉ and email (BA mock); Cá nhân needs name, phone and CCCD —
 * the server's InvoiceRequestDetails rule. The Cá nhân lines are an
 * assumption: the mock draws only the company side.
 */
export function stationInvoiceRules() {
  return {
    ...invoiceCompanyRules(),
    companyAddress: [{ required: true, whitespace: true, message: t("SigningStation:Invoice:AddressRequired") }],
    email: [
      { required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0003") },
      { type: "email", message: t("BlueDental:InvoiceRequest:0003") },
    ],
    personalEmail: [{ type: "email", message: t("BlueDental:InvoiceRequest:0003") }],
    fullName: [{ required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0001") }],
    phone: [
      { required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0002") },
      { pattern: /^\d{8,15}$/, message: t("BlueDental:InvoiceRequest:0002") },
    ],
    nationalId: [
      { required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0016") },
      { pattern: /^(\d{9}|\d{12})$/, message: t("BlueDental:InvoiceRequest:0006") },
    ],
  } satisfies Record<string, Rule[]>;
}

const blankToNull = (value: string | undefined) => (value?.trim() ? value.trim() : null);

/** Only the chosen kind's lines go out; Người mua hàng rides along with a company. */
export function toStationInvoiceBody(values: StationInvoiceValues): StationInvoiceRequestDto {
  const company = values.isCompany;
  return {
    isCompany: company,
    fullName: blankToNull(values.fullName),
    birthYear: null,
    phone: company ? null : blankToNull(values.phone),
    nationalId: company ? null : blankToNull(values.nationalId),
    personalAddress: company ? null : blankToNull(values.personalAddress),
    companyName: company ? blankToNull(values.companyName) : null,
    taxCode: company ? blankToNull(values.taxCode) : null,
    companyAddress: company ? blankToNull(values.companyAddress) : null,
    email: blankToNull(values.email),
    wantsPaperInvoice: false,
  };
}
