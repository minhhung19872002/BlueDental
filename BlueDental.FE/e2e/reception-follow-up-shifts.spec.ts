import { expect, test, type Locator } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import { OFF, setDayOff } from "./fixtures/lichNghi";
import { call, createRunStaff, deleteStaff, firstBranchId, type RunStaff } from "./fixtures/timekeepingStaff";
import { bookVisitToday, cardOf } from "./fixtures/receptionBoard";

/**
 * Feature: "Chọn lịch hẹn tiếp theo" draws the doctor's working day, read
 * from GET /appointments/dentist-work-days — the rule booking itself applies
 * (DentistShiftChecker, R-1210): the profile hours, less what the doctor is
 * registered off on the Lịch nghỉ board — nghỉ cả ngày takes the whole day,
 * nghỉ sáng the morning.
 *
 * Each run makes a throw-away dentist with its own profile hours, marked off
 * all of next month's 10th and the morning of the 12th through the real board
 * save. Real stack, nothing intercepted.
 */

const WORK_DAYS = "/api/v1/app/appointments/dentist-work-days";

interface ShiftWindow {
  start: string;
  end: string;
}

interface WorkDay {
  date: string;
  morning: ShiftWindow;
  afternoon: ShiftWindow;
  windows: ShiftWindow[];
}

