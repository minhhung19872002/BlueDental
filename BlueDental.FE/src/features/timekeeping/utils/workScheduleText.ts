import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type { WorkScheduleShift } from "../api/workScheduleApi";
import type { ScheduleGroupVm } from "../types/workSchedule";
import { SHIFT_LABEL_KEY } from "./workScheduleShift";

/** "CN", "T2" … "T7". */
export const dowShort = (dow: number) => t(`Timekeeping:Board:Dow:${dow}`);

/** "Chủ nhật", "Thứ 2" … "Thứ 7". */
export const dowLong = (dow: number) => t(`Timekeeping:Board:DowLong:${dow}`);

/** "T2 10/11" for a "YYYY-MM-DD" date. */
export function shortDate(date: string): string {
  const d = dayjs(date);
  return `${dowShort(d.day())} ${d.date()}/${d.month() + 1}`;
}

export const shiftLabel = (shift: WorkScheduleShift) => t(SHIFT_LABEL_KEY[shift]);

export const groupName = (group: Pick<ScheduleGroupVm, "name">) =>
  group.name ?? t("Timekeeping:Board:Unassigned");
