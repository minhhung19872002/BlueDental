import { Button } from "antd";
import { Eraser, PenLine } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { useSignaturePad } from "../hooks/useSignaturePad";

interface Props {
  payerName: string;
  paymentCode: string;
  amount: number;
  signing: boolean;
  /** The server's refusal (an unreadable drawing), shown under the pad. */
  error: string | null;
  onBack: () => void;
  onSign: (signatureDataUrl: string) => void;
}

/** Bước 3 "Ký tên xác nhận": the moment is stamped when "Hoàn tất ký" is pressed. */
export function SignScreen({ payerName, paymentCode, amount, signing, error, onBack, onSign }: Props) {
  const pad = useSignaturePad();

  const handleFinish = () => {
    const dataUrl = pad.toDataUrl();
    if (dataUrl) onSign(dataUrl);
  };

  return (
    <section className="sst-sign" aria-labelledby="sst-sign-title">
      <header className="sst-sign-head">
        <div>
          <h2 id="sst-sign-title" className="sst-sign-title">
            {t("SigningStation:Sign:Title")}
          </h2>
          <p className="sst-sign-sub">{t("SigningStation:Sign:Sub", payerName, paymentCode)}</p>
        </div>
        <strong className="sst-sign-amount">{formatMoneyUnit(amount)}</strong>
      </header>

      <div className="sst-pad">
        <canvas
          ref={pad.canvasRef}
          className="sst-pad-canvas"
          aria-label={t("SigningStation:Sign:Placeholder")}
          {...pad.handlers}
        />
        {pad.isEmpty && (
          <span className="sst-pad-placeholder">
            <PenLine size={20} aria-hidden="true" />
            {t("SigningStation:Sign:Placeholder")}
          </span>
        )}
        <span className="sst-pad-line" aria-hidden="true" />
        <span className="sst-pad-caption">{t("SigningStation:Sign:Baseline")}</span>
      </div>
      {error && (
        <p className="sst-form-error" role="alert">
          {error}
        </p>
      )}

      <footer className="sst-sign-foot">
        <p className="sst-sign-note">{t("SigningStation:Sign:Note")}</p>
        <div className="sst-sign-actions">
          <Button size="large" onClick={onBack} disabled={signing}>
            {t("SigningStation:Sign:Back")}
          </Button>
          <Button size="large" icon={<Eraser size={16} aria-hidden="true" />} onClick={pad.clear} disabled={signing || pad.isEmpty}>
            {t("SigningStation:Sign:Clear")}
          </Button>
          <Button size="large" type="primary" onClick={handleFinish} loading={signing} disabled={signing || pad.isEmpty}>
            {t("SigningStation:Sign:Finish")}
          </Button>
        </div>
      </footer>
    </section>
  );
}
