import type { Rule } from "antd/es/form";
import { t } from "@/lib/i18n";
import type {
  InvoiceRequestDraftDto,
  InvoiceRequestDto,
  InvoiceRequestFormValues,
} from "../../../api/invoiceRequestApi";

export type BuyerKind = "personal" | "company";

/** What the dialog's AntD form holds; the server checks every field again. */
export interface InvoiceRequestFormState {
  patientPaymentId?: string;
  buyerKind: BuyerKind;
  fullName: string;
  birthYear?: number | null;
  phone: string;
  nationalId?: string;
  personalAddress?: string;
  companyName?: string;
  taxCode?: string;
  companyAddress?: string;
  email: string;
  wantsPaperInvoice: boolean;
}

export const EMPTY_FORM: InvoiceRequestFormState = {
  buyerKind: "personal",
  fullName: "",
  phone: "",
  email: "",
  wantsPaperInvoice: false,
};

/** A phone this account may not see comes back with stars; the server keeps the one on file. */
const isMasked = (value: string) => value.includes("*");

/** Built per render so the messages follow the language switch. */
export function formRules() {
  return {
    fullName: [{ required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0001") }],
    phone: [
      { required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0002") },
      {
        validator: (_, value: string | undefined) =>
          !value || isMasked(value) || /^\d{8,15}$/.test(value.trim())
            ? Promise.resolve()
            : Promise.reject(new Error(t("BlueDental:InvoiceRequest:0002"))),
      },
    ],
    email: [
      { required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0003") },
      { type: "email", message: t("BlueDental:InvoiceRequest:0003") },
    ],
    companyName: [{ required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0004") }],
    taxCode: [
      { required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0004") },
      { pattern: /^\d{10}(\d{3})?$/, message: t("BlueDental:InvoiceRequest:0005") },
    ],
    nationalId: [{ pattern: /^(\d{9}|\d{12})$/, message: t("BlueDental:InvoiceRequest:0006") }],
    birthYear: [
      { type: "number", min: 1900, max: new Date().getFullYear(), message: t("BlueDental:InvoiceRequest:0007") },
    ],
    patientPaymentId: [{ required: true, message: t("Patient:InvoiceRequest:PickReceipt") }],
  } satisfies Record<string, Rule[]>;
}

const blankToNull = (value: string | undefined) => (value?.trim() ? value.trim() : null);

/** The body both create and update send; a personal invoice drops the company fields. */
export function toRequestBody(values: InvoiceRequestFormState): InvoiceRequestFormValues {
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

/** The form opened on a request already filed. */
export function fromRequest(row: InvoiceRequestDto): InvoiceRequestFormState {
  return {
    patientPaymentId: row.patientPaymentId,
    buyerKind: row.isCompany ? "company" : "personal",
    fullName: row.fullName,
    birthYear: row.birthYear,
    phone: row.phone,
    nationalId: row.nationalId ?? undefined,
    personalAddress: row.personalAddress ?? undefined,
    companyName: row.companyName ?? undefined,
    taxCode: row.taxCode ?? undefined,
    companyAddress: row.companyAddress ?? undefined,
    email: row.email,
    wantsPaperInvoice: row.wantsPaperInvoice ?? false,
  };
}

/** What the system knows of the customer, filled in once a receipt is picked. */
export function fromDraft(draft: InvoiceRequestDraftDto): Partial<InvoiceRequestFormState> {
  return {
    fullName: draft.fullName,
    birthYear: draft.birthYear,
    phone: draft.phone ?? "",
    nationalId: draft.nationalId ?? undefined,
    personalAddress: draft.personalAddress ?? undefined,
    email: draft.email ?? "",
  };
}
