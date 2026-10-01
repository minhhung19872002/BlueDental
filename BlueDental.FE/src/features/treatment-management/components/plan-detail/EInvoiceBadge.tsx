import { Download, Loader2, RefreshCw } from "lucide-react";
import { ActionTooltip } from "@/components/ActionTooltip";
import { t } from "@/lib/i18n";
import { EINVOICE_STATUS, type EInvoiceStatus, type ElectronicInvoiceDto } from "../../api/eInvoiceApi";

const STATUS_PILL: Record<EInvoiceStatus, { className: string; labelKey: string }> = {
  [EINVOICE_STATUS.Draft]: { className: "tp-pill tp-pill--progress", labelKey: "Treatment:EInvoice:Status:Draft" },
  [EINVOICE_STATUS.Published]: { className: "tp-pill tp-pill--done", labelKey: "Treatment:EInvoice:Status:Published" },
  [EINVOICE_STATUS.Cancelled]: { className: "tp-pill tp-pill--cancelled", labelKey: "Treatment:EInvoice:Status:Cancelled" },
  [EINVOICE_STATUS.Replaced]: { className: "tp-pill tp-pill--cancelled", labelKey: "Treatment:EInvoice:Status:Replaced" },
  [EINVOICE_STATUS.Adjusted]: { className: "tp-pill tp-pill--done", labelKey: "Treatment:EInvoice:Status:Adjusted" },
};

interface Props {
  invoice: ElectronicInvoiceDto;
  syncing: boolean;
  onSync: (invoice: ElectronicInvoiceDto) => void;
  onDownload: (invoice: ElectronicInvoiceDto) => void;
}

/** A receipt's e-invoice: its state, number, and the two lookups (refresh, PDF). */
export function EInvoiceBadge({ invoice, syncing, onSync, onDownload }: Props) {
  const pill = STATUS_PILL[invoice.status];
  const reference = invoice.no ?? invoice.lookupCode;
  return (
    <span className="pdt-einvoice">
      <span className={pill.className}>{t(pill.labelKey)}</span>
      {reference && <span className="pdt-einvoice-no">{reference}</span>}
      <ActionTooltip title={t("Treatment:EInvoice:Sync")}>
        <button
          type="button"
          className="pdt-row-action"
          aria-label={t("Treatment:EInvoice:Sync")}
          disabled={syncing}
          onClick={() => onSync(invoice)}
        >
          {syncing ? <Loader2 size={14} className="pdt-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
        </button>
      </ActionTooltip>
      <ActionTooltip title={t("Treatment:EInvoice:Download")}>
        <button
          type="button"
          className="pdt-row-action"
          aria-label={t("Treatment:EInvoice:Download")}
          onClick={() => onDownload(invoice)}
        >
          <Download size={14} aria-hidden="true" />
        </button>
      </ActionTooltip>
    </span>
  );
}
