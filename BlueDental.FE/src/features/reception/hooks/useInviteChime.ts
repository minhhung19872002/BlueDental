import { useEffect, useRef } from "react";
import { playChime } from "@/lib/chime";
import type { ArrivalCall } from "../types/arrivalCall";

/**
 * Rings once when a doctor's "Mời lên" puts a new patient on the viewer's
 * "Bác sĩ mời lên" list (R-1144, owner 2026-11-04). The first list after a
 * load or a branch change is only remembered, so patients called up earlier
 * do not ring; a patient this tab called up itself (an admin) does not ring
 * either. Leaving the list (seated) never rings.
 */
export function useInviteChime(
  items: ArrivalCall[] | undefined,
  branchId: string | undefined,
  selfInvited: ReadonlySet<string>,
): void {
  const knownRef = useRef<{ branchId: string | undefined; ids: Set<string> } | null>(null);

  useEffect(() => {
    if (!items) return;
    const ids = new Set(items.map((item) => item.id));
    const known = knownRef.current;
    knownRef.current = { branchId, ids };
    if (!known || known.branchId !== branchId) return;
    const rings = items.some((item) => !known.ids.has(item.id) && !selfInvited.has(item.id));
    if (rings) playChime();
  }, [items, branchId, selfInvited]);
}
