import { Button, Modal } from "antd";
import { toast } from "sonner";
import { formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";
import type { InvoiceModalProps } from "./invoiceTypes";
import { useInvoiceForm } from "./useInvoiceForm";
import { InvoiceCustomerInfo } from "./InvoiceCustomerInfo";
import { InvoiceFormInfo } from "./InvoiceFormInfo";
import { InvoiceServiceTable } from "./InvoiceServiceTable";
import "./invoice-modal.css";

export function InvoiceModal({ open, patient, plan, onClose }: InvoiceModalProps) {
  const form = useInvoiceForm(open, patient, plan);

  const handleAction = () => {
    toast.info(t("Treatment:Common:FeaturePending"));
  };

  return (
    <Modal
      open={open}
      title={t("Treatment:Invoice:Invoice")}
      width="calc(100vw - 32px)"
      className="inv-dialog"
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="inv-footer">
          <Button onClick={handleAction}>{t("Treatment:Invoice:SaveDraft")}</Button>
          <Button type="primary" onClick={handleAction}>
            {t("Treatment:Invoice:Issue")}
          </Button>
        </div>
      }
    >
      <div className="inv-grid">
        <InvoiceCustomerInfo
          customerName={form.customerName}
          onCustomerNameChange={form.onCustomerNameChange}
          nationalId={form.nationalId}
          onNationalIdChange={form.onNationalIdChange}
          companyName={form.companyName}
          onCompanyNameChange={form.onCompanyNameChange}
          address={form.address}
          onAddressChange={form.onAddressChange}
          taxCode={form.taxCode}
          onTaxCodeChange={form.onTaxCodeChange}
          email={form.email}
          onEmailChange={form.onEmailChange}
          phone={form.phone}
          onPhoneChange={form.onPhoneChange}
        />
        <InvoiceFormInfo
          templateId={form.templateId}
          onTemplateChange={form.onTemplateChange}
          templateSymbol={form.templateSymbol}
          onTemplateSymbolChange={form.onTemplateSymbolChange}
          invoiceDate={form.invoiceDate}
          onInvoiceDateChange={form.onInvoiceDateChange}
          paymentMethod={form.paymentMethod}
          onPaymentMethodChange={form.onPaymentMethodChange}
          currency={form.currency}
          onCurrencyChange={form.onCurrencyChange}
          exchangeRate={form.exchangeRate}
          onExchangeRateChange={form.onExchangeRateChange}
        />
      </div>

      <InvoiceServiceTable
        rows={form.serviceRows}
        allSelected={form.allSelected}
        onToggleAll={form.onToggleAll}
        onToggleRow={form.onToggleRow}
        onTaxTypeChange={form.onTaxTypeChange}
        onUnitPriceChange={form.onUnitPriceChange}
      />

      <div className="inv-summary">
        <div className="inv-summary-row">
          <span>{t("Treatment:Pricing:TotalAmount")}</span>
          <span className="inv-summary-total">{formatVND(form.totalAmount)} {t("Treatment:Pricing:CurrencyUnit")}</span>
        </div>
        <div className="inv-summary-row">
          <span>{t("Treatment:Invoice:TaxAmount")}</span>
          <span>{formatVND(form.totalTax)} {t("Treatment:Pricing:CurrencyUnit")}</span>
        </div>
        <div className="inv-summary-row">
          <span>{t("Treatment:Pricing:TotalAmount")}</span>
          <span className="inv-summary-total">{formatVND(form.grandTotal)} {t("Treatment:Pricing:CurrencyUnit")}</span>
        </div>
      </div>
    </Modal>
  );
}
