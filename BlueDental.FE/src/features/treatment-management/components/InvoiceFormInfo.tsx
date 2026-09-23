import { DatePicker, Input, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { FloatingLabel } from "@/components/FloatingLabel";
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
      <h4 className="inv-section-title">{t("Treatment:Invoice:InvoiceInfo")}</h4>
      <div className="inv-fields">
        {/* The reference puts the magnifier inside "Mẫu" as a prefix and keeps
            the chevron on the right; the resting label clears it. */}
        <FloatingLabel label={t("Treatment:Invoice:Template")} floated={templateId !== ""} className="inv-field">
          <Select
            value={templateId || undefined}
            onChange={onTemplateChange}
            options={templateOptions()}
            showSearch
            optionFilterProp="label"
            prefix={<SearchOutlined aria-hidden="true" />}
          />
        </FloatingLabel>
        <FloatingLabel label={t("Treatment:Invoice:Symbol")} floated={templateSymbol !== ""} className="inv-field">
          <Input value={templateSymbol} onChange={(e) => onTemplateSymbolChange(e.target.value)} />
        </FloatingLabel>
        <FloatingLabel label={t("Treatment:Invoice:InvoiceDate")} floated className="inv-field">
          <DatePicker value={invoiceDate} onChange={onInvoiceDateChange} format="DD/MM/YYYY" />
        </FloatingLabel>
        <FloatingLabel label={t("Treatment:Payment:PaymentForm")} floated className="inv-field">
          <Select
            value={paymentMethod}
            onChange={onPaymentMethodChange}
            options={invoicePaymentOptions()}
          />
        </FloatingLabel>
        <FloatingLabel label={t("Treatment:Invoice:Currency")} floated={currency !== ""} className="inv-field">
          <Input value={currency} onChange={(e) => onCurrencyChange(e.target.value)} />
        </FloatingLabel>
        <FloatingLabel label={t("Treatment:Invoice:ExchangeRate")} floated={exchangeRate !== ""} className="inv-field">
          <Input value={exchangeRate} onChange={(e) => onExchangeRateChange(e.target.value)} />
        </FloatingLabel>
      </div>
    </div>
  );
}
