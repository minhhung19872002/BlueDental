import { ProfileOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import type { SelectedTotals } from "./paymentDialogModel";

/** One "Nội dung — value" line of a fact block. */
export function Fact({ label, value, tone }: { label: string; value: string; tone?: "strong" | "debt" }) {
  return (
    <div className="pd-newpay-fact">
      <span>{label}</span>
      <span className={tone ? `pd-newpay-${tone}` : undefined}>{value}</span>
    </div>
  );
}

/**
 * "Tổng tiền dịch vụ đã chọn": gross prices and every discount, the lines' own
 * included (R-586), over the ticked services only. Còn nợ cần thanh toán is
 * what they owe, not what is left after the amount being typed.
 */
export function PaymentSelectedTotals({ totals }: { totals: SelectedTotals }) {
  return (
    <section>
      <h4 className="pd-newpay-head">
        <ProfileOutlined /> {t("Patient:Payment:SelectedTotal")}
      </h4>
      <Fact label={t("Patient:Payment:Total")} value={formatMoneyUnit(totals.gross)} />
      <Fact label={t("Common:Discount")} value={formatMoneyUnit(totals.discount)} />
      <Fact label={t("Patient:Payment:TotalAfterDiscount")} value={formatMoneyUnit(totals.afterDiscount)} />
      <Fact label={t("Patient:Payment:Vat")} value={formatMoneyUnit(totals.tax)} />
      <Fact label={t("Patient:Payment:TotalWithVat")} value={formatMoneyUnit(totals.payable)} />
      <Fact label={t("Patient:Payment:Paid")} value={formatMoneyUnit(totals.paid)} />
      <Fact label={t("Patient:Payment:DebtToPay")} value={formatMoneyUnit(totals.due)} tone="debt" />
    </section>
  );
}
