import type { WorkScheduleBoardDto, WorkScheduleMemberDto, WorkScheduleShift } from "./workScheduleApi";
import type { ScheduleBoardVm, ScheduleGroupVm, ScheduleMemberVm } from "../types/workSchedule";

/** "BS. Đinh Thành Long" → "TL"; one word → its first two letters. */
export function initialsOf(name: string): string {
  const words = name.replace(/^(BS|PT|ThS|TS)\.\s*/i, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[words.length - 2][0] + words[words.length - 1][0]).toUpperCase();
}

function adaptMember(dto: WorkScheduleMemberDto, groupKey: string, colorIndex: number): ScheduleMemberVm {
  const saved = new Map<string, WorkScheduleShift>();
  for (const day of dto.days) saved.set(day.workDate, day.shift);
  return {
    staffId: dto.staffId,
    fullName: dto.fullName,
    roleLabel: dto.roleLabel ?? "",
    isHead: dto.isHead,
    canEdit: dto.canEdit,
    initials: initialsOf(dto.fullName),
    groupKey,
    colorIndex,
    saved,
  };
}

/**
 * The board as the screen uses it: each group keyed (the unassigned group as
 * "none"), a colour slot per group, and each person's saved days as a map.
 */
export function adaptBoard(dto: WorkScheduleBoardDto): ScheduleBoardVm {
  const groups: ScheduleGroupVm[] = dto.groups.map((group, index) => {
    const key = group.unitId ?? "none";
    const colorIndex = index % 5;
    return {
      key,
      name: group.name,
      colorIndex,
      members: group.members.map((m) => adaptMember(m, key, colorIndex)),
    };
  });
  return { year: dto.year, month: dto.month, today: dto.today, groups };
}
