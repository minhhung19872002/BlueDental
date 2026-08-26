import { useEffect, useState } from "react";

/**
 * Where the period switch is drawn.
 *
 * The reference puts Ngày / Tuần / Tháng / Năm at the right-hand end of the tab
 * row above the report — the middle row where a division has one, otherwise the
 * sub-tab row. Those rows belong to the page, and the period state belongs to
 * the report that reads it, so the report renders its bar into a slot the page
 * leaves open rather than the two trading state.
 */
export const PERIOD_SLOT_ID = "bd-ops-period-slot";

/**
 * The slot element, once the page has mounted it.
 *
 * Null on the first render — the page renders its rows before the report inside
 * them — so this re-runs after mount and the bar lands as soon as there is
 * somewhere to put it.
 */
export function usePeriodSlot(): HTMLElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById(PERIOD_SLOT_ID));
  });

  return slot;
}
