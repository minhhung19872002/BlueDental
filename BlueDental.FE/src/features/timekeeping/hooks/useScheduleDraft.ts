import { useCallback, useMemo, useState } from "react";
import { WORK_SCHEDULE_SHIFT, type WorkScheduleShift } from "../api/workScheduleApi";
import type { PendingChange, ScheduleMemberVm } from "../types/workSchedule";
import { pendingKey } from "../utils/workScheduleShift";

export interface ScheduleDraft {
  /** What the cell shows: the unsaved change, else the saved shift. */
  shiftOf: (member: ScheduleMemberVm, date: string) => WorkScheduleShift;
  isPending: (staffId: string, date: string) => boolean;
  /** Paints `shift`; painting the saved value back drops the change. */
  setShift: (member: ScheduleMemberVm, date: string, shift: WorkScheduleShift) => void;
  /** Applies several cells at once (one render). */
  setMany: (member: ScheduleMemberVm, dates: readonly string[], shift: WorkScheduleShift) => void;
  revert: (staffId: string, date: string) => void;
  reset: () => void;
  changes: PendingChange[];
}

const savedShift = (member: ScheduleMemberVm, date: string): WorkScheduleShift =>
  member.saved.get(date) ?? WORK_SCHEDULE_SHIFT.None;

function withShift(
  map: Map<string, PendingChange>,
  member: ScheduleMemberVm,
  date: string,
  shift: WorkScheduleShift,
) {
  const key = pendingKey(member.staffId, date);
  const from = savedShift(member, date);
  if (shift === from) map.delete(key);
  else map.set(key, { staffId: member.staffId, staffName: member.fullName, date, from, to: shift });
}

/**
 * The board's unsaved cells (BA P0911): kept across months until "Lưu lịch"
 * sends them all, or "Đặt lại" drops them.
 */
export function useScheduleDraft(): ScheduleDraft {
  const [pending, setPending] = useState<ReadonlyMap<string, PendingChange>>(() => new Map());

  const shiftOf = useCallback(
    (member: ScheduleMemberVm, date: string) =>
      pending.get(pendingKey(member.staffId, date))?.to ?? savedShift(member, date),
    [pending],
  );

  const isPending = useCallback(
    (staffId: string, date: string) => pending.has(pendingKey(staffId, date)),
    [pending],
  );

  const setMany = useCallback(
    (member: ScheduleMemberVm, dates: readonly string[], shift: WorkScheduleShift) => {
      setPending((prev) => {
        const next = new Map(prev);
        for (const date of dates) withShift(next, member, date, shift);
        return next;
      });
    },
    [],
  );

  const setShift = useCallback(
    (member: ScheduleMemberVm, date: string, shift: WorkScheduleShift) => setMany(member, [date], shift),
    [setMany],
  );

  const revert = useCallback((staffId: string, date: string) => {
    setPending((prev) => {
      const key = pendingKey(staffId, date);
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const reset = useCallback(() => setPending(new Map()), []);

  const changes = useMemo(() => [...pending.values()], [pending]);

  return { shiftOf, isPending, setShift, setMany, revert, reset, changes };
}
