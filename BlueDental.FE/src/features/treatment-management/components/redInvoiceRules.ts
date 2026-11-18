import { t } from "@/lib/i18n";

/**
 * The buyer fields "Xuất hóa đơn đỏ" makes mandatory (BA); the server refuses with
 * EInvoicing:0017. Địa chỉ because EasyInvoice wants it whenever there is a Mã số thuế.
 */
export type RedInvoiceField = "customerName" | "taxCode" | "address" | "phone" | "email";

/** Every buyer box an error can sit under: the mandatory five plus Tên đơn vị. */
export type BuyerField = RedInvoiceField | "companyName";

export type BuyerErrors = Partial<Record<BuyerField, string>>;

/** A refusal the server tied to one box, and what that box held when it was sent. */
export interface BuyerServerError {
  field: BuyerField;
  message: string;
  sentValue: string;
}

export const RED_INVOICE_ERROR_KEYS: Record<RedInvoiceField, string> = {
  customerName: "Treatment:Invoice:CustomerNameRequired",
  taxCode: "Treatment:Invoice:TaxCodeRequired",
  address: "Treatment:Invoice:AddressRequired",
  phone: "Treatment:Invoice:PhoneRequired",
  email: "Treatment:Invoice:EmailRequired",
};

const FIELDS: readonly RedInvoiceField[] = ["customerName", "taxCode", "address", "email", "phone"];

/**
 * What EasyInvoice takes: 10 digits (company), the company's 10 + "-" + 3
 * (branch — without the dash it refuses the 13 digits), or 12 (căn cước công
 * dân). Mirrors BuyerTaxCode on the server.
 */
const TAX_CODE_PATTERN = /^(\d{10}(-\d{3})?|\d{12})$/;

/** The tax office's weights for the first nine digits; the tenth checks them. */
const CHECK_WEIGHTS = [31, 29, 23, 19, 17, 13, 7, 5, 3] as const;

function hasValidCheckDigit(digits: string): boolean {
  const sum = CHECK_WEIGHTS.reduce((total, weight, i) => total + weight * Number(digits[i]), 0);
  return 10 - (sum % 11) === Number(digits[9]);
}

/**
 * Blank passes: whether it is required is the red-invoice rule's call. A
 * company or branch code must also carry a right check digit, as every code
 * the tax office issues does; a CCCD has none.
 */
export function isValidTaxCode(taxCode: string): boolean {
  const value = taxCode.trim();
  if (value === "") return true;
  if (!TAX_CODE_PATTERN.test(value)) return false;
  return value.length === 12 || hasValidCheckDigit(value);
}

/** The server's field names (IssueElectronicInvoiceDto) → the dialog's boxes. */
const FIELD_BY_SERVER_NAME: Readonly<Record<string, BuyerField>> = {
  buyername: "customerName",
  companyname: "companyName",
  address: "address",
  taxcode: "taxCode",
  phone: "phone",
  email: "email",
};

export function buyerFieldOf(serverField: string | undefined): BuyerField | undefined {
  return serverField === undefined ? undefined : FIELD_BY_SERVER_NAME[serverField.toLowerCase()];
}

/** One message per blank field, for the inline error under it. */
export function redInvoiceErrors(missing: readonly RedInvoiceField[]): BuyerErrors {
  const errors: BuyerErrors = {};
  for (const field of missing) errors[field] = t(RED_INVOICE_ERROR_KEYS[field]);
  return errors;
}

/** The mandatory fields still blank, in form order. */
export function missingRedInvoiceFields(values: Record<RedInvoiceField, string>): RedInvoiceField[] {
  return FIELDS.filter((field) => values[field].trim() === "");
}

interface BuyerErrorInput {
  values: Record<BuyerField, string>;
  /** Phát Hành pressed with "Xuất hóa đơn đỏ" ticked. */
  showRequired: boolean;
  /** Lưu Nháp or a ticked Phát Hành pressed: the format checks now speak. */
  showFormat: boolean;
  server: BuyerServerError | null;
}

/**
 * What shows under each buyer box. A blank mandatory box says so; a typed
 * Mã số thuế of the wrong length says that; a server refusal stays under its
 * box until the box is changed.
 */
export function buyerErrors({ values, showRequired, showFormat, server }: BuyerErrorInput): BuyerErrors {
  const errors: BuyerErrors = showRequired ? redInvoiceErrors(missingRedInvoiceFields(values)) : {};
  if (showFormat && !isValidTaxCode(values.taxCode)) errors.taxCode = t("Treatment:Invoice:TaxCodeInvalid");
  if (server && values[server.field].trim() === server.sentValue && !errors[server.field]) {
    errors[server.field] = server.message;
  }
  return errors;
}
