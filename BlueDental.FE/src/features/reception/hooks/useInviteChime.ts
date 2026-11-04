import { useCallback, useEffect, useRef, useState } from "react";
import { playChime } from "@/lib/chime";
import type { ArrivalCall } from "../types/arrivalCall";

const NONE: ReadonlySet<string> = new Set();

/**
 * Rings once when a doctor's "Mời lên" puts a new patient on the viewer's
 * "Bác sĩ mời lên" list (R-1144, owner 2026-11-04). The first list after a
 * load or a branch change is only remembered, so patients called up earlier
 * do not ring; a patient this tab called up itself (an admin) does not ring
 * either. Leaving the list (seated) never rings.
 *
 * A ring the browser blocked (no click on the page yet) is reported as
 * `missed` while one of those patients is still on the list, until the viewer
 * acknowledges it by opening the list (R-1145).
 */
export function useInviteChime(
  items: ArrivalCall[] | undefined,
  branchId: string | undefined,
  selfInvited: ReadonlySet<string>,
) {
  const knownRef = useRef<{ branchId: string | undefined; ids: Set<string> } | null>(null);
  const [missedIds, setMissedIds] = useState(NONE);

  useEffect(() => {
    if (!items) return;
    const ids = new Set(items.map((item) => item.id));
    const known = knownRef.current;
    knownRef.current = { branchId, ids };
    if (!known || known.branchId !== branchId) return;
    const newIds = items.map((item) => item.id).filter((id) => !known.ids.has(id) && !selfInvited.has(id));
    if (newIds.length === 0) return;
    void playChime().then((heard) => {
      if (!heard) setMissedIds((prev) => new Set([...prev, ...newIds]));
    });
  }, [items, branchId, selfInvited]);

  const acknowledge = useCallback(() => setMissedIds(NONE), []);
  const missed = missedIds.size > 0 && !!items?.some((item) => missedIds.has(item.id));

  return { missed, acknowledge };
}
