import type { ReactNode } from "react";
import { Checkbox } from "antd";
import {
  AccountBookOutlined,
  BankOutlined,
  CreditCardOutlined,
  DollarOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
  PAYMENT_METHOD,
  PAYMENT_METHOD_ORDER,
  paymentMethodLabels,
  type PaymentMethodKind,
} from "@/features/treatment-management/api/treatmentPlanApi";
import type { PaymentAccountKindCode, PaymentAccountOption } from "@/hooks/usePaymentAccountOptions";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { PaymentAccountList } from "./PaymentAccountList";
import type { PaymentForm } from "./usePaymentForm";

interface Props {
  payment: PaymentForm;
  heldForPatient: number;
  accountKind: PaymentAccountKindCode | null;
  accounts: PaymentAccountOption[];
}

const METHOD_ICONS: Record<PaymentMethodKind, ReactNode> = {
  [PAYMENT_METHOD.Cash]: <DollarOutlined />,
  [PAYMENT_METHOD.Banking]: <BankOutlined />,
  [PAYMENT_METHOD.EWallet]: <WalletOutlined />,
  [PAYMENT_METHOD.Card]: <CreditCardOutlined />,
  [PAYMENT_METHOD.OutstandingDebt]: <AccountBookOutlined />,
};

/** "Phương thức thanh toán": the pills, the account a transfer went into, and Xuất hóa đơn đỏ. */
export function PaymentMethodSection({ payment, heldForPatient, accountKind, accounts }: Props) {
  const { form, update } = payment;
  const methodLabels = paymentMethodLabels();
  return (
    <section>
      <h4 className="pd-newpay-head">
        <CreditCardOutlined /> {t("Patient:Payment:MethodHeader")}
      </h4>
      <div className="pd-newpay-methods">
        {PAYMENT_METHOD_ORDER.map((kind) => (
          <button
            type="button"
            key={kind}
            className={form.method === kind ? "active" : undefined}
            onClick={() => payment.chooseMethod(kind)}
          >
            <i>{METHOD_ICONS[kind]}</i>
            {methodLabels[kind]}
            {kind === PAYMENT_METHOD.OutstandingDebt ? <em>{formatMoneyUnit(heldForPatient)}</em> : null}
          </button>
        ))}
      </div>
      {accountKind !== null ? (
        <PaymentAccountList
          kind={accountKind}
          accounts={accounts}
          value={form.accountId}
          onChange={(accountId) => update({ accountId })}
        />
      ) : null}
      {/* Only stored on the receipt; the e-invoice is issued from another screen. */}
      <Checkbox
        className="pd-newpay-redinvoice"
        checked={form.redInvoice}
        onChange={(event) => update({ redInvoice: event.target.checked })}
      >
        {t("Patient:Payment:RedInvoice")}
      </Checkbox>
    </section>
  );
}
