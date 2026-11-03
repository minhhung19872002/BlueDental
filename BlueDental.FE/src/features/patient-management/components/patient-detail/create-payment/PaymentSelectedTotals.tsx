import { ProfileOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import type { RoundTotals } from "./paymentRoundMoney";

/** One "Nội dung — value" line of a fact block. */
export function Fact({ label, value, tone }: { label: string; value: string; tone?: "strong" | "debt" }) {
  return (
    <div className="pd-newpay-fact">
      <span>{label}</span>
      <span className={tone ? `pd-newpay-${tone}` : undefined}>{value}</span>
    </div>
  );
}

const ROWS: ReadonlyArray<[keyof RoundTotals, string]> = [
  ["gross", "Patient:Payment:Total"],
  ["doctorDiscount", "Patient:Payment:DoctorDiscount"],
  ["cashierDiscount", "Patient:Payment:CashierDiscount"],
  ["voucher", "Patient:Payment:VoucherLabel"],
  ["afterDiscount", "Patient:Payment:TotalAfterDiscount"],
  ["tax", "Patient:Payment:Vat"],
  ["payable", "Patient:Payment:TotalWithVat"],
  ["paid", "Patient:Payment:Paid"],
  ["priorRelief", "Patient:Payment:PriorRelief"],
  ["due", "Patient:Payment:DebtToPay"],
];

/**
 * "Tổng tiền dịch vụ đã chọn" (P2910), in the BA's ten rows over the ticked
 * services: Giá gốc, the doctor's discount, this đợt's TN giảm and voucher,
 * the VAT once they are off, then what earlier đợt paid and let off. Còn nợ
 * cần thanh toán is what they owe, not what is left after the amount typed.
 */
export function PaymentSelectedTotals({ totals }: { totals: RoundTotals }) {
  return (
    <section>
      <h4 className="pd-newpay-head">
        <ProfileOutlined /> {t("Patient:Payment:SelectedTotal")}
      </h4>
      {ROWS.map(([key, label]) => (
        <Fact
          key={key}
          label={t(label)}
          value={formatMoneyUnit(totals[key])}
          tone={key === "due" ? "debt" : undefined}
        />
      ))}
    </section>
  );
}
