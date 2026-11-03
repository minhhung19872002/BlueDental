import { useRef, type ChangeEvent } from "react";
import { Button, Spin } from "antd";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { SIGNATURE_IMAGE_ACCEPT } from "@/utils/signatureImage";
import type { AccountantSignatureState } from "../../hooks/useAccountantSignature";
import { AccountantSignaturePad } from "./AccountantSignaturePad";
import { SignatureUploadPreview } from "./SignatureUploadPreview";

interface Props {
  state: AccountantSignatureState;
  disabled: boolean;
}

/**
 * Ký điện tử's signature (P2910_02): the user's saved one with Ký lại /
 * Tải ảnh lên, or the pad until there is one. A picked picture opens in
 * Xem ảnh chữ ký before it replaces the saved one.
 */
export function AccountantSignatureField({ state, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { signature } = state;

  const openPicker = () => inputRef.current?.click();

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so picking the same file again still fires a change.
    event.target.value = "";
    if (file) state.pick(file);
  };

  if (state.loading) return <Spin className="rcpt-acsign-loading" />;

  return (
    <>
      {state.padOpen || !signature ? (
        <AccountantSignaturePad
          replacing={signature !== null}
          saving={state.saving}
          disabled={disabled}
          onSave={state.saveDrawn}
          onCancel={state.cancelSignAgain}
          onUpload={openPicker}
        />
      ) : (
        <div className="rcpt-acsign-field">
          <div className="rcpt-acsign-saved">
            <img src={signature.signatureDataUrl} alt={t("Receipt:Export:SignatureAlt")} />
          </div>
          <div className="rcpt-acsign-row">
            <span className="rcpt-acsign-owner">
              {t("Receipt:Export:SavedBy", signature.userName, formatDate(signature.savedAt))}
            </span>
            <div className="rcpt-acsign-links">
              <Button type="link" size="small" onClick={state.signAgain} disabled={disabled}>
                {t("Receipt:Export:SignAgain")}
              </Button>
              <Button type="link" size="small" onClick={openPicker} disabled={disabled}>
                {t("Receipt:Export:Upload")}
              </Button>
            </div>
          </div>
          <p className="rcpt-export-hint">{t("Receipt:Export:SavedHint")}</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={SIGNATURE_IMAGE_ACCEPT}
        aria-label={t("Receipt:Export:Upload")}
        onChange={handleFile}
      />
      <SignatureUploadPreview
        upload={state.upload}
        saving={state.saving}
        onOther={openPicker}
        onCancel={state.dropUpload}
        onUse={state.applyUpload}
      />
    </>
  );
}
