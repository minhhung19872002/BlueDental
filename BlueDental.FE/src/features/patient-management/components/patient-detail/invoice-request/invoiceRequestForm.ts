import type { Rule } from "antd/es/form";
import { t } from "@/lib/i18n";
import { invoiceCompanyRules } from "@/utils/invoiceCompanyRules";
import type {
  InvoiceRequestDraftDto,
  InvoiceRequestDto,
  InvoiceRequestFormValues,
} from "../../../api/invoiceRequestApi";

/**
 * What the dialog's AntD form holds; the server checks every field again.
 * Only the lines of the chosen Loại hóa đơn are on screen, so any other may be missing.
 */
export interface InvoiceRequestFormState {
  patientPaymentId?: string;
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
export const EMPTY_FORM: InvoiceRequestFormState = {
  isCompany: false,
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
    // SĐT and Email are optional on both kinds (P1811), checked when given.
    phone: [
      {
        validator: (_, value: string | undefined) =>
          !value || isMasked(value) || /^\d{8,15}$/.test(value.trim())
            ? Promise.resolve()
            : Promise.reject(new Error(t("BlueDental:InvoiceRequest:0002"))),
      },
    ],
    email: [
      { type: "email", message: t("BlueDental:InvoiceRequest:0003") },
    ],
    ...invoiceCompanyRules(),
    nationalId: [
      { required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0016") },
      { pattern: /^(\d{9}|\d{12})$/, message: t("BlueDental:InvoiceRequest:0006") },
    ],
    birthYear: [
      { type: "number", min: 1900, max: new Date().getFullYear(), message: t("BlueDental:InvoiceRequest:0007") },
    ],
    patientPaymentId: [{ required: true, message: t("Patient:InvoiceRequest:PickReceipt") }],
  } satisfies Record<string, Rule[]>;
}

const blankToNull = (value: string | undefined) => (value?.trim() ? value.trim() : null);

/** The body both create and update send: only the chosen kind's lines. */
export function toRequestBody(values: InvoiceRequestFormState): InvoiceRequestFormValues {
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

/** The form opened on a request already filed. */
export function fromRequest(row: InvoiceRequestDto): InvoiceRequestFormState {
  return {
    patientPaymentId: row.patientPaymentId,
    isCompany: row.isCompany,
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

const isBlank = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const DRAFT_FIELDS = ["fullName", "birthYear", "phone", "nationalId", "personalAddress", "email"] as const;
type DraftField = (typeof DRAFT_FIELDS)[number];

/**
 * What the system knows of the customer, filled in once a receipt is picked — only into
 * the blanks: a line the user typed before picking the receipt stays as typed.
 */
export function fromDraft(
  draft: InvoiceRequestDraftDto,
  current: Partial<InvoiceRequestFormState>,
): Partial<InvoiceRequestFormState> {
  const known: Pick<InvoiceRequestFormState, DraftField> = {
    fullName: draft.fullName,
    birthYear: draft.birthYear,
    phone: draft.phone ?? undefined,
    nationalId: draft.nationalId ?? undefined,
    personalAddress: draft.personalAddress ?? undefined,
    email: draft.email ?? undefined,
  };
  const filled: Partial<InvoiceRequestFormState> = {};
  const fill = <K extends DraftField>(key: K) => {
    if (!isBlank(known[key]) && isBlank(current[key])) filled[key] = known[key];
  };
  DRAFT_FIELDS.forEach(fill);
  return filled;
}
