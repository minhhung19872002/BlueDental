import { t } from "@/lib/i18n";
import type { PaymentSummaryDto } from "../../api/treatmentPlanApi";
import { moneyText } from "../plan/planTypes";
import { PLAN_TAB_KEYS, PLAN_TAB_LABELS, type PlanTabKey } from "./planDetailTypes";

interface Stat {
  key: keyof PaymentSummaryDto;
  label: string;
  tone: "ink" | "green" | "red" | "amber";
}

/** The five figures on the right of the tab strip, in the reference's order. */
const STATS: Stat[] = [
  { key: "totalPrice", label: "Doanh thu dự kiến", tone: "ink" },
  { key: "totalPaid", label: "Đã thanh toán", tone: "ink" },
  { key: "debt", label: "Công nợ", tone: "green" },
  { key: "totalRefund", label: "Đã hoàn", tone: "red" },
  { key: "outstandingDebt", label: "Dư nợ", tone: "amber" },
];

interface Props {
  tab: PlanTabKey;
  payment: PaymentSummaryDto;
  onTabChange: (tab: PlanTabKey) => void;
}

/** The pill tabs on the left and the slip's money summary on the right. */
export function PlanDetailHead({ tab, payment, onTabChange }: Props) {
  return (
    <div className="pdt-head">
      <div className="pdt-tabs" role="tablist" aria-label={t("Kế hoạch điều trị")}>
        {PLAN_TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === tab}
            className={["pdt-tab", key === tab && "pdt-tab--active"].filter(Boolean).join(" ")}
            onClick={() => onTabChange(key)}
          >
            {t(PLAN_TAB_LABELS[key])}
          </button>
        ))}
      </div>
      <dl className="pdt-stats">
        {STATS.map((stat) => (
          <div key={stat.key} className={`pdt-stat pdt-stat--${stat.tone}`}>
            <dd>{moneyText(payment[stat.key])}</dd>
            <dt>{t(stat.label)}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
