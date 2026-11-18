import { Tooltip } from "antd";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { ActionTooltip } from "@/components/ActionTooltip";
import { t } from "@/lib/i18n";
import {
  EINVOICE_STATUS,
  type EInvoiceStatus,
  type ElectronicInvoiceAttemptDto,
  type ElectronicInvoiceDto,
} from "../../api/eInvoiceApi";

const STATUS_PILL: Record<EInvoiceStatus, { className: string; labelKey: string }> = {
  [EINVOICE_STATUS.NotSent]: { className: "tp-pill tp-pill--pending", labelKey: "Treatment:EInvoice:Status:NotSent" },
  [EINVOICE_STATUS.Draft]: { className: "tp-pill tp-pill--progress", labelKey: "Treatment:EInvoice:Status:Draft" },
  [EINVOICE_STATUS.Published]: { className: "tp-pill tp-pill--done", labelKey: "Treatment:EInvoice:Status:Published" },
  [EINVOICE_STATUS.Cancelled]: { className: "tp-pill tp-pill--cancelled", labelKey: "Treatment:EInvoice:Status:Cancelled" },
  [EINVOICE_STATUS.Replaced]: { className: "tp-pill tp-pill--cancelled", labelKey: "Treatment:EInvoice:Status:Replaced" },
  [EINVOICE_STATUS.Adjusted]: { className: "tp-pill tp-pill--done", labelKey: "Treatment:EInvoice:Status:Adjusted" },
};

interface Props {
  invoice: ElectronicInvoiceDto;
  syncing: boolean;
  downloading: boolean;
  onSync: (invoice: ElectronicInvoiceDto) => void;
  onDownload: (invoice: ElectronicInvoiceDto) => void;
}

function attemptLine(attempt: ElectronicInvoiceAttemptDto): string {
  const status = t(STATUS_PILL[attempt.status].labelKey);
  const label = attempt.no ? `${status} · ${t("Treatment:EInvoice:AttemptNo", attempt.no)}` : status;
  return t("Treatment:EInvoice:Attempt", String(attempt.round), label);
}

/** A re-issue after a cancel stays on the same invoice; the earlier rounds show on hover. */
function AttemptHistory({ attempts }: { attempts: readonly ElectronicInvoiceAttemptDto[] }) {
  return (
    <span className="pdt-einvoice-attempts">
      <strong>{t("Treatment:EInvoice:Attempts")}</strong>
      {attempts.map((attempt) => (
        <span key={attempt.round}>{attemptLine(attempt)}</span>
      ))}
    </span>
  );
}

/**
 * A receipt's e-invoice: its state, number, and the two lookups (refresh, PDF).
 * A Nháp never left BlueDental, so there is nothing to refresh or download.
 */
export function EInvoiceBadge({ invoice, syncing, downloading, onSync, onDownload }: Props) {
  const pill = STATUS_PILL[invoice.status];
  const reference = invoice.no ?? invoice.lookupCode;
  const sent = invoice.status !== EINVOICE_STATUS.NotSent;
  const pillNode = <span className={pill.className}>{t(pill.labelKey)}</span>;
  return (
    <span className="pdt-einvoice">
      {invoice.attempts.length > 1
        ? <Tooltip title={<AttemptHistory attempts={invoice.attempts} />}>{pillNode}</Tooltip>
        : pillNode}
      {reference && <span className="pdt-einvoice-no">{reference}</span>}
      {sent && (
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
      )}
      {sent && (
        <ActionTooltip title={t("Treatment:EInvoice:Download")}>
          <button
            type="button"
            className="pdt-row-action"
            aria-label={t("Treatment:EInvoice:Download")}
            aria-busy={downloading}
            disabled={downloading}
            onClick={() => onDownload(invoice)}
          >
            {downloading ? <Loader2 size={14} className="pdt-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
          </button>
        </ActionTooltip>
      )}
    </span>
  );
}
