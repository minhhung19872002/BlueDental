import { useState } from "react";
import { Button, Checkbox } from "antd";
import { FileText } from "lucide-react";
import { Emphasised } from "@/components/Emphasised";
import { ReceiptPaper, type ReceiptClinic, type ReceiptPaperData } from "@/components/ReceiptPaper";
import { t } from "@/lib/i18n";

interface Props {
  receipt: ReceiptPaperData;
  clinic: ReceiptClinic;
  /** A request for this receipt is already with the accountant. */
  invoiceRequested: boolean;
  confirming: boolean;
  onRequestInvoice: () => void;
  onConfirm: () => void;
}

/**
 * Bước 1–2: the customer reads the PHIẾU THU, may ask for an e-invoice, and
 * ticks both statements. "Xác nhận thông tin" waits for both ticks.
 */
export function ReviewScreen({ receipt, clinic, invoiceRequested, confirming, onRequestInvoice, onConfirm }: Props) {
  const [correct, setCorrect] = useState(false);
  const [consent, setConsent] = useState(false);

  return (
    <div className="sst-review">
      <div className="sst-review-paper">
        <ReceiptPaper receipt={receipt} clinic={clinic} />
      </div>
      <aside className="sst-review-side">
        <section className="sst-card">
          <h2 className="sst-card-title">
            <FileText size={18} aria-hidden="true" />
            {t("SigningStation:Invoice:CardTitle")}
          </h2>
          <p className="sst-card-text">{t("SigningStation:Invoice:CardText")}</p>
          {invoiceRequested ? (
            <p className="sst-card-done">{t("SigningStation:Invoice:Requested")}</p>
          ) : (
            <Button block size="large" onClick={onRequestInvoice}>
              {t("SigningStation:Invoice:Request")}
            </Button>
          )}
        </section>
        <section className="sst-card">
          <h2 className="sst-card-title">{t("SigningStation:Check:Title")}</h2>
          <Checkbox className="sst-check" checked={correct} onChange={(event) => setCorrect(event.target.checked)}>
            <Emphasised text={t("SigningStation:Check:Correct")} />
          </Checkbox>
          <Checkbox className="sst-check" checked={consent} onChange={(event) => setConsent(event.target.checked)}>
            <Emphasised text={t("SigningStation:Check:Consent")} />
          </Checkbox>
        </section>
        <Button
          type="primary"
          size="large"
          block
          disabled={!correct || !consent || confirming}
          loading={confirming}
          onClick={onConfirm}
        >
          {t("SigningStation:Check:Confirm")}
        </Button>
      </aside>
    </div>
  );
}
