import type { TreatmentServiceDto } from "../../api/treatmentPlanApi";
import { moneyText } from "./planTypes";

/** Printed in place of a figure the server held back, as on /patient (R-1003). */
export const MONEY_MASK = "*********";

/**
 * A money figure of one service line, or the mask on a line that is not the
 * viewer's own on a slip they see only through their lines (BA bug 40). The
 * server sends 0 for such a line, never the real figure.
 */
export function LineMoney({ service, value }: { service: TreatmentServiceDto; value: number }) {
  if (service.moneyHidden) return <span className="tp-money-hidden">{MONEY_MASK}</span>;
  return <>{moneyText(value)}</>;
}
