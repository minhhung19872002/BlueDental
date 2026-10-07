import { Input } from "antd";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import type { RedInvoiceErrors } from "./redInvoiceRules";

interface InvoiceCustomerInfoProps {
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  nationalId: string;
  onNationalIdChange: (value: string) => void;
  companyName: string;
  onCompanyNameChange: (value: string) => void;
  address: string;
  onAddressChange: (value: string) => void;
  taxCode: string;
  onTaxCodeChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  /** "Xuất hóa đơn đỏ" ticked: Tên khách hàng, Mã số thuế, Email and Số ĐT carry the asterisk. */
  redInvoice: boolean;
  errors: RedInvoiceErrors;
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  wide?: boolean;
}

/** A plain text box of the dialog, with its error under it the way a form field shows one. */
function TextField({ label, value, onChange, required, error, wide }: TextFieldProps) {
  return (
    <div className={["inv-field", wide && "inv-field--wide"].filter(Boolean).join(" ")}>
      <FloatingLabel label={label} required={required} floated={value !== ""}>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          status={error ? "error" : undefined}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
        />
      </FloatingLabel>
      {error && <span className="inv-field-error" role="alert">{error}</span>}
    </div>
  );
}

export function InvoiceCustomerInfo({
  customerName,
  onCustomerNameChange,
  nationalId,
  onNationalIdChange,
  companyName,
  onCompanyNameChange,
  address,
  onAddressChange,
  taxCode,
  onTaxCodeChange,
  email,
  onEmailChange,
  phone,
  onPhoneChange,
  redInvoice,
  errors,
}: InvoiceCustomerInfoProps) {
  return (
    <div>
      <h4 className="inv-section-title">{t("Treatment:Invoice:CustomerInfo")}</h4>
      <div className="inv-fields inv-fields--left">
        <TextField
          label={t("Treatment:Invoice:CustomerName")}
          value={customerName}
          onChange={onCustomerNameChange}
          required={redInvoice}
          error={errors.customerName}
          wide
        />
        <FloatingLabel label={t("Treatment:Invoice:NationalId")} floated={nationalId !== ""} className="inv-field">
          <Input
            value={nationalId}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 12);
              onNationalIdChange(v);
            }}
            maxLength={12}
            status={nationalId && nationalId.length !== 12 ? "error" : undefined}
          />
        </FloatingLabel>
        <TextField label={t("Treatment:Invoice:CompanyName")} value={companyName} onChange={onCompanyNameChange} />
        <TextField
          label={t("Treatment:Invoice:TaxCode")}
          value={taxCode}
          onChange={onTaxCodeChange}
          required={redInvoice}
          error={errors.taxCode}
        />
        <TextField label={t("Treatment:Common:Address")} value={address} onChange={onAddressChange} />
        <TextField
          label={t("Email")}
          value={email}
          onChange={onEmailChange}
          required={redInvoice}
          error={errors.email}
        />
        <TextField
          label={t("Treatment:Common:Phone")}
          value={phone}
          onChange={onPhoneChange}
          required={redInvoice}
          error={errors.phone}
        />
      </div>
    </div>
  );
}
