import { Input } from "antd";
import { DollarOutlined } from "@ant-design/icons";
import { FloatingLabel } from "@/components/FloatingLabel";
import type { PaymentAccountKindCode, PaymentAccountOption } from "@/hooks/usePaymentAccountOptions";
import { t } from "@/lib/i18n";
import { PaymentAmountInput } from "./PaymentAmountInput";
import { PaymentCollectBox } from "./PaymentCollectBox";
import { PaymentCustomerPreview } from "./PaymentCustomerPreview";
import { PaymentMethodSection } from "./PaymentMethodSection";
import { PaymentSelectedTotals } from "./PaymentSelectedTotals";
import { PaymentVoucherPicker } from "./PaymentVoucherPicker";
import type { PaymentForm, SplitMode } from "./usePaymentForm";

interface Props {
  payment: PaymentForm;
  heldForPatient: number;
  accountKind: PaymentAccountKindCode | null;
  accounts: PaymentAccountOption[];
}

const MODE_KEYS: ReadonlyArray<[SplitMode, string]> = [
  ["auto", "Patient:Payment:SplitAuto"],
  ["manual", "Patient:Payment:SplitManual"],
];

const NOTE_LIMIT = 500;

/**
 * The right column (P2910): how much and how it is split, the đợt's voucher,
 * Thu đợt này and the note; then how it is paid, the ticked services' totals
 * and the receipt as the customer will see it.
 */
export function PaymentInfoPanel({ payment, heldForPatient, accountKind, accounts }: Props) {
  const { form, update, money } = payment;
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
        <PaymentAmountInput payment={payment} />
        <PaymentVoucherPicker voucher={payment.voucher} />
        <PaymentCollectBox money={money} />
        {money.overpaid ? <p className="pd-newpay-error">{t("Patient:Payment:AmountExceedsBalance")}</p> : null}
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

      <PaymentMethodSection
        payment={payment}
        heldForPatient={heldForPatient}
        accountKind={accountKind}
        accounts={accounts}
      />
      <PaymentSelectedTotals totals={money.totals} />
      <PaymentCustomerPreview payment={payment} />
    </div>
  );
}
