import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import type { PaymentForm } from "./usePaymentForm";

/**
 * Tự động: one figure, capped at what the ticked services owe. Thủ công: a box
 * per service, its đợt and what it still owes once this đợt's relief is off.
 */
export function PaymentAmountInput({ payment }: { payment: PaymentForm }) {
  const { form, chosen, money, rounds, update } = payment;
  if (form.mode === "auto") {
    return (
      <>
        <FloatingLabel label={t("Patient:Payment:AmountLabel")} floated>
          <CurrencyInput
            className="pd-newpay-amount"
            value={money.autoAmount}
            max={money.autoDefault}
            selectOnFocus
            onChange={(amount) => update({ amount })}
          />
        </FloatingLabel>
        <small className="pd-newpay-hint">{t("Patient:Payment:AutoAmountHint")}</small>
      </>
    );
  }
  if (chosen.length === 0) return <p className="pd-newpay-empty">{t("Patient:Payment:SelectServiceFirst")}</p>;
  return (
    <div className="pd-newpay-manual">
      {chosen.map((line) => (
        <div key={line.id}>
          <span>
            {line.serviceName ?? line.code}
            <small>
              {t("Patient:Payment:ManualLineHint", rounds.roundOf(line.id), formatMoneyUnit(money.capOf(line.id)))}
            </small>
          </span>
          <CurrencyInput
            value={money.shareOf(line)}
            max={money.capOf(line.id)}
            selectOnFocus
            onChange={(value) => update({ manual: { ...form.manual, [line.id]: value } })}
          />
        </div>
      ))}
    </div>
  );
}
