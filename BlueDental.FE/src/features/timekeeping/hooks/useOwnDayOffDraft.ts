import { useCallback, useMemo, useState } from "react";

import type { CellKind } from "../components/WorkScheduleCell";
import {
  LEAVE_SHIFT,
  WORK_REGISTRATION,
  type BulkRegisterItem,
  type TimeKeepingRecordDto,
  type WorkRegistration,
} from "../api/timekeepingApi";

interface Options {
  records: TimeKeepingRecordDto[] | undefined;
  staffCreationDates: Map<string, string>;
  today: string;
  currentUserId: string | undefined;
  canUpdate: boolean;
}

const cellKey = (staffId: string, dateStr: string) => `${staffId}:${dateStr}`;

const hasAttendance = (record: TimeKeepingRecordDto | undefined) =>
  !!(record?.morningShift?.checkedInAt || record?.afternoonShift?.checkedInAt);

/**
 * Unsaved day-off (X) edits on the work schedule grid. A staff member may only
 * mark or clear X on their own row, on a day that has not passed, has not been
 * clocked in and is not planned as working (L) — every role, admin included
 * (BA 2026-10-02). V / L cells are never touched. The server enforces the same.
 */
export function useOwnDayOffDraft({ records, staffCreationDates, today, currentUserId, canUpdate }: Options) {
  const [draft, setDraft] = useState<Map<string, WorkRegistration>>(new Map());

  const lookup = useMemo(() => {
    const map = new Map<string, TimeKeepingRecordDto>();
    for (const r of records ?? []) map.set(cellKey(r.staffId, r.workDate), r);
    return map;
  }, [records]);

  const isCellEditable = useCallback(
    (staffId: string, dateStr: string) => {
      if (!canUpdate || staffId !== currentUserId || dateStr < today) return false;
      const record = lookup.get(cellKey(staffId, dateStr));
      return !hasAttendance(record) && record?.registration !== WORK_REGISTRATION.Working;
    },
    [canUpdate, currentUserId, today, lookup],
  );

  // V / L / X marking: a past day shows what happened, a later day what is planned.
  const getCellKind = useCallback(
    (staffId: string, dateStr: string): CellKind => {
      const key = cellKey(staffId, dateStr);
      const record = lookup.get(key);
      const registration = draft.get(key) ?? record?.registration ?? WORK_REGISTRATION.NotRegistered;

      // A half-day leave ("Đăng ký nghỉ") keeps the other half worked — "Làm nửa buổi".
      if (record?.leaveShift === LEAVE_SHIFT.Morning) return "half-afternoon";
      if (record?.leaveShift === LEAVE_SHIFT.Afternoon) return "half-morning";
      if (hasAttendance(record) || registration === WORK_REGISTRATION.Working) return "working";
      if (registration === WORK_REGISTRATION.DayOff) return "day-off";
      if (dateStr >= today) return "empty-future";

      const createdAt = staffCreationDates.get(staffId);
      if (createdAt && dateStr < createdAt) return "empty-past";
      return "vang";
    },
    [lookup, draft, today, staffCreationDates],
  );

  const toggleCell = useCallback(
    (staffId: string, dateStr: string) => {
      if (!isCellEditable(staffId, dateStr)) return;
      const key = cellKey(staffId, dateStr);
      const saved = lookup.get(key)?.registration ?? WORK_REGISTRATION.NotRegistered;
      setDraft((prev) => {
        const current = prev.get(key) ?? saved;
        const next = current === WORK_REGISTRATION.DayOff
          ? WORK_REGISTRATION.NotRegistered
          : WORK_REGISTRATION.DayOff;
        const updated = new Map(prev);
        if (next === saved) updated.delete(key);
        else updated.set(key, next);
        return updated;
      });
    },
    [isCellEditable, lookup],
  );

  const items = useMemo<BulkRegisterItem[]>(
    () =>
      Array.from(draft, ([key, registration]) => {
        const [staffId, workDate] = key.split(":");
        return { staffId, workDate, registration };
      }),
    [draft],
  );

  const reset = useCallback(() => setDraft(new Map()), []);

  return { getCellKind, isCellEditable, toggleCell, items, hasChanges: draft.size > 0, reset };
}
