import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { OFF, setDayOff, type OffMark } from "./fixtures/lichNghi";
import {
  call,
  clinicToday,
  createRunStaff,
  deleteStaff,
  firstBranchId,
  type RunStaff,
} from "./fixtures/timekeepingStaff";

/**
 * Feature F-90 / R-1210 (owner 2026-11-11): the board is "Lịch nghỉ" — S / C /
 * SC mark nghỉ sáng / nghỉ chiều / nghỉ cả ngày, a day with no mark is a
 * working day at any hour. It replaces R-1189's switch-off (TEMP-DAYOFF-FILTER-OFF):
 *  - the doctor pickers (Staff AvailableOn) leave out only a doctor off all day;
 *    one off for half a day is still offered and refused at save;
 *  - "Chọn lịch hẹn tiếp theo" (dentist-work-days) opens what is not off.
 *
 * Real stack, nothing intercepted: four throw-away dentists, the marks saved
 * through the real board API, everything read back through separate requests.
 */

const STAFF = "/api/v1/app/staff";
const APPOINTMENTS = "/api/v1/app/appointments";
const WORK_DAYS = `${APPOINTMENTS}/dentist-work-days`;

interface WorkDay {
  date: string;
  windows: { start: string; end: string }[];
}

/** A day weeks out, so the board still takes marks for it. */
function laterDay(): string {
  const date = new Date(`${clinicToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 30 + Math.floor(Math.random() * 300));
  return date.toISOString().slice(0, 10);
}

/** "08:00-12:00, 13:00-17:00". */
const hours = (day: WorkDay) => day.windows.map((w) => `${w.start.slice(0, 5)}-${w.end.slice(0, 5)}`).join(", ");

/** "YYYY-MM-DD" → the bare DDMMYYYY digits the masked date inputs take. */
async function typeDate(input: Locator, day: string) {
  const [y, m, d] = day.split("-");
  await input.click({ position: { x: 6, y: 8 } });
  await input.pressSequentially(`${d}${m}${y}`);
  await input.press("Enter");
  await expect(input).toHaveValue(`${d}/${m}/${y}`);
}

type Kind = "fullDay" | "morning" | "afternoon" | "free";

const MARKS: Record<Kind, OffMark> = {
  fullDay: OFF.FullDay,
  morning: OFF.Morning,
  afternoon: OFF.Afternoon,
  free: OFF.None,
};

test.describe("Lịch nghỉ — bác sĩ nghỉ cả ngày bị ẩn, nghỉ nửa ngày vẫn hiện", () => {
  let branchId: string;
  let day: string;
  const doctors = {} as Record<Kind, RunStaff & { name: string }>;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    branchId = await firstBranchId(page);
    day = laterDay();
    const run = `${runId()}${test.info().workerIndex}`;
    for (const kind of Object.keys(MARKS) as Kind[]) {
      const name = `BSLN${kind}${run}`;
      const staff = await createRunStaff(page, branchId, `ln${kind.slice(0, 2)}${run}`, { name, isDentist: true });
      doctors[kind] = { ...staff, name };
      if (MARKS[kind] !== OFF.None) await setDayOff(page, branchId, staff.id, day, MARKS[kind]);
    }
  });

  test.afterEach(async ({ page }) => {
    for (const d of Object.values(doctors)) await deleteStaff(page, d.id);
  });

  async function workDay(page: Page, dentistId: string): Promise<WorkDay> {
    const res = await call<WorkDay[]>(page, `${WORK_DAYS}?dentistId=${dentistId}&fromDate=${day}&toDate=${day}`, { branchId });
    expect(res.status, JSON.stringify(res.body.error)).toBe(200);
    return res.body[0];
  }

  test("API: the pickers leave out nghỉ cả ngày only, and the work days open what is not off", async ({ page }) => {
    const listed = await call<{ items: { id: string }[] }>(page, `${STAFF}?MaxResultCount=1000&AvailableOn=${day}`, { branchId });
    expect(listed.status).toBe(200);
    const ids = listed.body.items.map((s) => s.id);
    expect(ids, "nghỉ cả ngày is left out").not.toContain(doctors.fullDay.id);
    for (const kind of ["morning", "afternoon", "free"] as const) expect(ids, `${kind} listed`).toContain(doctors[kind].id);

    // The marks are for that day only.
    const dayAfter = new Date(`${day}T00:00:00Z`);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    const next = await call<{ items: { id: string }[] }>(
      page, `${STAFF}?MaxResultCount=1000&AvailableOn=${dayAfter.toISOString().slice(0, 10)}`, { branchId },
    );
    expect(next.body.items.map((s) => s.id)).toContain(doctors.fullDay.id);

    expect(hours(await workDay(page, doctors.fullDay.id))).toBe("");
    expect(hours(await workDay(page, doctors.morning.id))).toBe("13:00-17:00");
    expect(hours(await workDay(page, doctors.afternoon.id))).toBe("08:00-12:00");
    expect(hours(await workDay(page, doctors.free.id))).toBe("08:00-12:00, 13:00-17:00");
  });

  test("Tạo lịch hẹn: nghỉ cả ngày is not offered that day, nghỉ sáng / nghỉ chiều are", async ({ page }) => {
    await page.goto("/calendar/list");
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await expect(dialog).toBeVisible();

    const listed = page.waitForResponse((res) => res.url().toLowerCase().includes(`availableon=${day}`));
    await typeDate(dialog.getByPlaceholder("Chọn thời điểm"), day);
    expect((await listed).ok()).toBeTruthy();

    const doctorField = dialog.locator(".appt-field").filter({ hasText: /Chọn bác sĩ/ }).first();
    const options = page.locator("#ss-portal-dropdown [role=option]");
    await doctorField.getByRole("combobox").click();
    await expect(options.filter({ hasText: doctors.morning.name })).toHaveCount(1);
    await expect(options.filter({ hasText: doctors.afternoon.name })).toHaveCount(1);
    await expect(options.filter({ hasText: doctors.free.name })).toHaveCount(1);
    await expect(options.filter({ hasText: doctors.fullDay.name })).toHaveCount(0);
  });
});
