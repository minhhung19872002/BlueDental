import type { Rule } from "antd/es/form";
import { t } from "@/lib/i18n";
import { invoiceCompanyRules } from "@/utils/invoiceCompanyRules";
import type {
  PublicInvoiceRequestFormDto,
  PublicInvoiceRequestSubmitDto,
} from "../api/publicInvoiceRequestApi";

/** Only the lines of the chosen Loại hóa đơn are on screen, so any other may be missing. */
export interface PublicInvoiceRequestValues {
  isCompany: boolean;
  fullName?: string;
  birthYear?: number | null;
  phone?: string;
  nationalId?: string;
  personalAddress?: string;
  companyName?: string;
  taxCode?: string;
  companyAddress?: string;
  email?: string;
  wantsPaperInvoice: boolean;
}

/** Cá nhân is ticked first (BA, R-916). */
export function initialValues(form: PublicInvoiceRequestFormDto): PublicInvoiceRequestValues {
  return {
    isCompany: false,
    fullName: form.fullName,
    birthYear: form.birthYear,
    wantsPaperInvoice: false,
  };
}

/**
 * Built per render so the messages follow the language. Cá nhân needs name,
 * phone and CCCD; Công ty needs company name, MST and email. A contact the
 * clinic already holds (it has a hint) may be left blank; the server keeps it.
 */
export function publicRules(form: PublicInvoiceRequestFormDto) {
  return {
    fullName: [{ required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0001") }],
    birthYear: [
      { type: "number", min: 1900, max: new Date().getFullYear(), message: t("BlueDental:InvoiceRequest:0007") },
    ],
    phone: [
      { required: !form.phoneHint, whitespace: true, message: t("BlueDental:InvoiceRequest:0002") },
      { pattern: /^\d{8,15}$/, message: t("BlueDental:InvoiceRequest:0002") },
    ],
    nationalId: [
      { required: !form.nationalIdHint, whitespace: true, message: t("BlueDental:InvoiceRequest:0016") },
      { pattern: /^(\d{9}|\d{12})$/, message: t("BlueDental:InvoiceRequest:0006") },
    ],
    email: [
      { required: !form.emailHint, whitespace: true, message: t("BlueDental:InvoiceRequest:0003") },
      { type: "email", message: t("BlueDental:InvoiceRequest:0003") },
    ],
    ...invoiceCompanyRules(),
  } satisfies Record<string, Rule[]>;
}

const blankToNull = (value: string | undefined) => (value?.trim() ? value.trim() : null);

/** Only the chosen kind's lines go out; a blank contact keeps the one on file. */
export function toSubmitBody(values: PublicInvoiceRequestValues): PublicInvoiceRequestSubmitDto {
  const company = values.isCompany;
  return {
    isCompany: company,
    fullName: company ? null : blankToNull(values.fullName),
    birthYear: company ? null : (values.birthYear ?? null),
    phone: company ? null : blankToNull(values.phone),
    nationalId: company ? null : blankToNull(values.nationalId),
    personalAddress: company ? null : blankToNull(values.personalAddress),
    companyName: company ? blankToNull(values.companyName) : null,
    taxCode: company ? blankToNull(values.taxCode) : null,
    companyAddress: company ? blankToNull(values.companyAddress) : null,
    email: company ? blankToNull(values.email) : null,
    wantsPaperInvoice: values.wantsPaperInvoice,
  };
}
