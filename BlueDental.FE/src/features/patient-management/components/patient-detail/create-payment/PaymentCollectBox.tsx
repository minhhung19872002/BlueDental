import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import type { RoundMoney } from "./paymentRoundMoney";

/**
 * Thu đợt này, with the VAT inside it when the services carry any, and what
 * they will still owe once it is paid (P2910).
 */
export function PaymentCollectBox({ money }: { money: RoundMoney }) {
  return (
    <div className="pd-newpay-collect">
      <div>
        <span>{t("Patient:Payment:CollectNow")}</span>
        <b>{formatMoneyUnit(money.total)}</b>
        {money.roundTax > 0 ? (
          <small>{t("Patient:Payment:CollectVat", formatMoneyUnit(money.roundTax))}</small>
        ) : null}
      </div>
      <div>
        <span>{t("Patient:Payment:DebtAfter")}</span>
        <b className={money.after > 0 ? "pd-newpay-debt" : undefined}>{formatMoneyUnit(money.after)}</b>
      </div>
    </div>
  );
}
