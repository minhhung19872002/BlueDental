import { Button, Radio, type RadioChangeEvent } from "antd";
import { FileCheck2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { RECEIPT_SIGN_MODE, type ReceiptSignMode } from "../../api/paymentReceiptApi";

interface PanelProps {
  signMode: ReceiptSignMode | null;
  onSignModeChange: (mode: ReceiptSignMode) => void;
  exporting: boolean;
}

interface ButtonProps {
  signMode: ReceiptSignMode | null;
  onExport: () => void;
  exporting: boolean;
}

/** The button's words follow the choice, as on the BA flow. */
const BUTTON_LABELS: Record<ReceiptSignMode, string> = {
  [RECEIPT_SIGN_MODE.Digital]: "Receipt:Export:DigitalButton",
  [RECEIPT_SIGN_MODE.Unsigned]: "Receipt:Export:Button",
};

/**
 * Bước "Kế toán kiểm tra & xuất" (P2610 phase 5), once the customer has
 * signed on the iPad: Ký số or Không ký số — nothing is picked for the
 * accountant. Ký số stays off until the signing certificate is wired in
 * (phase 7). The button that writes the PHIẾU THU sits in the column's foot.
 */
export function ReceiptExportPanel({ signMode, onSignModeChange, exporting }: PanelProps) {
  const handleChange = (event: RadioChangeEvent) => {
    const value: unknown = event.target.value;
    if (value === RECEIPT_SIGN_MODE.Digital || value === RECEIPT_SIGN_MODE.Unsigned) onSignModeChange(value);
  };

  return (
    <div className="rcpt-export">
      <p className="rcpt-export-title">{t("Receipt:Export:Title")}</p>
      <p>{t("Receipt:Export:Text")}</p>
      <Radio.Group
        className="rcpt-export-modes"
        value={signMode}
        onChange={handleChange}
        disabled={exporting}
        aria-label={t("Receipt:Export:ModeLabel")}
      >
        <Radio value={RECEIPT_SIGN_MODE.Digital} disabled>
          {t("Receipt:Export:Digital")}
          <span className="rcpt-export-hint">{t("Receipt:Export:DigitalSoon")}</span>
        </Radio>
        <Radio value={RECEIPT_SIGN_MODE.Unsigned}>{t("Receipt:Export:Unsigned")}</Radio>
      </Radio.Group>
      {signMode === null && <p className="rcpt-export-hint">{t("Receipt:Export:PickMode")}</p>}
    </div>
  );
}

/** Xuất phiếu thu / Ký số & xuất phiếu thu: writes the PHIẾU THU for good. */
export function ReceiptExportButton({ signMode, onExport, exporting }: ButtonProps) {
  return (
    <Button
      type="primary"
      className="rcpt-panel-primary"
      icon={<FileCheck2 size={16} aria-hidden="true" />}
      loading={exporting}
      disabled={signMode === null || exporting}
      onClick={onExport}
    >
      {t(BUTTON_LABELS[signMode ?? RECEIPT_SIGN_MODE.Unsigned])}
    </Button>
  );
}
