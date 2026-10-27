import { useEffect } from "react";
import { CheckCircle2, Clock, Hand, Unplug } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatDateTime, formatMoneyUnit } from "@/utils/format";
import { StationMessage } from "./StationShell";

/** How long "Phiếu thu đã được xuất" stays before the welcome screen (BA ~15s). */
export const ISSUED_IDLE_AFTER_MS = 15_000;

/** No receipt on the iPad: the welcome screen. */
export function IdleScreen() {
  return (
    <StationMessage
      icon={<Hand size={40} aria-hidden="true" />}
      title={t("SigningStation:Idle:Title")}
      text={t("SigningStation:Idle:Text")}
    />
  );
}

/** The token is missing or revoked; pairing is redone from Cài đặt → Kết nối iPad. */
export function NotPairedScreen() {
  return (
    <StationMessage
      icon={<Unplug size={40} aria-hidden="true" />}
      title={t("SigningStation:NotPaired:Title")}
      text={t("BlueDental:Billing:0111")}
    />
  );
}

/** Signed; the accountant still has to confirm the export. */
export function ThanksScreen({ signatureDataUrl }: { signatureDataUrl: string | null }) {
  return (
    <StationMessage icon={<CheckCircle2 size={40} aria-hidden="true" />} title={t("SigningStation:Thanks:Title")}>
      {signatureDataUrl && (
        <figure className="sst-signed-card">
          <img src={signatureDataUrl} alt={t("Receipt:Sheet:SignatureAlt")} />
        </figure>
      )}
      <p className="sst-message-text">{t("SigningStation:Thanks:Text")}</p>
      <span className="sst-pill">
        <Clock size={16} aria-hidden="true" />
        {t("SigningStation:Thanks:Pill")}
      </span>
    </StationMessage>
  );
}

interface IssuedProps {
  amount: number;
  issuedAt: string | null;
  /** Back to the welcome screen once the moment has been shown. */
  onDone: () => void;
}

/** "Phiếu thu đã được xuất" — no Zalo / SMS line (BA). */
export function IssuedScreen({ amount, issuedAt, onDone }: IssuedProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, ISSUED_IDLE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <StationMessage icon={<CheckCircle2 size={48} aria-hidden="true" />} title={t("SigningStation:Issued:Title")}>
      <dl className="sst-issued-box">
        <dt>{t("SigningStation:Issued:Amount")}</dt>
        <dd className="sst-issued-amount">{formatMoneyUnit(amount)}</dd>
        <dt>{t("SigningStation:Issued:At")}</dt>
        <dd>{issuedAt ? formatDateTime(issuedAt) : "—"}</dd>
        <dt>{t("SigningStation:Issued:Proof")}</dt>
        <dd>{t("SigningStation:Issued:ProofText")}</dd>
      </dl>
    </StationMessage>
  );
}
