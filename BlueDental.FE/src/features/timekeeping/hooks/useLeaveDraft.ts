import { useCallback, useMemo, useState } from "react";

import type { LeaveShift } from "../api/timekeepingApi";
import {
  leaveDayError,
  leaveMinutes,
  shiftRange,
  type LeaveDayDraft,
  type ShiftWindows,
} from "../utils/leaveShifts";

type TimeField = "start" | "end";

function withShift(day: LeaveDayDraft, shift: LeaveShift): LeaveDayDraft {
  const range = shiftRange(day.windows, shift);
  return { ...day, shift, start: range.start, end: range.end };
}

/**
 * The days picked in "Đăng ký nghỉ": each one carries its own shift and hours,
 * kept in date order so the right-hand list reads like the calendar.
 */
export function useLeaveDraft(resolveWindows: (date: string) => ShiftWindows) {
  const [days, setDays] = useState<LeaveDayDraft[]>([]);

  const toggleDate = useCallback(
    (date: string) => {
      setDays((prev) => {
        if (prev.some((d) => d.date === date)) return prev.filter((d) => d.date !== date);
        const windows = resolveWindows(date);
        const added: LeaveDayDraft = { date, windows, shift: null, ...windows.morning };
        return [...prev, added].sort((a, b) => a.date.localeCompare(b.date));
      });
    },
    [resolveWindows],
  );

  const removeDate = useCallback((date: string) => {
    setDays((prev) => prev.filter((d) => d.date !== date));
  }, []);

  const setShift = useCallback((date: string, shift: LeaveShift) => {
    setDays((prev) => prev.map((d) => (d.date === date ? withShift(d, shift) : d)));
  }, []);

  const applyShiftToAll = useCallback((shift: LeaveShift) => {
    setDays((prev) => prev.map((d) => withShift(d, shift)));
  }, []);

  const setTime = useCallback((date: string, field: TimeField, value: string) => {
    setDays((prev) => prev.map((d) => (d.date === date ? { ...d, [field]: value } : d)));
  }, []);

  const summary = useMemo(() => {
    const isComplete = days.length > 0 && days.every((d) => leaveDayError(d) === null);
    const totalMinutes = days
      .filter((d) => d.shift !== null)
      .reduce((sum, d) => sum + leaveMinutes(d), 0);
    return { isComplete, totalMinutes };
  }, [days]);

  return {
    days,
    isComplete: summary.isComplete,
    totalMinutes: summary.totalMinutes,
    toggleDate,
    removeDate,
    setShift,
    applyShiftToAll,
    setTime,
  };
}
