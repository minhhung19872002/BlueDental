import { useState } from "react";
import { DatePicker, Input, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import type { ElectronicInvoiceNumberingDto } from "../api/eInvoiceApi";
import type { InvoicePaymentMethod } from "./invoiceTypes";
import { invoicePaymentOptions } from "./invoiceConstants";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";

interface InvoiceFormInfoProps {
  /** Mẫu số the branch has used; a pattern typed into the search is offered too. */
  numberings: ElectronicInvoiceNumberingDto[];
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

function templateOptions(numberings: ElectronicInvoiceNumberingDto[], typed: string, selected: string) {
  const patterns = [...numberings.map((n) => n.pattern), selected, typed.trim()].filter((p) => p !== "");
  return [...new Set(patterns)].map((p) => ({ value: p, label: p }));
}

export function InvoiceFormInfo({
  numberings,
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
  const [search, setSearch] = useState("");

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
            options={templateOptions(numberings, search, templateId)}
            showSearch
            onSearch={setSearch}
            optionFilterProp="label"
            prefix={<SearchOutlined aria-hidden="true" />}
          />
        </FloatingLabel>
        <FloatingLabel label={t("Treatment:Invoice:Symbol")} floated={templateSymbol !== ""} className="inv-field">
          <Input value={templateSymbol} onChange={(e) => onTemplateSymbolChange(e.target.value)} />
        </FloatingLabel>
        <FloatingLabel label={t("Treatment:Invoice:InvoiceDate")} floated className="inv-field">
          <DatePicker value={invoiceDate} onChange={onInvoiceDateChange} format={DATE_INPUT_FORMAT} />
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
