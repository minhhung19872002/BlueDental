import { useEffect } from "react";
import { Button } from "antd";
import { Printer } from "lucide-react";
import { Emphasised } from "@/components/Emphasised";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { StationMessage } from "./StationShell";

/** How long "Cảm ơn quý khách" stays before the welcome screen (BA ~30s, as the server keeps it). */
export const PRINTED_IDLE_AFTER_MS = 30_000;

interface Props {
  paymentCode: string;
  payerName: string;
  amount: number;
  /** Back to the welcome screen: the button, or the timeout. */
  onDone: () => void;
}

/**
 * The cashier printed the receipt for a hand signature (P2910_02 mock): the
 * iPad session is over, so the customer is thanked and sent to the counter
 * with the printout, then the welcome screen comes back on its own.
 */
export function PrintedScreen({ paymentCode, payerName, amount, onDone }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, PRINTED_IDLE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <StationMessage icon={<Printer size={40} aria-hidden="true" />} title={t("SigningStation:Printed:Title")}>
      <p className="sst-message-text">
        <Emphasised text={t("SigningStation:Printed:Text", paymentCode)} />
      </p>
      <dl className="sst-printed-box">
        <dt>{t("SigningStation:Printed:Payer")}</dt>
        <dd className="sst-printed-payer">{payerName}</dd>
        <dt>{t("SigningStation:Printed:Amount")}</dt>
        <dd className="sst-printed-amount">{formatMoneyUnit(amount)}</dd>
        <dt>{t("SigningStation:Printed:Mode")}</dt>
        <dd>{t("SigningStation:Printed:ModeValue")}</dd>
      </dl>
      <p className="sst-printed-note">{t("SigningStation:Printed:Ended")}</p>
      <Button size="large" className="sst-printed-back" onClick={onDone}>
        {t("SigningStation:Printed:Back")}
      </Button>
    </StationMessage>
  );
}
