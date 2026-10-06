import { formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";

interface PaymentLedgerKpisProps {
  totalAmount: number;
  totalCount: number;
}

/** Both figures are the server's, for the whole period and search — not the page. */
export function PaymentLedgerKpis({ totalAmount, totalCount }: PaymentLedgerKpisProps) {
  return (
    <div className="billing-kpis billing-kpis--two">
      <div className="page-card billing-kpi">
        <div className="billing-kpi-label">{t("Billing:Ledger:KpiTotal")}</div>
        <div className="billing-kpi-value billing-kpi-value--paid">{formatVND(totalAmount)}</div>
      </div>
      <div className="page-card billing-kpi">
        <div className="billing-kpi-label">{t("Billing:Ledger:KpiCount")}</div>
        <div className="billing-kpi-value">{totalCount.toLocaleString("vi-VN")}</div>
      </div>
    </div>
  );
}
