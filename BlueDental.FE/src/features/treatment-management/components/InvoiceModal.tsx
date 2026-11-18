import { Button, Checkbox, Modal } from "antd";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";
import { useEInvoiceDraft } from "../api/eInvoiceApi";
import type { InvoiceModalProps } from "./invoiceTypes";
import { useInvoiceForm } from "./useInvoiceForm";
import { InvoiceCustomerInfo } from "./InvoiceCustomerInfo";
import { InvoiceFormInfo } from "./InvoiceFormInfo";
import { InvoiceServiceTable } from "./InvoiceServiceTable";
import { useInvoiceIssue } from "./useInvoiceIssue";
import { buyerErrors } from "./redInvoiceRules";
import "./invoice-modal.css";

/**
 * "Hóa đơn" (BA 2026-11-18): Lưu Nháp keeps the form in BlueDental only. Lưu
 * opens the PHIẾU THU in a new tab and, with "Xuất hóa đơn đỏ" ticked, also
 * sends the e-invoice to EasyInvoice unsigned (Chờ kiểm tra); the accountant
 * signs it on the portal and the sync brings it back as Đã xuất hóa đơn.
 * A missing account, a signed invoice or an amount over the cap come back
 * from the server as the usual error toast.
 */
export function InvoiceModal({ open, source, onClose }: InvoiceModalProps) {
  const draft = useEInvoiceDraft(source, open).data;
  const form = useInvoiceForm(draft);
  const flow = useInvoiceIssue({
    source,
    buildBuyer: form.buildBuyer,
    buildLines: form.buildLines,
    redInvoiceComplete: form.redInvoiceMissing.length === 0,
    buyerFormatValid: form.buyerFormatValid,
    onClose,
  });

  const busy = !draft || flow.pending;
  const errors = buyerErrors({
    values: form.buyerValues,
    showRequired: flow.showRequiredErrors,
    showFormat: flow.showFormatErrors,
    server: flow.serverError,
  });

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
          <Checkbox
            className="inv-footer-option"
            checked={flow.redInvoice}
            onChange={(e) => flow.onRedInvoiceChange(e.target.checked)}
            disabled={busy}
          >
            {t("Treatment:Invoice:RedInvoice")}
          </Checkbox>
          <Button onClick={flow.saveDraft} disabled={busy} loading={flow.savingDraft}>
            {t("Treatment:Invoice:SaveDraft")}
          </Button>
          <Button
            type="primary"
            onClick={flow.onIssueClick}
            disabled={busy}
            loading={flow.publishing && !flow.confirmingPublish}
          >
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
          redInvoice={flow.redInvoice}
          errors={errors}
        />
        <InvoiceFormInfo
          numberings={draft?.numberings ?? []}
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
          <span className="inv-summary-total">{formatVND(form.totalBeforeTax)} {t("Treatment:Pricing:CurrencyUnit")}</span>
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

      <ConfirmDialog
        open={flow.confirmingPublish}
        title={t("Treatment:EInvoice:SendTitle")}
        message={t("Treatment:EInvoice:SendBody", `${formatVND(form.grandTotal)} ${t("Treatment:Pricing:CurrencyUnit")}`)}
        confirmLabel={t("Treatment:Invoice:Issue")}
        pending={flow.publishing}
        onConfirm={flow.confirmPublish}
        onClose={flow.cancelPublish}
      />
    </Modal>
  );
}
