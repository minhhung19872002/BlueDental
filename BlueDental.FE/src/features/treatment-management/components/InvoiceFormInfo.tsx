import { DatePicker, Input, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import type { InvoicePaymentMethod } from "./invoiceTypes";
import { INVOICE_TEMPLATES, invoicePaymentOptions } from "./invoiceConstants";

interface InvoiceFormInfoProps {
  templateId: string;
  onTemplateChange: (id: string) => void;
  templateSymbol: string;
  onTemplateSymbolChange: (value: string) => void;
  invoiceDate: Dayjs;
  onInvoiceDateChange: (date: Dayjs | null) => void;
  paymentMethod: InvoicePaymentMethod;
  onPaymentMethodChange: (method: InvoicePaymentMethod) => void;
  currency: string;
  onCurrencyChange: (value: string) => void;
  exchangeRate: string;
  onExchangeRateChange: (value: string) => void;
}

const templateOptions = () => INVOICE_TEMPLATES.map((tpl) => ({
  value: tpl.id,
  label: t(tpl.label),
}));

export function InvoiceFormInfo({
  templateId,
  onTemplateChange,
  templateSymbol,
  onTemplateSymbolChange,
  invoiceDate,
  onInvoiceDateChange,
  paymentMethod,
  onPaymentMethodChange,
  currency,
  onCurrencyChange,
  exchangeRate,
  onExchangeRateChange,
}: InvoiceFormInfoProps) {
  return (
    <div>
      <h4 className="inv-section-title">{t("Thông tin hóa đơn")}</h4>
      <div className="inv-fields">
        <div className="inv-field">
          <span className="inv-field-label">{t("Mẫu")}</span>
          <Select
            value={templateId}
            onChange={onTemplateChange}
            options={templateOptions()}
            showSearch
            optionFilterProp="label"
            suffixIcon={<SearchOutlined />}
          />
        </div>
        <div className="inv-field">
          <span className="inv-field-label">{t("Ký hiệu")}</span>
          <Input value={templateSymbol} onChange={(e) => onTemplateSymbolChange(e.target.value)} />
        </div>
        <div className="inv-field">
          <span className="inv-field-label">{t("Ngày hóa đơn")}</span>
          <DatePicker value={invoiceDate} onChange={onInvoiceDateChange} format="DD/MM/YYYY" />
        </div>
        <div className="inv-field">
          <span className="inv-field-label">{t("Hình thức thanh toán")}</span>
          <Select
            value={paymentMethod}
            onChange={onPaymentMethodChange}
            options={invoicePaymentOptions()}
          />
        </div>
        <div className="inv-field">
          <span className="inv-field-label">{t("Đơn vị tiền tệ")}</span>
          <Input value={currency} onChange={(e) => onCurrencyChange(e.target.value)} />
        </div>
        <div className="inv-field">
          <span className="inv-field-label">{t("Tỷ giá")}</span>
          <Input value={exchangeRate} onChange={(e) => onExchangeRateChange(e.target.value)} />
        </div>
      </div>
    </div>
  );
}
