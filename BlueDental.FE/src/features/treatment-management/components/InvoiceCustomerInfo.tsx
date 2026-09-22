import { Input } from "antd";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";

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
}: InvoiceCustomerInfoProps) {
  return (
    <div>
      <h4 className="inv-section-title">{t("Thông tin khách hàng")}</h4>
      <div className="inv-fields inv-fields--left">
        <FloatingLabel
          label={t("Tên khách hàng")}
          floated={customerName !== ""}
          className="inv-field inv-field--wide"
        >
          <Input value={customerName} onChange={(e) => onCustomerNameChange(e.target.value)} />
        </FloatingLabel>
        <FloatingLabel label={t("CMND/CCCD")} floated={nationalId !== ""} className="inv-field">
          <Input value={nationalId} onChange={(e) => onNationalIdChange(e.target.value)} />
        </FloatingLabel>
        <FloatingLabel label={t("Tên đơn vị")} floated={companyName !== ""} className="inv-field">
          <Input value={companyName} onChange={(e) => onCompanyNameChange(e.target.value)} />
        </FloatingLabel>
        <FloatingLabel label={t("Mã số thuế")} floated={taxCode !== ""} className="inv-field">
          <Input value={taxCode} onChange={(e) => onTaxCodeChange(e.target.value)} />
        </FloatingLabel>
        <FloatingLabel label={t("Địa chỉ")} floated={address !== ""} className="inv-field">
          <Input value={address} onChange={(e) => onAddressChange(e.target.value)} />
        </FloatingLabel>
        <FloatingLabel label={t("Email")} floated={email !== ""} className="inv-field">
          <Input value={email} onChange={(e) => onEmailChange(e.target.value)} />
        </FloatingLabel>
        <FloatingLabel label={t("Số điện thoại")} floated={phone !== ""} className="inv-field">
          <Input value={phone} onChange={(e) => onPhoneChange(e.target.value)} />
        </FloatingLabel>
      </div>
    </div>
  );
}
