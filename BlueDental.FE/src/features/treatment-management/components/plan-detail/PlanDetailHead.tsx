import { t } from "@/lib/i18n";
import type { PaymentSummaryDto } from "../../api/treatmentPlanApi";
import { moneyText } from "../plan/planTypes";
import { PLAN_TAB_KEYS, PLAN_TAB_LABELS, type PlanTabKey } from "./planDetailTypes";

interface Stat {
  key: keyof PaymentSummaryDto;
  label: string;
  tone: "ink" | "green" | "red" | "amber";
}

/**
 * The six figures on the right of the tab strip, in the reference's order
 * (re-measured 2026-09-22 — "Tạm ứng" sits between "Đã hoàn" and "Dư nợ", and
 * was missing here).
 *
 * "Tạm ứng" reads `paidUncompleted`: money collected on the slip that the work
 * has not earned yet. The reference's payload carries the same figure in
 * `prepaid` on the one slip that could be observed, so which of the two it
 * prints is recorded as unknown — see docs/clone/unknowns.md.
 */
const STATS: Stat[] = [
  { key: "totalPrice", label: "Treatment:PlanDetail:Stat:ExpectedRevenue", tone: "ink" },
  { key: "totalPaid", label: "Treatment:PlanDetail:Stat:Paid", tone: "ink" },
  { key: "debt", label: "Treatment:PlanDetail:Stat:Debt", tone: "green" },
  { key: "totalRefund", label: "Treatment:PlanDetail:Stat:Refunded", tone: "red" },
  { key: "paidUncompleted", label: "Treatment:PlanDetail:Stat:Prepaid", tone: "amber" },
  { key: "outstandingDebt", label: "Treatment:PlanDetail:Stat:OutstandingDebt", tone: "amber" },
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
      <div className="pdt-tabs" role="tablist" aria-label={t("Treatment:Plan:TreatmentPlan")}>
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
