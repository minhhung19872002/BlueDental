import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import type { ReceiptCashierDiscountDto } from "../../api/paymentReceiptApi";

/**
 * Giảm giá thu ngân on this receipt with the cashier's reason (P2910, step 6):
 * the accountant reads it before exporting, and it stays on the paid receipt.
 * The customer's sheet and the iPad show the amount only, never the reason.
 */
export function ReceiptCashierDiscounts({ discounts }: { discounts: readonly ReceiptCashierDiscountDto[] }) {
  if (discounts.length === 0) return null;
  return (
    <section className="rcpt-discounts" aria-label={t("Receipt:Discount:Title")}>
      <p className="rcpt-discounts-title">{t("Receipt:Discount:Title")}</p>
      <ul>
        {discounts.map((discount, index) => (
          <li key={`${index}-${discount.name}`}>
            <span className="rcpt-discounts-line">
              <span>{discount.name}</span>
              <b>{t("Receipt:Discount:Amount", formatVND(discount.amount))}</b>
            </span>
            <small>
              {discount.reason ? t("Receipt:Discount:Reason", discount.reason) : t("Receipt:Discount:NoReason")}
            </small>
          </li>
        ))}
      </ul>
    </section>
  );
}
