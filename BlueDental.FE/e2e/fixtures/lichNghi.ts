import { expect, type Page } from "@playwright/test";
import { call } from "./timekeepingStaff";

/** The Lịch nghỉ board's marks (F-90, R-1210): what part of the day is off. */
export const OFF = { None: 0, Morning: 1, Afternoon: 2, FullDay: 3 } as const;
export type OffMark = (typeof OFF)[keyof typeof OFF];

const BOARD_SAVE = "/api/v1/app/work-schedules/save";

/**
 * Marks `staffId` off on `workDate` through the real board save, as a manager
 * does on Lịch nghỉ: S nghỉ sáng, C nghỉ chiều, SC nghỉ cả ngày, None clears it.
 * Today and earlier days are locked on the board, so `workDate` must be later.
 */
export async function setDayOff(
  page: Page,
  branchId: string,
  staffId: string,
  workDate: string,
  shift: OffMark,
): Promise<void> {
  const res = await call(page, BOARD_SAVE, {
    method: "POST",
    branchId,
    json: { items: [{ staffId, workDate, shift }] },
  });
  expect(res.status, `Lịch nghỉ save (${JSON.stringify(res.body.error)})`).toBe(200);
}
