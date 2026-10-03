import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { DAY_OFF, setOwnDay } from "./fixtures/ownDayOff";
import { call, clinicToday, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * Feature: Lịch hẹn khách hàng — view Ngày as a horizontal doctor timeline
 * (BA 2026-10-03): doctors are rows, time runs 07:00–20:00 left to right,
 * a mouse drag only scrolls the board sideways, a doctor registered OFF that
 * day has no row, a cancelled booking is not drawn, and a booking's colour
 * follows its state.
 *
 * Real stack: the run's dentists and bookings are written through the real
 * API, the OFF doctor marks their own day off signed in as themselves, and the
 * board reads the real `/appointments` and `/staff` lists. Nothing is
 * intercepted.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

interface Booking {
  id: string;
  slotStart: string;
  patientCode: string | null;
}

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A clinic-time (UTC+7) wall clock on `day` as an ISO instant. */
function at(day: string, time: string): string {
  return new Date(`${day}T${time}:00+07:00`).toISOString();
}

/** The branch the calendar is showing, read off its own request. */
async function openCalendarBranch(page: Page): Promise<string> {
  const request = page.waitForRequest(
    (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto("/calendar");
  return (await request).headers()["x-clinic-branch-id"];
}

/** Books `dentistId` with the first patient the server accepts at that time. */
async function book(page: Page, branchId: string, dentistId: string, slotStart: string, slotEnd: string): Promise<Booking> {
  const patients = await call<{ items: { id: string; patientCode: string | null }[] }>(
    page, `/api/v1/app/patients?MaxResultCount=50&ClinicBranchId=${branchId}`, { branchId },
  );
  let lastError: unknown;
  for (const patient of patients.body.items.filter((p) => p.patientCode)) {
    const res = await call<Booking>(page, APPOINTMENTS, {
      method: "POST",
      branchId,
      json: { patientId: patient.id, dentistId, branchId, slotStart, slotEnd, type: 2, chiefComplaint: `e2e-timeline-${runId()}` },
    });
    if (res.status === 200) return res.body;
    lastError = res.body.error;
  }
  throw new Error(`no booking could be made: ${JSON.stringify(lastError)}`);
}

/** Opens view Ngày on `day` and waits for that day's bookings to arrive. */
async function openDay(page: Page, day: string): Promise<void> {
  const loaded = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${day}`) && r.ok());
  await page.goto(`/calendar?date=${day}`);
  await loaded;
  await expect(page.locator(".dtl-row").first()).toBeVisible();
}

test.describe("Lịch hẹn — view Ngày dạng timeline ngang", () => {
  let branchId: string;
  let working: RunStaff;
  let off: RunStaff & { userName: string };
  let workingName: string;
  let offName: string;
  const bookings: string[] = [];

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    branchId = await openCalendarBranch(page);
    const run = `${runId()}${test.info().workerIndex}`;
    workingName = `BSTimeline${run}`;
    offName = `BSNghiTL${run}`;
    working = await createRunStaff(page, branchId, `tlon${run}`, { name: workingName, isDentist: true });
    const created = await createRunStaff(page, branchId, `tloff${run}`, { name: offName, isDentist: true, roleNames: ["admin"] });
    off = { ...created, userName: `tk-e2e-tloff${run}` };
  });

  test.afterEach(async ({ page }) => {
    for (const id of bookings.splice(0)) await call(page, `${APPOINTMENTS}/${id}`, { method: "DELETE", branchId });
    for (const s of [working, off]) if (s) await deleteStaff(page, s.id);
  });

  test("doctors are rows: an OFF doctor has none, a booking sits in its doctor's row and survives a reload", async ({ page, browser }) => {
    const day = shiftDays(clinicToday(), 6);
    await setOwnDay(browser, off, branchId, day, DAY_OFF);
    const booking = await book(page, branchId, working.id, at(day, "09:00"), at(day, "09:30"));
    bookings.push(booking.id);
    // BA: "đã hủy không hiện ở đây" — a cancelled booking leaves no block.
    const cancelled = await book(page, branchId, working.id, at(day, "10:00"), at(day, "10:30"));
    bookings.push(cancelled.id);
    const cancel = await call(page, `${APPOINTMENTS}/${cancelled.id}/cancel`, { method: "POST", branchId, json: { reason: 1 } });
    expect(cancel.status, JSON.stringify(cancel.body.error)).toBe(200);

    await openDay(page, day);
    const row = page.locator(".dtl-row").filter({ hasText: workingName });
    await expect(row).toHaveCount(1);
    await expect(page.locator(".dtl-row").filter({ hasText: offName })).toHaveCount(0);

    // The header keeps the working hours; nothing else rides on the name.
    await expect(page.locator(".dtl-tick").first()).toHaveText("07:00");
    await expect(page.locator(".dtl-tick").last()).toHaveText("19:30");
    await expect(row.locator(".dtl-name")).toHaveText(workingName);

    const block = row.locator(".dtl-block");
    await expect(block).toHaveCount(1);
    await expect(block).toHaveAttribute("aria-label", new RegExp(booking.patientCode ?? ""));
    await expect(block).toHaveClass(/dtl-block--booked/);

    await page.reload();
    await expect(page.locator(".dtl-row").filter({ hasText: workingName }).locator(".dtl-block")).toHaveCount(1);

    // A block opens its booking.
    await page.locator(".dtl-row").filter({ hasText: workingName }).locator(".dtl-block").click();
    await expect(page.getByRole("dialog", { name: "Cập nhật lịch hẹn" })).toBeVisible();
  });

  test("clicking an empty slot opens Tạo lịch hẹn for that doctor and time", async ({ page }) => {
    const day = shiftDays(clinicToday(), 7);
    await openDay(page, day);

    const row = page.locator(".dtl-row").filter({ hasText: workingName });
    await row.locator('.dtl-cell[data-time="08:00"]').click();

    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder("HH:mm")).toHaveValue("08:00");
    await expect(dialog.locator(".appt-field").filter({ hasText: /Chọn bác sĩ|Bác sĩ/ }).first()).toContainText(workingName);
  });

  test("a mouse drag scrolls the board sideways and moves no booking", async ({ page }) => {
    const day = shiftDays(clinicToday(), 8);
    const booking = await book(page, branchId, working.id, at(day, "09:00"), at(day, "09:30"));
    bookings.push(booking.id);
    await openDay(page, day);

    const board = page.locator(".dtl-scroll");
    await expect(board).toHaveClass(/has-horizontal-scroll/);
    expect(await board.evaluate((el) => el.scrollLeft)).toBe(0);

    const cell = page.locator(".dtl-row").filter({ hasText: workingName }).locator('.dtl-cell[data-time="12:00"]');
    const box = await cell.boundingBox();
    if (!box) throw new Error("the 12:00 slot is not on screen");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 500, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect.poll(() => board.evaluate((el) => el.scrollLeft)).toBeGreaterThan(300);
    // Letting go over a slot does not open the create dialog...
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // ...and the booking is where it was.
    const stored = await call<Booking>(page, `${APPOINTMENTS}/${booking.id}`, { branchId });
    expect(new Date(stored.body.slotStart).toISOString()).toBe(new Date(booking.slotStart).toISOString());
  });

  test("today: a checked-in patient is waiting, a started visit is in progress, and now is marked", async ({ page }) => {
    const start = new Date(Date.now() + 5 * 60_000);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);
    const clinicDayOfEnd = new Date(end.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
    test.skip(clinicDayOfEnd !== clinicToday(), "too close to midnight to book a visit for today");
    const booking = await book(page, branchId, working.id, start.toISOString(), end.toISOString());
    bookings.push(booking.id);

    const checkIn = await call(page, `${APPOINTMENTS}/${booking.id}/check-in`, { method: "POST", branchId });
    expect(checkIn.status, JSON.stringify(checkIn.body.error)).toBe(200);
    await openDay(page, clinicToday());
    const block = page.locator(".dtl-row").filter({ hasText: workingName }).locator(".dtl-block");
    await expect(block).toHaveClass(/dtl-block--waiting/);
    await expect(page.locator(".dtl-now-line")).toHaveCount(1);
    await expect(page.locator(".dtl-now-badge")).toBeVisible();

    const started = await call(page, `${APPOINTMENTS}/${booking.id}/start`, { method: "POST", branchId, json: {} });
    expect(started.status, JSON.stringify(started.body.error)).toBe(200);
    await page.reload();
    await expect(page.locator(".dtl-row").filter({ hasText: workingName }).locator(".dtl-block")).toHaveClass(/dtl-block--inProgress/);
  });
});
