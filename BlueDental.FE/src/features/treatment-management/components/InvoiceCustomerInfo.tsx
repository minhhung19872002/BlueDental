import { Input } from "antd";
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
        <div className="inv-field inv-field--wide">
          <span className="inv-field-label">{t("Tên khách hàng")}</span>
          <Input value={customerName} onChange={(e) => onCustomerNameChange(e.target.value)} />
        </div>
        <div className="inv-field">
          <span className="inv-field-label">{t("CMND/CCCD")}</span>
          <Input
            value={nationalId}
            placeholder={t("CMND/CCCD")}
            onChange={(e) => onNationalIdChange(e.target.value)}
          />
        </div>
        <div className="inv-field">
          <span className="inv-field-label">{t("Tên đơn vị")}</span>
          <Input
            value={companyName}
            placeholder={t("Tên đơn vị")}
            onChange={(e) => onCompanyNameChange(e.target.value)}
          />
        </div>
        <div className="inv-field">
          <span className="inv-field-label">{t("Mã số thuế")}</span>
          <Input
            value={taxCode}
            placeholder={t("Mã số thuế")}
            onChange={(e) => onTaxCodeChange(e.target.value)}
          />
        </div>
        <div className="inv-field">
          <span className="inv-field-label">{t("Địa chỉ")}</span>
          <Input value={address} onChange={(e) => onAddressChange(e.target.value)} />
        </div>
        <div className="inv-field">
          <span className="inv-field-label">{t("Email")}</span>
          <Input value={email} onChange={(e) => onEmailChange(e.target.value)} />
        </div>
        <div className="inv-field">
          <span className="inv-field-label">{t("Số điện thoại")}</span>
          <Input value={phone} onChange={(e) => onPhoneChange(e.target.value)} />
        </div>
      </div>
    </div>
  );
}
