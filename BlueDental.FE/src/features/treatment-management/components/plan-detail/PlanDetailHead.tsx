import { t } from "@/lib/i18n";
import type { PaymentSummaryDto } from "../../api/treatmentPlanApi";
import { moneyText } from "../plan/planTypes";
import { PLAN_TAB, PLAN_TAB_LABELS, type PlanTabKey } from "./planDetailTypes";

interface Stat {
  key: keyof PaymentSummaryDto;
  label: string;
  tone: "ink" | "green" | "red" | "orange";
}

/**
 * The five figures on the right of the tab strip (P0111_02, R-1104): Tạm ứng
 * and Dư nợ are gone, and Khuyến mãi — the TN giảm and vouchers of confirmed
 * receipts, before VAT — sits between Đã thanh toán and Công nợ.
 */
const STATS: Stat[] = [
  { key: "totalPrice", label: "Treatment:PlanDetail:Stat:ExpectedRevenue", tone: "ink" },
  { key: "totalPaid", label: "Treatment:PlanDetail:Stat:Paid", tone: "ink" },
  { key: "promotion", label: "Treatment:PlanDetail:Stat:Promotion", tone: "orange" },
  { key: "debt", label: "Treatment:PlanDetail:Stat:Debt", tone: "green" },
  { key: "totalRefund", label: "Treatment:PlanDetail:Stat:Refunded", tone: "red" },
];

/** Bảo hành's count and its orange "k chờ" (P3110 REQ-B1); absent until read. */
export interface WarrantyTabCounts {
  count: number;
  pending: number;
}

interface Props {
  tab: PlanTabKey;
  /** The tabs this user may open — the money tabs need payment.read. */
  tabs: readonly PlanTabKey[];
  payment: PaymentSummaryDto;
  warranty?: WarrantyTabCounts;
  onTabChange: (tab: PlanTabKey) => void;
}

/** "Bảo hành 6 · 2 chờ": the count always (0 included, m348), the badge only when something waits. */
function WarrantyCounts({ counts }: { counts: WarrantyTabCounts }) {
  return (
    <>
      <span className="pdt-tab-count">{counts.count}</span>
      {counts.pending > 0 && (
        <span className="pdt-tab-pending">{t("Treatment:Warranty:TabPending", counts.pending)}</span>
      )}
    </>
  );
}

/**
 * The slip's tab strip: the same white strip and pills as the patient record's
 * tab row (BA 2026-10-15), with the money summary on its right. The summary
 * belongs to the money tabs only (Thanh toán, Hoàn tiền, Dư nợ) — "Chi tiết
 * điều trị" and "Bảo hành" leave it out (owner 2026-10-15, mock P3110). The actions stay in the card
 * below, beside the table they act on.
 */
export function PlanDetailHead({ tab, tabs, payment, warranty, onTabChange }: Props) {
  const showStats = tab !== PLAN_TAB.detail && tab !== PLAN_TAB.warranty;
  return (
    <div className="pdt-tabrow">
      <div className="bd-tabbar">
        <div className="pill-tabs" role="tablist" aria-label={t("Treatment:Plan:TreatmentPlan")}>
          {tabs.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === tab}
              className={["pill-tab", key === tab && "pill-tab--active"].filter(Boolean).join(" ")}
              onClick={() => onTabChange(key)}
            >
              {t(PLAN_TAB_LABELS[key])}
              {key === PLAN_TAB.warranty && warranty && <WarrantyCounts counts={warranty} />}
            </button>
          ))}
        </div>
      </div>
      {showStats && (
        <dl className="pdt-stats">
          {STATS.map((stat) => (
            <div key={stat.key} className={`pdt-stat pdt-stat--${stat.tone}`}>
              <dd>{moneyText(payment[stat.key])}</dd>
              <dt>{t(stat.label)}</dt>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
