import { useState } from "react";
import { Button, Modal } from "antd";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";
import { useEInvoiceDraft, useIssueEInvoice } from "../api/eInvoiceApi";
import type { InvoiceModalProps } from "./invoiceTypes";
import { useInvoiceForm } from "./useInvoiceForm";
import { InvoiceCustomerInfo } from "./InvoiceCustomerInfo";
import { InvoiceFormInfo } from "./InvoiceFormInfo";
import { InvoiceServiceTable } from "./InvoiceServiceTable";
import "./invoice-modal.css";

/**
 * "Hóa đơn": Lưu Nháp files a draft on EasyInvoice (the same key overwrites
 * it); Phát Hành files and signs it in one call — the provider then owns the
 * number and it can no longer change. The dialog keeps the original layout:
 * a missing account, a published invoice or an amount over the cap come back
 * from the server as the usual error toast.
 */
export function InvoiceModal({ open, source, onClose }: InvoiceModalProps) {
  const draft = useEInvoiceDraft(source, open).data;
  const form = useInvoiceForm(draft);
  const issue = useIssueEInvoice();
  const [confirmingPublish, setConfirmingPublish] = useState(false);

  const busy = !draft || issue.isPending;

  const send = (publish: boolean) => {
    issue.mutate(
      { ...source, publish, ...form.buildBuyer(), lines: form.buildLines() },
      {
        onSuccess: (invoice) => {
          setConfirmingPublish(false);
          toast.success(
            publish
              ? t("Treatment:EInvoice:Published", invoice.no ?? invoice.ikey)
              : t("Treatment:EInvoice:Issued", invoice.ikey),
          );
          onClose();
        },
      },
    );
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
          <Button onClick={() => send(false)} disabled={busy} loading={issue.isPending && !confirmingPublish}>
            {t("Treatment:Invoice:SaveDraft")}
          </Button>
          <Button type="primary" onClick={() => setConfirmingPublish(true)} disabled={busy}>
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
        open={confirmingPublish}
        title={t("Treatment:EInvoice:PublishTitle")}
        message={t("Treatment:EInvoice:PublishBody", `${formatVND(form.grandTotal)} ${t("Treatment:Pricing:CurrencyUnit")}`)}
        confirmLabel={t("Treatment:Invoice:Issue")}
        pending={issue.isPending}
        onConfirm={() => send(true)}
        onClose={() => setConfirmingPublish(false)}
      />
    </Modal>
  );
}
