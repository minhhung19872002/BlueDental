import type { Rule } from "antd/es/form";
import { t } from "@/lib/i18n";
import type {
  PublicInvoiceRequestFormDto,
  PublicInvoiceRequestSubmitDto,
} from "../api/publicInvoiceRequestApi";

export type BuyerKind = "personal" | "company";

export interface PublicInvoiceRequestValues {
  fullName: string;
  birthYear?: number | null;
  phone?: string;
  nationalId?: string;
  personalAddress?: string;
  buyerKind: BuyerKind;
  companyName?: string;
  taxCode?: string;
  companyAddress?: string;
  email?: string;
  wantsPaperInvoice: boolean;
}

export function initialValues(form: PublicInvoiceRequestFormDto): PublicInvoiceRequestValues {
  return {
    fullName: form.fullName,
    birthYear: form.birthYear,
    buyerKind: "personal",
    wantsPaperInvoice: false,
  };
}

/**
 * Built per render so the messages follow the language. A contact the clinic
 * already holds (it has a hint) may be left blank; the server keeps it.
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
    nationalId: [{ pattern: /^(\d{9}|\d{12})$/, message: t("BlueDental:InvoiceRequest:0006") }],
    email: [
      { required: !form.emailHint, whitespace: true, message: t("BlueDental:InvoiceRequest:0003") },
      { type: "email", message: t("BlueDental:InvoiceRequest:0003") },
    ],
    companyName: [{ required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0004") }],
    taxCode: [
      { required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0004") },
      { pattern: /^\d{10}(\d{3})?$/, message: t("BlueDental:InvoiceRequest:0005") },
    ],
  } satisfies Record<string, Rule[]>;
}

const blankToNull = (value: string | undefined) => (value?.trim() ? value.trim() : null);

/** A personal invoice drops the company fields; a blank contact keeps the one on file. */
export function toSubmitBody(values: PublicInvoiceRequestValues): PublicInvoiceRequestSubmitDto {
  const company = values.buyerKind === "company";
  return {
    fullName: values.fullName.trim(),
    birthYear: values.birthYear ?? null,
    phone: blankToNull(values.phone),
    nationalId: blankToNull(values.nationalId),
    personalAddress: blankToNull(values.personalAddress),
    companyName: company ? blankToNull(values.companyName) : null,
    taxCode: company ? blankToNull(values.taxCode) : null,
    companyAddress: company ? blankToNull(values.companyAddress) : null,
    email: blankToNull(values.email),
    wantsPaperInvoice: values.wantsPaperInvoice,
  };
}

/** "Để trống để giữ 09******89" under a field the clinic already holds. */
export function keepHint(hint: string | null): string | undefined {
  return hint ? t("PublicInvoiceRequest:KeepHint", hint) : undefined;
}
