import type { RecordCardRow } from "@/components/RecordCard";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";
import {
  PLAN_COLUMN_LABELS,
  moneyText,
  planPill,
  planMoney,
  type PlanColumnKey,
  type PlanColumnSetting,
  type PlanMoney,
} from "./planTypes";

/** How many rows a plan card shows before "Xem thêm". */
const CARD_FOLD_AT = 4;

const MONEY_MODIFIER: Partial<Record<keyof PlanMoney, string>> = {
  discount: "tp-cell-money--discount",
  paid: "tp-cell-money--paid",
  remaining: "tp-cell-money--due",
  receivable: "tp-cell-money--receivable",
};

function moneyValue(plan: TreatmentPlanSlipDto, field: keyof PlanMoney) {
  return (
    <span className={["tp-cell-money", MONEY_MODIFIER[field]].filter(Boolean).join(" ")}>
      {moneyText(planMoney(plan)[field])}
    </span>
  );
}

function statusPill(plan: TreatmentPlanSlipDto) {
  const pill = planPill(plan);
  return <span className={["tp-pill", pill.modifier].filter(Boolean).join(" ")}>{t(pill.label)}</span>;
}

/** The card row for one configurable column; code and the eye live on the head. */
function cardRow(plan: TreatmentPlanSlipDto, key: PlanColumnKey): RecordCardRow | null {
  const label = t(PLAN_COLUMN_LABELS[key]);
  switch (key) {
    case "code":
    case "services":
      return null;
    case "dentist":
      return { key, label, value: plan.dentistName };
    case "status":
      return { key, label, value: statusPill(plan) };
    case "createdAt":
      return { key, label, value: formatDate(plan.creationTime) };
    default:
      return { key, label, value: moneyValue(plan, key) };
  }
}

/**
 * Card rows in the "Cột hiển thị" order, split so the first few stay visible
 * and the rest fold behind "Xem thêm", as the prescription cards do.
 */
export function planCardRows(
  plan: TreatmentPlanSlipDto,
  settings: PlanColumnSetting[],
): { rows: RecordCardRow[]; moreRows: RecordCardRow[] } {
  const rows = settings
    .filter((item) => item.visible)
    .map((item) => cardRow(plan, item.key))
    .filter((row): row is RecordCardRow => row !== null);
  return { rows: rows.slice(0, CARD_FOLD_AT), moreRows: rows.slice(CARD_FOLD_AT) };
}
