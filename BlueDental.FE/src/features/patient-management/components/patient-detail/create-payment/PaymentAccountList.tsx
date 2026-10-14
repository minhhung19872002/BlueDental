import {
  PAYMENT_ACCOUNT_KIND,
  type PaymentAccountKindCode,
  type PaymentAccountOption,
} from "@/hooks/usePaymentAccountOptions";
import { t } from "@/lib/i18n";

interface Props {
  kind: PaymentAccountKindCode;
  accounts: PaymentAccountOption[];
  value: string | undefined;
  onChange: (id: string) => void;
}

/** The clinic accounts Ngân hàng / Ví momo collect into; one must be picked. */
export function PaymentAccountList({ kind, accounts, value, onChange }: Props) {
  const bank = kind === PAYMENT_ACCOUNT_KIND.Bank;
  return (
    <div className="pd-newpay-accounts">
      <div className="pd-newpay-acchead">
        <span>{t("Patient:Payment:Select")}</span>
        <span>{bank ? t("Patient:Payment:BankName") : t("Patient:Payment:MomoPhone")}</span>
        <span>{bank ? t("Patient:Payment:AccountNumber") : t("Patient:Payment:AccountHolder")}</span>
      </div>
      {accounts.length === 0 ? (
        <p className="pd-newpay-empty">
          {bank ? t("Patient:Payment:NoBankMethod") : t("Patient:Payment:NoMomoMethod")}
        </p>
      ) : (
        accounts.map((account) => (
          <label className="pd-newpay-accrow" key={account.id}>
            <input
              type="radio"
              name="pd-payment-account"
              checked={value === account.id}
              onChange={() => onChange(account.id)}
            />
            <span className="pd-newpay-radio" />
            <span>{bank ? (account.bankName ?? "—") : (account.phoneNumber ?? "—")}</span>
            <span>{bank ? (account.accountNumber ?? "—") : account.holderName}</span>
          </label>
        ))
      )}
    </div>
  );
}
