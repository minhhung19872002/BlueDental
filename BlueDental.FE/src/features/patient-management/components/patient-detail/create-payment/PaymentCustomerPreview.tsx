import { EyeOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { receiptNameToSend, type LineFigures } from "./paymentRounds";
import { Fact } from "./PaymentSelectedTotals";
import type { PaymentForm } from "./usePaymentForm";

/** "Giảm giá −X · Voucher −Y" under a line, when this đợt lets anything off it. */
function reliefNote({ discount, voucherShare }: LineFigures): string | null {
  const parts = [
    discount > 0 ? t("Patient:Payment:PreviewDiscount", formatMoneyUnit(discount)) : null,
    voucherShare > 0 ? t("Patient:Payment:PreviewVoucher", formatMoneyUnit(voucherShare)) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * "Khách sẽ thấy trên phiếu" (P2910): the lines as the PHIẾU THU will print
 * them — each one's Tên trên phiếu, what this đợt lets off it and collects on
 * it — the way the customer checks them at step 4. The TN giảm reason is for
 * the accountant at step 6, not for the customer.
 */
export function PaymentCustomerPreview({ payment }: { payment: PaymentForm }) {
  const { money, terms, rounds } = payment;
  if (money.figures.length === 0) return null;
  return (
    <section className="pd-newpay-preview">
      <h4 className="pd-newpay-head pd-newpay-head--split">
        <span>
          <EyeOutlined /> {t("Patient:Payment:PreviewHeader")}
        </span>
        <span className="pd-newpay-preview-step">{t("Patient:Payment:PreviewStep")}</span>
      </h4>
      <ul>
        {money.figures.map((figures) => {
          const { line } = figures;
          const plain = line.serviceName ?? line.code;
          const note = reliefNote(figures);
          return (
            <li key={line.id}>
              <span>
                {receiptNameToSend(terms.appliedOf(line.id), plain, rounds.roundOf(line.id)) ?? plain}
                {note ? <small>{note}</small> : null}
              </span>
              <b>{formatMoneyUnit(money.amountOf(line.id))}</b>
            </li>
          );
        })}
      </ul>
      <Fact label={t("Patient:Payment:CollectNow")} value={formatMoneyUnit(money.total)} tone="strong" />
      <Fact label={t("Patient:Payment:DebtAfter")} value={formatMoneyUnit(money.after)} />
    </section>
  );
}
