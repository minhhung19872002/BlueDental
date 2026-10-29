import { Button } from "antd";
import { Loader2, Save } from "lucide-react";
import { useSignaturePad } from "@/hooks/useSignaturePad";
import { t } from "@/lib/i18n";

interface Props {
  /** A signature is saved already: Ký lại warns it will be replaced, and Hủy goes back to it. */
  replacing: boolean;
  saving: boolean;
  disabled: boolean;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  onUpload: () => void;
}

/**
 * Ký điện tử's pad (P2910_02 mock): the accountant signs with the mouse, a
 * stylus or a signing tablet; Lưu chữ ký keeps it for this and later exports.
 */
export function AccountantSignaturePad({ replacing, saving, disabled, onSave, onCancel, onUpload }: Props) {
  const pad = useSignaturePad();

  const handleSave = () => {
    const dataUrl = pad.toDataUrl();
    if (dataUrl) onSave(dataUrl);
  };

  return (
    <div className="rcpt-acsign-field">
      {replacing && <p className="rcpt-acsign-warning">{t("Receipt:Export:ReplaceWarning")}</p>}
      <div className="rcpt-acsign-pad">
        <canvas
          ref={pad.canvasRef}
          className="rcpt-acsign-canvas"
          aria-label={t("Receipt:Export:PadLabel")}
          {...pad.handlers}
        />
        {pad.isEmpty && <span className="rcpt-acsign-placeholder">{t("Receipt:Export:PadPlaceholder")}</span>}
      </div>
      <div className="rcpt-acsign-row">
        <div className="rcpt-acsign-links">
          <Button type="link" size="small" onClick={pad.clear} disabled={pad.isEmpty || saving}>
            {t("Receipt:Export:PadClear")}
          </Button>
          <Button type="link" size="small" onClick={onUpload} disabled={disabled || saving}>
            {t("Receipt:Export:Upload")}
          </Button>
        </div>
        <div className="rcpt-acsign-buttons">
          {replacing && (
            <Button onClick={onCancel} disabled={saving}>
              {t("Receipt:Export:PadCancel")}
            </Button>
          )}
          <Button
            type="primary"
            icon={saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
            disabled={pad.isEmpty || saving || disabled}
            onClick={handleSave}
          >
            {t("Receipt:Export:PadSave")}
          </Button>
        </div>
      </div>
      <p className="rcpt-export-hint">{t("Receipt:Export:PadHint")}</p>
    </div>
  );
}
