import { Button, Radio, type RadioChangeEvent } from "antd";
import { CircleAlert, FileCheck2, Usb } from "lucide-react";
import { t } from "@/lib/i18n";
import { RECEIPT_SIGN_MODE, type ReceiptSignMode } from "../../api/paymentReceiptApi";
import type { AccountantSignatureState } from "../../hooks/useAccountantSignature";
import { AccountantSignatureField } from "./AccountantSignatureField";

interface PanelProps {
  signMode: ReceiptSignMode;
  onSignModeChange: (mode: ReceiptSignMode) => void;
  exporting: boolean;
  signature: AccountantSignatureState;
}

interface ButtonProps {
  signMode: ReceiptSignMode;
  ready: boolean;
  onExport: () => void;
  exporting: boolean;
}

/** The three ways, in the mock's order. */
const MODES: { value: ReceiptSignMode; label: string }[] = [
  { value: RECEIPT_SIGN_MODE.Electronic, label: "Receipt:Export:Electronic" },
  { value: RECEIPT_SIGN_MODE.Digital, label: "Receipt:Export:Digital" },
  { value: RECEIPT_SIGN_MODE.Unsigned, label: "Receipt:Export:Unsigned" },
];

/** The button's words follow the choice, as on the BA flow. */
const BUTTON_LABELS: Record<ReceiptSignMode, string> = {
  [RECEIPT_SIGN_MODE.Electronic]: "Receipt:Export:Button",
  [RECEIPT_SIGN_MODE.Digital]: "Receipt:Export:DigitalButton",
  [RECEIPT_SIGN_MODE.Unsigned]: "Receipt:Export:Button",
};

const isSignMode = (value: unknown): value is ReceiptSignMode => MODES.some((mode) => mode.value === value);

/**
 * Whether Xuất phiếu thu can go: Ký điện tử once a signature is saved and the
 * pad is shut; Ký tay at once; Token not until the certificate is wired in
 * (P2610 phase 7).
 */
export function isExportReady(signMode: ReceiptSignMode, signature: AccountantSignatureState): boolean {
  if (signMode === RECEIPT_SIGN_MODE.Digital) return false;
  if (signMode === RECEIPT_SIGN_MODE.Electronic) return signature.signature !== null && !signature.padOpen;
  return true;
}

function TokenCard() {
  return (
    <>
      <div className="rcpt-token">
        <Usb size={18} aria-hidden="true" />
        <span className="rcpt-token-text">{t("Receipt:Export:TokenPlug")}</span>
        <Button className="rcpt-token-connect" disabled>
          {t("Receipt:Export:TokenConnect")}
        </Button>
      </div>
      <p className="rcpt-export-hint">{t("Receipt:Export:TokenHint")}</p>
    </>
  );
}

function HandNotice() {
  return (
    <>
      <p className="rcpt-hand-notice">
        <CircleAlert size={16} aria-hidden="true" />
        <span>{t("Receipt:Export:HandNotice")}</span>
      </p>
      <p className="rcpt-export-hint">{t("Receipt:Export:HandHint")}</p>
    </>
  );
}

/**
 * Bước "Kế toán kiểm tra & xuất" (P2910_02 mock), once the customer has signed
 * on the iPad or on paper: Ký điện tử with the accountant's saved signature,
 * Token điện tử, or Ký tay trực tiếp on the printout. The button that writes
 * the PHIẾU THU sits in the column's foot.
 */
export function ReceiptExportPanel({ signMode, onSignModeChange, exporting, signature }: PanelProps) {
  const handleChange = (event: RadioChangeEvent) => {
    const value: unknown = event.target.value;
    if (isSignMode(value)) onSignModeChange(value);
  };

  return (
    <div className="rcpt-export">
      <p className="rcpt-export-title">{t("Receipt:Export:Title")}</p>
      <p>{t("Receipt:Export:Text")}</p>
      <p className="rcpt-export-label">{t("Receipt:Export:ModeLabel")}</p>
      <Radio.Group
        className="rcpt-export-modes"
        value={signMode}
        onChange={handleChange}
        disabled={exporting}
        aria-label={t("Receipt:Export:ModeLabel")}
      >
        {MODES.map((mode) => (
          <Radio key={mode.value} value={mode.value} className="rcpt-export-mode">
            {t(mode.label)}
          </Radio>
        ))}
      </Radio.Group>
      {signMode === RECEIPT_SIGN_MODE.Electronic && <AccountantSignatureField state={signature} disabled={exporting} />}
      {signMode === RECEIPT_SIGN_MODE.Digital && <TokenCard />}
      {signMode === RECEIPT_SIGN_MODE.Unsigned && <HandNotice />}
    </div>
  );
}

/** Xuất phiếu thu / Ký số và xuất phiếu thu: writes the PHIẾU THU for good. */
export function ReceiptExportButton({ signMode, ready, onExport, exporting }: ButtonProps) {
  return (
    <Button
      type="primary"
      className="rcpt-panel-primary"
      icon={<FileCheck2 size={16} aria-hidden="true" />}
      loading={exporting}
      disabled={!ready || exporting}
      onClick={onExport}
    >
      {t(BUTTON_LABELS[signMode])}
    </Button>
  );
}
