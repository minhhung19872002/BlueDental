import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { DAY_OFF, setOwnDay } from "./fixtures/ownDayOff";
import {
  call,
  clinicToday,
  createRunStaff,
  deleteStaff,
  firstBranchId,
  type RunStaff,
} from "./fixtures/timekeepingStaff";

/**
 * Feature R-1189 (BA 2026-11-10, TEMP-DAYOFF-FILTER-OFF): "bỏ logic filter bác
 * sĩ nghỉ ở dropdown" — while the BA rewrites who counts as off, a day off, a
 * shift signed up on the Lịch làm việc board and the working hours no longer
 * hide a doctor from the pickers nor refuse a booking. Only the overlap checks
 * remain.
 *
 * Real stack, nothing intercepted: the day off is written by the doctor through
 * the real bulk-register endpoint, the morning-only shift through the real
 * board save, the bookings through the real appointments API and read back.
 */

const STAFF = "/api/v1/app/staff";
const APPOINTMENTS = "/api/v1/app/appointments";
const WORK_DAYS = `${APPOINTMENTS}/dentist-work-days`;
const BOARD_SAVE = "/api/v1/app/work-schedules/save";
const MORNING_ONLY = 1;

interface Booking {
  id: string;
  slotStart: string;
}

interface WorkDay {
  date: string;
  windows: { start: string; end: string }[];
}

/** A day weeks out, so neither run doctor nor the patient has it booked. */
function laterDay(): string {
  const date = new Date(`${clinicToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 30 + Math.floor(Math.random() * 300));
  return date.toISOString().slice(0, 10);
}

/** A clinic-time (UTC+7) wall clock on `day` as an ISO instant. */
function at(day: string, time: string): string {
  return new Date(`${day}T${time}:00+07:00`).toISOString();
}

/** "YYYY-MM-DD" → the bare DDMMYYYY digits the masked date inputs take. */
async function typeDate(input: Locator, day: string) {
  const [y, m, d] = day.split("-");
  await input.click({ position: { x: 6, y: 8 } });
  await input.pressSequentially(`${d}${m}${y}`);
  await input.press("Enter");
  await expect(input).toHaveValue(`${d}/${m}/${y}`);
}

async function firstPatientId(page: Page, branchId: string): Promise<string> {
  const res = await call<{ items: { id: string }[] }>(
    page, `/api/v1/app/patients?MaxResultCount=1&ClinicBranchId=${branchId}`, { branchId },
  );
  expect(res.body.items.length, "the branch needs a patient").toBeGreaterThan(0);
  return res.body.items[0].id;
}

test.describe("R-1189 — bác sĩ nghỉ / đăng ký ca không còn bị lọc hay chặn", () => {
  let branchId: string;
  let patientId: string;
  let off: RunStaff & { userName: string };
  let morning: RunStaff;
  let offName: string;
  let day: string;
  const bookings: string[] = [];

  test.beforeEach(async ({ page, browser }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    branchId = await firstBranchId(page);
    patientId = await firstPatientId(page, branchId);
    const run = `${runId()}${test.info().workerIndex}`;
    offName = `BSNghi${run}`;
    const created = await createRunStaff(page, branchId, `off${run}`, { name: offName, isDentist: true, roleNames: ["admin"] });
    off = { ...created, userName: `tk-e2e-off${run}` };
    morning = await createRunStaff(page, branchId, `s${run}`, { name: `BSSang${run}`, isDentist: true });

    day = laterDay();
    await setOwnDay(browser, off, branchId, day, DAY_OFF);
    const signed = await call(page, BOARD_SAVE, {
      method: "POST",
      branchId,
      json: { items: [{ staffId: morning.id, workDate: day, shift: MORNING_ONLY }] },
    });
    expect(signed.status, `board save (${JSON.stringify(signed.body.error)})`).toBe(200);
  });

  test.afterEach(async ({ page }) => {
    for (const id of bookings.splice(0)) await call(page, `${APPOINTMENTS}/${id}`, { method: "DELETE", branchId });
    for (const s of [off, morning]) if (s) await deleteStaff(page, s.id);
  });

  function book(page: Page, dentistId: string, from: string, to: string) {
    return call<Booking>(page, APPOINTMENTS, {
      method: "POST",
      branchId,
      json: {
        patientId, dentistId, branchId, type: 2,
        slotStart: at(day, from), slotEnd: at(day, to), chiefComplaint: `e2e-r1189-${runId()}`,
      },
    });
  }

  test("API: both doctors stay listed that day, and book at any hour — outside the shift, on the day off", async ({ page }) => {
    const listed = await call<{ items: { id: string }[] }>(
      page, `${STAFF}?MaxResultCount=1000&AvailableOn=${day}`, { branchId },
    );
    expect(listed.status).toBe(200);
    const ids = listed.body.items.map((s) => s.id);
    expect(ids, "OFF doctor still listed").toContain(off.id);
    expect(ids, "morning-only doctor listed").toContain(morning.id);

    // Off doctor in the evening, morning-only doctor in the afternoon: both used to be refused.
    const cases: [string, string, string][] = [
      [off.id, "09:00", "09:30"],
      [off.id, "20:00", "20:30"],
      [morning.id, "15:00", "15:30"],
    ];
    for (const [dentistId, from, to] of cases) {
      const res = await book(page, dentistId, from, to);
      expect(res.status, `${from}-${to}: ${JSON.stringify(res.body.error)}`).toBe(200);
      bookings.push(res.body.id);
      // Read back through a separate request: stored at the time asked.
      const stored = await call<Booking>(page, `${APPOINTMENTS}/${res.body.id}`, { branchId });
      expect(new Date(stored.body.slotStart).toISOString()).toBe(at(day, from));
    }

    // "Chọn lịch hẹn tiếp theo" opens the whole planned day for both.
    for (const id of [off.id, morning.id]) {
      const work = await call<WorkDay[]>(page, `${WORK_DAYS}?dentistId=${id}&fromDate=${day}&toDate=${day}`, { branchId });
      expect(work.status, JSON.stringify(work.body.error)).toBe(200);
      expect(work.body[0].windows.length, "a day off / half day leaves the whole day open").toBeGreaterThanOrEqual(1);
      expect(work.body[0].windows[work.body[0].windows.length - 1].end >= "17:00").toBeTruthy();
    }
  });

  test("Tạo lịch hẹn: a doctor OFF that day is offered and picked with no day-off error", async ({ page }) => {
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
    await expect(options.filter({ hasText: offName })).toHaveCount(1);
    await options.filter({ hasText: offName }).click();
    await expect(doctorField).toContainText(offName);
    await expect(doctorField).not.toContainText("Bác sĩ nghỉ vào ngày này");
  });
});
