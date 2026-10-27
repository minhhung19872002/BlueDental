import { Button } from "antd";
import { Check, Download, FilePlus2, Printer } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatClockSeconds, formatDate } from "@/utils/format";
import {
  RECEIPT_SIGN_MODE,
  RECEIPT_STATUS,
  type PaymentReceiptDto,
  type ReceiptSignMode,
} from "../../api/paymentReceiptApi";

interface Props {
  receipt: PaymentReceiptDto;
  print: { run: () => void; pending: boolean };
  /** Left out for a receipt exported before the file was kept (pre phase 5). */
  download?: { run: () => void; pending: boolean };
  /** Left out without payment.create or a slip to write it on. */
  onCreateNew?: () => void;
}

const SIGN_MODE_KEYS: Record<ReceiptSignMode, string> = {
  [RECEIPT_SIGN_MODE.Digital]: "Receipt:Export:Digital",
  [RECEIPT_SIGN_MODE.Unsigned]: "Receipt:Export:Unsigned",
};

/**
 * The column once the accountant has exported the receipt (P2610 mock, step
 * "Xuất phiếu thu"): ✓ Đã xuất phiếu thu with when it was recorded, how it was
 * signed and kept, then In phiếu · Tải PDF · Tạo phiếu mới. Paid (✓ on the
 * slip) it reads the same under "Đã thanh toán", plus who confirmed. Nothing
 * on the receipt changes from here; only Hủy phiếu thu in the head is left.
 */
export function ReceiptExportedPanel({ receipt, print, download, onCreateNew }: Props) {
  const exportedAt = receipt.issuedAt;
  const paid = receipt.status === RECEIPT_STATUS.Completed;
  const facts: [string, string][] = exportedAt ? signFacts(receipt) : [];
  if (receipt.hasFile) facts.push([t("Receipt:Done:Storage"), t("Receipt:Done:StorageValue")]);
  if (paid) facts.push([t("Receipt:Done:ConfirmedBy"), receipt.confirmedByName || "—"]);

  return (
    <aside className="rcpt-panel rcpt-done" aria-label={t("Common:Status")}>
      <div className="rcpt-done-head">
        <span className="rcpt-done-icon" aria-hidden="true">
          <Check size={18} strokeWidth={3} />
        </span>
        <div>
          <h3 className="rcpt-panel-title">
            {t(paid ? "Treatment:Payment:Completed" : "Treatment:Payment:Issued")}
          </h3>
          {exportedAt && (
            <p className="rcpt-done-sub">
              {t("Receipt:Done:RecordedAt", formatClockSeconds(exportedAt), formatDate(exportedAt))}
            </p>
          )}
        </div>
      </div>
      {facts.length > 0 && (
        <dl className="rcpt-done-facts">
          {facts.map(([label, value]) => (
            <div key={label} className="rcpt-done-fact">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <ReceiptDoneActions print={print} download={download} onCreateNew={onCreateNew} />
    </aside>
  );
}

/** How an exported receipt was signed, by the accountant and by the clinic. */
function signFacts(receipt: PaymentReceiptDto): [string, string][] {
  return [
    [
      t("Receipt:Export:ModeLabel"),
      t(
        "Receipt:Done:SignedBy",
        receipt.signMode ? t(SIGN_MODE_KEYS[receipt.signMode]) : "—",
        receipt.issuedByName || "—",
      ),
    ],
    [
      t("Receipt:Done:UnitSign"),
      t(
        receipt.signMode === RECEIPT_SIGN_MODE.Digital
          ? "Receipt:Done:UnitSigned"
          : "Receipt:Done:UnitUnsigned",
      ),
    ],
  ];
}

/** In phiếu · Tải PDF · Tạo phiếu mới, as the mock lines them up. */
function ReceiptDoneActions({ print, download, onCreateNew }: Omit<Props, "receipt">) {
  return (
    <div className="rcpt-panel-actions rcpt-done-actions">
      <Button
        onClick={print.run}
        loading={print.pending}
        icon={<Printer size={16} aria-hidden="true" />}
      >
        {t("Receipt:Done:Print")}
      </Button>
      {download && (
        <Button
          onClick={download.run}
          loading={download.pending}
          icon={<Download size={16} aria-hidden="true" />}
        >
          {t("Receipt:Done:Download")}
        </Button>
      )}
      {onCreateNew && (
        <Button
          type="primary"
          className="rcpt-panel-primary"
          onClick={onCreateNew}
          icon={<FilePlus2 size={16} aria-hidden="true" />}
        >
          {t("Receipt:Done:CreateNew")}
        </Button>
      )}
    </div>
  );
}
