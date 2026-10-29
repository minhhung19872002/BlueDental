import { Select } from "antd";
import { t } from "@/lib/i18n";
import { LEDGER_METHOD_ORDER, ledgerMethodLabels, type LedgerMethod } from "../api/paymentLedgerApi";

interface Props {
  value: LedgerMethod | undefined;
  onChange: (value: LedgerMethod | undefined) => void;
}

/** One payment method at a time; cleared, the list shows every method (R-1071). */
export function LedgerMethodSelect({ value, onChange }: Props) {
  const labels = ledgerMethodLabels();
  return (
    <Select<LedgerMethod>
      allowClear
      className="billing-method-filter"
      placeholder={t("Treatment:Receipt:PaymentMethodShort")}
      aria-label={t("Billing:PaymentMethodLabel")}
      value={value}
      onChange={onChange}
      options={LEDGER_METHOD_ORDER.map((method) => ({ value: method, label: labels[method] }))}
    />
  );
}
