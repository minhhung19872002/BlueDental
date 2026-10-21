import type { TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";
import { MONEY_MASK } from "./LineMoney";
import { moneyCellClass, moneyText, planMoney, type PlanMoney } from "./planTypes";

/**
 * One money column of a slip on the Kế hoạch điều trị list, or the mask on a
 * slip seen through lines without "Chi phí › Xem" (BA bug 40, "Dc assign mà
 * ko có quyền xem thì masking lại hết"). The server sends 0 for such a slip.
 */
export function SlipMoney({ plan, field }: { plan: TreatmentPlanSlipDto; field: keyof PlanMoney }) {
  if (plan.moneyHidden) return <span className="tp-money-hidden">{MONEY_MASK}</span>;
  const value = planMoney(plan)[field];
  return <span className={moneyCellClass(field, value)}>{moneyText(value)}</span>;
}
