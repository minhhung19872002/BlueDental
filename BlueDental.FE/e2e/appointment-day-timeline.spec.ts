import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { DAY_OFF, setOwnDay } from "./fixtures/ownDayOff";
import { call, clinicToday, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";
import { openShiftCovering } from "./fixtures/workShift";

/**
 * Feature: Lịch hẹn khách hàng — view Ngày as a doctor timeline (BA
 * 2026-10-03, turned round 2026-10-16): doctors are columns with a patient
 * count beside the name, time runs 07:00–20:00 top to bottom, a mouse drag
 * only scrolls the board sideways, a doctor registered OFF that day has no
 * column, a cancelled booking is neither drawn nor counted, a "Lịch tạm" with
 * no doctor sits in a last "Chưa chọn bác sĩ" column (walk-ins counted by
 * name), and a booking's colour follows its state.
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
  await expect(page.locator(".dtl-col").first()).toBeVisible();
}

test.describe("Lịch hẹn — view Ngày dạng timeline bác sĩ theo cột", () => {
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

  test("doctors are columns: an OFF doctor has none, a booking sits in its doctor's column, is counted and survives a reload", async ({ page, browser }) => {
    const day = shiftDays(clinicToday(), 6);
    await setOwnDay(browser, off, branchId, day, DAY_OFF);
    const booking = await book(page, branchId, working.id, at(day, "09:00"), at(day, "09:30"));
    bookings.push(booking.id);
    // BA: "đã hủy không hiện ở đây" — a cancelled booking leaves no block.
    const cancelled = await book(page, branchId, working.id, at(day, "10:00"), at(day, "10:30"));
    bookings.push(cancelled.id);
    const cancel = await call(page, `${APPOINTMENTS}/${cancelled.id}/cancel`, { method: "POST", branchId, json: { reason: 1, note: "e2e" } });
    expect(cancel.status, JSON.stringify(cancel.body.error)).toBe(200);

    await openDay(page, day);
    const column = page.locator(".dtl-col").filter({ hasText: workingName });
    await expect(column).toHaveCount(1);
    await expect(page.locator(".dtl-col").filter({ hasText: offName })).toHaveCount(0);

    // The time column shows the viewer's hours (R-977 default 08:00–18:45); the column is headed by the
    // doctor's full name (Tên + Họ, as the staff list returns it) and the
    // patient count — the cancelled booking is not counted.
    await expect(page.locator(".dtl-tick").first()).toHaveText("08:00");
    await expect(page.locator(".dtl-tick").last()).toHaveText("18:45");
    await expect(column.locator(".dtl-name")).toHaveText(working.fullName);
    await expect(column.locator(".dtl-count")).toHaveText("1");

    // Time runs down the column: 09:00 sits straight below 08:00, both under the name.
    const name = await column.locator(".dtl-doc").boundingBox();
    const eight = await column.locator('.dtl-cell[data-time="08:00"]').boundingBox();
    const nine = await column.locator('.dtl-cell[data-time="09:00"]').boundingBox();
    if (!name || !eight || !nine) throw new Error("the doctor's column is not laid out");
    expect(nine.x).toBe(eight.x);
    expect(nine.y).toBeGreaterThan(eight.y);
    expect(eight.y).toBeGreaterThanOrEqual(name.y + name.height - 1);

    const block = column.locator(".dtl-block");
    await expect(block).toHaveCount(1);
    await expect(block).toHaveAttribute("aria-label", new RegExp(booking.patientCode ?? ""));
    await expect(block).toHaveClass(/dtl-block--booked/);

    // The count follows the toolbar search, like the blocks it counts.
    const search = page.locator(".cal-search-field input");
    await search.fill(`khong-co-${runId()}`);
    await expect(block).toHaveCount(0);
    await expect(column.locator(".dtl-count")).toHaveText("0");
    await search.fill("");
    await expect(column.locator(".dtl-count")).toHaveText("1");

    await page.reload();
    await expect(page.locator(".dtl-col").filter({ hasText: workingName }).locator(".dtl-block")).toHaveCount(1);

    // A block opens its booking.
    await page.locator(".dtl-col").filter({ hasText: workingName }).locator(".dtl-block").click();
    await expect(page.getByRole("dialog", { name: "Cập nhật lịch hẹn" })).toBeVisible();
  });

  test("clicking an empty slot opens Tạo lịch hẹn for that doctor and time", async ({ page }) => {
    const day = shiftDays(clinicToday(), 7);
    await openDay(page, day);

    const column = page.locator(".dtl-col").filter({ hasText: workingName });
    await column.locator('.dtl-cell[data-time="08:00"]').click();

    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder("HH:mm")).toHaveValue("08:00");
    await expect(dialog.locator(".appt-field").filter({ hasText: /Chọn bác sĩ|Bác sĩ/ }).first()).toContainText(workingName);
  });

  test("a Lịch tạm with no doctor sits in a last 'Chưa chọn bác sĩ' column, counted by name, whose slots book no one", async ({ page }) => {
    const day = shiftDays(clinicToday(), 9);
    const name = `E2E TAM TL ${runId()}`;
    // The same walk-in twice (case and spacing aside) and a second walk-in: two people.
    const walkIns = [
      { patientName: name, time: "09:00" },
      { patientName: `  ${name.toLowerCase().replace(/ /g, "  ")} `, time: "10:00" },
      { patientName: `${name} B`, time: "11:00" },
    ];
    for (const w of walkIns) {
      const res = await call<Booking>(page, `${APPOINTMENTS}/temp`, {
        method: "POST",
        branchId,
        json: { patientName: w.patientName, branchId, slotStart: at(day, w.time), slotEnd: at(day, `${w.time.slice(0, 2)}:30`) },
      });
      expect(res.status, JSON.stringify(res.body.error)).toBe(200);
      bookings.push(res.body.id);
    }

    await openDay(page, day);
    const column = page.locator(".dtl-col--unassigned");
    await expect(column).toHaveCount(1);
    await expect(column.locator(".dtl-name")).toHaveText("Chưa chọn bác sĩ");
    await expect(column.locator(".dtl-doc")).toHaveAttribute("title", /Lịch tạm chưa gán bác sĩ/);
    // It comes after every doctor.
    await expect(page.locator(".dtl-col").last()).toHaveClass(/dtl-col--unassigned/);
    await expect(column.locator(".dtl-block").filter({ hasText: name })).toHaveCount(3);
    // Only this run's walk-ins can sit here on a day this far out; they are two people.
    await expect(column.locator(".dtl-count")).toHaveText("2");

    // An empty slot there has no doctor to book for: nothing opens.
    await column.locator('.dtl-cell[data-time="15:00"]').click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // A block still opens its booking, to put a doctor on it.
    await column.locator(".dtl-block").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("a mouse drag scrolls the board sideways and moves no booking", async ({ page }) => {
    const day = shiftDays(clinicToday(), 8);
    const booking = await book(page, branchId, working.id, at(day, "09:00"), at(day, "09:30"));
    bookings.push(booking.id);
    // Narrow enough that the branch's doctor columns overflow the board.
    await page.setViewportSize({ width: 1000, height: 900 });
    await openDay(page, day);

    const board = page.locator(".dtl-scroll");
    await expect(board).toHaveClass(/has-horizontal-scroll/);
    expect(await board.evaluate((el) => el.scrollLeft)).toBe(0);

    // The leftmost column has the whole board to its right to scroll into.
    const cell = page.locator(".dtl-col").first().locator('.dtl-cell[data-time="12:00"]');
    // Time runs down the board: bring 12:00 up before pressing on it.
    await cell.scrollIntoViewIfNeeded();
    // Bringing it up may nudge the board a few pixels sideways; measure from there.
    const before = await board.evaluate((el) => el.scrollLeft);
    const room = await board.evaluate((el) => el.scrollWidth - el.clientWidth);
    const box = await cell.boundingBox();
    if (!box) throw new Error("the 12:00 slot is not on screen");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 500, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect.poll(() => board.evaluate((el) => el.scrollLeft)).toBeGreaterThanOrEqual(Math.min(before + 300, room));
    expect(room - before, "the board should have room to scroll sideways").toBeGreaterThan(100);
    // Letting go over a slot does not open the create dialog...
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // ...and the booking is where it was.
    const stored = await call<Booking>(page, `${APPOINTMENTS}/${booking.id}`, { branchId });
    expect(new Date(stored.body.slotStart).toISOString()).toBe(new Date(booking.slotStart).toISOString());
  });

  test("today: the now line and its badge move exactly when the clock turns a minute", async ({ page }) => {
    // Ten seconds before a minute turns, on today's real date (the board's data stays real).
    const start = new Date();
    if (start.getSeconds() >= 45) start.setMinutes(start.getMinutes() + 1);
    start.setSeconds(50, 0);
    test.skip(start.getHours() < 7 || start.getHours() >= 19, "outside the board's working hours");
    await page.clock.install({ time: start });
    await openDay(page, clinicToday());

    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const next = new Date(start.getTime() + 10_000);
    const badge = page.locator(".dtl-now-badge");
    const line = page.locator(".dtl-now-line");
    await expect(badge).toHaveText(hhmm(start));
    const before = await line.boundingBox();

    // Still inside the minute: nothing moves.
    await page.clock.runFor(8_000);
    await expect(badge).toHaveText(hhmm(start));

    // The minute turns: badge and line follow at once, no 30-second lag.
    await page.clock.runFor(3_000);
    await expect(badge).toHaveText(hhmm(next));
    const after = await line.boundingBox();
    if (!before || !after) throw new Error("the now line is not drawn");
    expect(after.y).toBeGreaterThan(before.y);
  });

  test("today: a checked-in patient is waiting, a started visit is in progress, and now is marked", async ({ page }) => {
    const start = new Date(Date.now() + 5 * 60_000);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);
    const clinicDayOfEnd = new Date(end.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
    test.skip(clinicDayOfEnd !== clinicToday(), "too close to midnight to book a visit for today");
    expect(await openShiftCovering(page, branchId, working.id, start, end), "the run's dentist should be on shift then").toBe(true);
    const booking = await book(page, branchId, working.id, start.toISOString(), end.toISOString());
    bookings.push(booking.id);

    const checkIn = await call(page, `${APPOINTMENTS}/${booking.id}/check-in`, { method: "POST", branchId });
    expect(checkIn.status, JSON.stringify(checkIn.body.error)).toBe(200);
    await openDay(page, clinicToday());
    const block = page.locator(".dtl-col").filter({ hasText: workingName }).locator(".dtl-block");
    await expect(block).toHaveClass(/dtl-block--waiting/);
    await expect(page.locator(".dtl-now-line")).toHaveCount(1);
    await expect(page.locator(".dtl-now-badge")).toBeVisible();

    const started = await call(page, `${APPOINTMENTS}/${booking.id}/start`, { method: "POST", branchId, json: {} });
    expect(started.status, JSON.stringify(started.body.error)).toBe(200);
    await page.reload();
    await expect(page.locator(".dtl-col").filter({ hasText: workingName }).locator(".dtl-block")).toHaveClass(/dtl-block--inProgress/);
  });
});
