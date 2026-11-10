import { useCallback, useEffect, useRef, type MouseEvent } from "react";
import { WORK_SCHEDULE_SHIFT } from "../api/workScheduleApi";
import type { ScheduleDay, ScheduleMemberVm } from "../types/workSchedule";
import type { BrushShift } from "../utils/workScheduleShift";
import type { ScheduleDraft } from "./useScheduleDraft";

type StrokeMode = "set" | "erase" | "revert";

export type PaintBlock = "locked" | "forbidden";

export interface SchedulePaint {
  onMouseDown: (member: ScheduleMemberVm, day: ScheduleDay, event: MouseEvent) => void;
  onMouseEnter: (member: ScheduleMemberVm, day: ScheduleDay) => void;
  /** Keyboard activation (Enter / Space) — a click with no pointer. */
  onClick: (member: ScheduleMemberVm, day: ScheduleDay, event: MouseEvent) => void;
}

const blockOf = (member: ScheduleMemberVm, day: ScheduleDay): PaintBlock | null => {
  if (day.locked) return "locked";
  return member.canEdit ? null : "forbidden";
};

/**
 * Click-and-drag painting with the chosen brush (prototype P0911): the first
 * cell decides the stroke — a different shift paints, the same saved shift
 * erases it, the same unsaved shift is taken back — and every cell the mouse
 * then passes over gets the same treatment. Today, past days and people the
 * user may not edit are skipped; pressing on one says why.
 */
export function useSchedulePaint(
  draft: ScheduleDraft,
  brush: BrushShift,
  onBlocked: (reason: PaintBlock) => void,
): SchedulePaint {
  const stroke = useRef<StrokeMode | null>(null);

  useEffect(() => {
    const end = () => {
      stroke.current = null;
    };
    window.addEventListener("mouseup", end);
    return () => window.removeEventListener("mouseup", end);
  }, []);

  const apply = useCallback(
    (mode: StrokeMode, member: ScheduleMemberVm, day: ScheduleDay) => {
      if (mode === "revert") draft.revert(member.staffId, day.date);
      else draft.setShift(member, day.date, mode === "erase" ? WORK_SCHEDULE_SHIFT.None : brush);
    },
    [draft, brush],
  );

  const begin = useCallback(
    (member: ScheduleMemberVm, day: ScheduleDay) => {
      const block = blockOf(member, day);
      if (block) {
        stroke.current = null;
        onBlocked(block);
        return;
      }
      let mode: StrokeMode = "set";
      if (draft.shiftOf(member, day.date) === brush) {
        mode = draft.isPending(member.staffId, day.date) ? "revert" : "erase";
      }
      stroke.current = mode;
      apply(mode, member, day);
    },
    [apply, brush, draft, onBlocked],
  );

  const onMouseDown = useCallback(
    (member: ScheduleMemberVm, day: ScheduleDay, event: MouseEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      begin(member, day);
    },
    [begin],
  );

  const onMouseEnter = useCallback(
    (member: ScheduleMemberVm, day: ScheduleDay) => {
      const mode = stroke.current;
      if (!mode || blockOf(member, day)) return;
      apply(mode, member, day);
    },
    [apply],
  );

  const onClick = useCallback(
    (member: ScheduleMemberVm, day: ScheduleDay, event: MouseEvent) => {
      if (event.detail !== 0) return;
      begin(member, day);
      stroke.current = null;
    },
    [begin],
  );

  return { onMouseDown, onMouseEnter, onClick };
}