/** Next month's `day`, so every day of it can still be marked on the board. */
function nextMonth(day: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setDate(day);
  return d;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const vn = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const DAY_OFF = nextMonth(10);
const MORNING_OFF = nextMonth(12);
const PLAIN_DAY = nextMonth(11);

/** "07:30-11:30, 13:30-18:00". */
const hours = (windows: ShiftWindow[]) => windows.map((w) => `${w.start.slice(0, 5)}-${w.end.slice(0, 5)}`).join(", ");

const workDaysUrl = (dentistId: string, from: Date, to: Date) =>
  `${WORK_DAYS}?dentistId=${dentistId}&fromDate=${iso(from)}&toDate=${iso(to)}`;

test.describe("Chọn lịch hẹn tiếp theo — Lịch nghỉ của bác sĩ", () => {
  let branchId: string;
  let dentist: RunStaff;
  /** What the doctor pickers call them: the staff record's name. */
  let dentistName: string;

  test.beforeEach(async ({ page }) => {
    await login(page);
    branchId = await firstBranchId(page);
    const run = `${runId()}${test.info().workerIndex}`;
    dentistName = `BS Ca ${run}`;
    dentist = await createRunStaff(page, branchId, `wd${run}`, {
      name: dentistName,
      roleNames: ["admin"],
      isDentist: true,
      morningStartTime: "07:30",
      morningEndTime: "11:30",
      afternoonStartTime: "13:30",
      afternoonEndTime: "18:00",
    });
    await setDayOff(page, branchId, dentist.id, iso(DAY_OFF), OFF.FullDay);
    await setDayOff(page, branchId, dentist.id, iso(MORNING_OFF), OFF.Morning);
  });

  test.afterEach(async ({ page }) => {
    if (dentist) await deleteStaff(page, dentist.id);
  });

  test("the API lays out nghỉ cả ngày, nghỉ sáng and the profile hours, day by day", async ({ page }) => {
    const res = await call<WorkDay[]>(page, workDaysUrl(dentist.id, DAY_OFF, MORNING_OFF), { branchId });
    expect(res.status, JSON.stringify(res.body.error)).toBe(200);
    const [off, plain, morningOff] = res.body;
    expect(res.body.map((d) => d.date)).toEqual([iso(DAY_OFF), iso(PLAIN_DAY), iso(MORNING_OFF)]);

    // Nghỉ cả ngày keeps its planned shifts to draw, with nothing left to book.
    expect(off.windows).toEqual([]);
    expect(off.morning.start).toBeTruthy();
    // Nothing off: the profile hours, not the clinic's 08:00-12:00 / 13:00-17:00.
    expect(hours(plain.windows)).toBe("07:30-11:30, 13:30-18:00");
    expect(hours([plain.morning, plain.afternoon])).toBe("07:30-11:30, 13:30-18:00");
    // Nghỉ sáng leaves the afternoon only.
    expect(hours(morningOff.windows)).toBe("13:30-18:00");
    expect(hours([morningOff.morning])).toBe("07:30-11:30");
  });

  test("the API refuses a range it cannot answer, and strangers", async ({ page, browser }) => {
    const backwards = await call(page, workDaysUrl(dentist.id, MORNING_OFF, DAY_OFF), { branchId });
    expect(backwards.status).toBe(400);
    const far = new Date(DAY_OFF);
    far.setDate(far.getDate() + 62);
    const tooLong = await call(page, workDaysUrl(dentist.id, DAY_OFF, far), { branchId });
    expect(tooLong.status).toBe(400);
    const noDentist = await call(page, `${WORK_DAYS}?fromDate=${iso(DAY_OFF)}&toDate=${iso(MORNING_OFF)}`, { branchId });
    expect(noDentist.status).toBe(400);

    const anonymous = await browser.newPage();
    await anonymous.goto("/login");
    const refused = await call(anonymous, workDaysUrl(dentist.id, DAY_OFF, MORNING_OFF));
    expect(refused.status).toBe(401);
    await anonymous.close();
  });

  // Naming another branch in X-Clinic-Branch-Id is not checked against the
  // account's branches anywhere yet (CurrentClinicBranchResolver) — reported
  // separately, so only the account's own branch is asserted here.
  test("another branch reads its own Lịch nghỉ, not this branch's", async ({ browser }) => {
    const other = await browser.newPage();
    await login(other, BRANCH2_USER);
    const own = await call<WorkDay[]>(other, workDaysUrl(dentist.id, DAY_OFF, DAY_OFF));
    expect(own.status, JSON.stringify(own.body.error)).toBe(200);
    expect(hours(own.body[0].windows)).toBe("07:30-11:30, 13:30-18:00");
    await other.close();
  });

  test("the picker greys out nghỉ cả ngày and the morning of nghỉ sáng, and shows the week's hours", async ({ page }) => {
    await page.goto("/reception");
    const visit = await bookVisitToday(page, branchId, 110, "e2e-ca");
    const card = await cardOf(page, visit);
    await card.locator(".rc-col-actions").getByRole("button", { name: /Đổi lịch hẹn/ }).click();
    const panel = card.getByRole("region", { name: "Chọn lịch hẹn tiếp theo" });

    // Đổi bác sĩ → the run's dentist, found by name.
    await panel.getByRole("button", { name: /Đổi bác sĩ/ }).click();
    const search = page.getByRole("textbox", { name: "Tìm bác sĩ" });
    await search.fill(dentistName);
    await search.press("Enter");
    await expect(panel.locator(".fu-doctor-name")).toContainText(dentistName);

    await showWeekOf(panel, DAY_OFF);
    const dayOff = panel.getByRole("button", { name: `Chọn ngày ${vn(DAY_OFF)} · BS nghỉ` });
    await expect(dayOff).toBeDisabled();
    await expect(panel.locator(".fu-doctor-shift")).toContainText("nghỉ");
    await expect(panel.locator(".fu-doctor-shift")).toContainText("07:30–11:30, 13:30–18:00");

    // Nghỉ sáng: the morning cannot be picked, the afternoon runs 13:30–18:00.
    await panel.getByRole("button", { name: new RegExp(`^Chọn ngày ${vn(MORNING_OFF)}`) }).click();
    await expect(panel.getByRole("button", { name: "Chọn khung giờ Buổi sáng" })).toHaveCount(0);
    await expect(panel.locator(".fu-session-range").first()).toHaveText("Không làm việc");
    await expect(panel.locator(".fu-session-range").nth(1)).toHaveText("13:30 – 18:00");

    const afternoon = panel.getByRole("button", { name: "Chọn khung giờ Buổi chiều" });
    const box = (await afternoon.boundingBox())!;
    const at = (m: number) => ({ x: ((m - 810) / 270) * box.width + 2, y: box.height / 2 });
    await afternoon.click({ position: at(14 * 60) });
    await expect(panel.locator(".fu-time--start")).toHaveText("14:00");
    await expect(panel.locator(".fu-time--end")).toHaveText("14:30");
  });
});

/** Steps the week strip forward until `day` is on it. */
async function showWeekOf(panel: Locator, day: Date) {
  const target = panel.getByRole("button", { name: new RegExp(`^Chọn ngày ${vn(day)}`) });
  for (let i = 0; i < 10 && !(await target.isVisible()); i++) {
    await panel.getByRole("button", { name: "Tuần kế tiếp" }).click();
  }
  await expect(target).toBeVisible();
}
