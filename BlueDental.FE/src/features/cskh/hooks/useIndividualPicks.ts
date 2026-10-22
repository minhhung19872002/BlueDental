import { useMemo, useState } from "react";

/**
 * Khách lẻ: customers added from the search box, each with its tick. An
 * unticked customer stays in the table but out of the send. Opened from a
 * CSKH row, that one customer is already added and ticked.
 */
export function useIndividualPicks(lockedPatientId: string | null) {
  const [addedIds, setAddedIds] = useState<readonly string[]>(lockedPatientId ? [lockedPatientId] : []);
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());

  const isChecked = (patientId: string) => !unticked.has(patientId);
  const checkedIds = useMemo(() => addedIds.filter((id) => !unticked.has(id)), [addedIds, unticked]);

  const add = (patientId: string) => {
    setAddedIds((ids) => (ids.includes(patientId) ? ids : [...ids, patientId]));
    setUnticked((ids) => without(ids, patientId));
  };

  const toggle = (patientId: string) =>
    setUnticked((ids) => (ids.has(patientId) ? without(ids, patientId) : new Set(ids).add(patientId)));

  return {
    addedIds,
    checkedIds,
    isChecked,
    add,
    toggle,
  };
}

function without(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!ids.has(id)) return ids;
  const next = new Set(ids);
  next.delete(id);
  return next;
}

export type IndividualPicks = ReturnType<typeof useIndividualPicks>;
