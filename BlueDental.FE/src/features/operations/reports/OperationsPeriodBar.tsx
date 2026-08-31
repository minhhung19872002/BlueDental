import { createPortal } from "react-dom";
import { PeriodBar } from "@/components/PeriodBar";
import type { PeriodRange, ReportPeriod } from "@/hooks/usePeriodRange";
import { usePeriodSlot } from "./periodBarSlot";

interface Props {
  range: PeriodRange;
  /** Khách hàng phát sinh and Hóa đơn stop at Tháng; the rest offer Năm too. */
  periods?: ReportPeriod[];
}

/**
 * The shared PeriodBar, teleported to where Vận hành wants it.
 *
 * The reference puts the control at the right-hand end of whichever tab row is
 * directly above the report, so it portals into that row here too rather than
 * sitting in a strip of its own; in place while the page is still mounting, so
 * the control is never missing.
 */
export function OperationsPeriodBar({ range, periods }: Props) {
  const slot = usePeriodSlot();
  const bar = <PeriodBar range={range} periods={periods} />;
  return slot ? createPortal(bar, slot) : bar;
}
