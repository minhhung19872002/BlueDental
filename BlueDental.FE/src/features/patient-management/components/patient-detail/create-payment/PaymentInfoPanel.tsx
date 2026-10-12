import type { ReactNode } from "react";
import { Checkbox, Input } from "antd";
import {
  AccountBookOutlined,
  BankOutlined,
  CreditCardOutlined,
  DollarOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingLabel } from "@/components/FloatingLabel";
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
import type { PaymentForm, SplitMode } from "./usePaymentForm";

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

const MODE_KEYS: ReadonlyArray<[SplitMode, string]> = [
  ["auto", "Patient:Payment:SplitAuto"],
  ["manual", "Patient:Payment:SplitManual"],
];

const NOTE_LIMIT = 500;

/** Tự động: one figure, capped at what the ticked services owe. Thủ công: a box per service. */
function AmountInput({ payment }: { payment: PaymentForm }) {
  const { form, chosen, shareOf, update } = payment;
  if (form.mode === "auto") {
    return (
      <>
        <FloatingLabel label={t("Patient:Payment:AmountLabel")} floated>
          <CurrencyInput
            className="pd-newpay-amount"
            value={payment.autoAmount}
            max={payment.autoDefault}
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
          <span>{line.serviceName ?? line.code}</span>
          <CurrencyInput
            value={shareOf(line)}
            max={line.outstandingAmount}
            onChange={(value) => update({ manual: { ...form.manual, [line.id]: value } })}
          />
        </div>
      ))}
    </div>
  );
}

/** The right column: how much, how it is split, how it is paid. */
export function PaymentInfoPanel({ payment, heldForPatient, accountKind, accounts }: Props) {
  const { form, update } = payment;
  const methodLabels = paymentMethodLabels();
  return (
    <div className="pd-newpay-col pd-newpay-col--right">
      <section>
        <h4 className="pd-newpay-head">
          <DollarOutlined /> {t("Patient:Payment:InfoHeader")}
        </h4>
        <div className="pd-newpay-modes">
          {MODE_KEYS.map(([key, label]) => (
            <label key={key} className={form.mode === key ? "active" : undefined}>
              <input type="radio" name="pd-split-mode" checked={form.mode === key} onChange={() => update({ mode: key })} />
              <span className="pd-newpay-radio" />
              {t(label)}
            </label>
          ))}
        </div>
        <AmountInput payment={payment} />
        <div className="pd-newpay-notewrap">
          <FloatingLabel label={t("Patient:Payment:NoteLabel")} floated={form.note.length > 0}>
            <Input.TextArea
              value={form.note}
              rows={3}
              maxLength={NOTE_LIMIT}
              onChange={(event) => update({ note: event.target.value })}
            />
          </FloatingLabel>
          <small>
            {form.note.length}/{NOTE_LIMIT}
          </small>
        </div>
      </section>

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
        {payment.overpaid ? <p className="pd-newpay-error">{t("Patient:Payment:AmountExceedsBalance")}</p> : null}
      </section>
    </div>
  );
}
