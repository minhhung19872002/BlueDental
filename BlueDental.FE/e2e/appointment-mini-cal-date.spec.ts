import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call, clinicToday, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * R-1001 (BA 2026-10-20): moving "Lịch đã hẹn" to another day with its own
 * navigator (‹ › or a day picked in its calendar) moves Ngày hẹn with it, in
 * Tạo / Cập nhật lịch hẹn and in Lịch tạm. Browsing Tuần / Tháng leaves Ngày
 * hẹn alone and Ngày comes back on it; a session clicked while repeating
 * moves only the diary. Real stack: a throw-away dentist, days years out, no
 * interception.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

interface Booking {
  id: string;
  slotStart: string;
}

function farDay(): string {
  const date = new Date(`${clinicToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 400 + Math.floor(Math.random() * 4000));
  return date.toISOString().slice(0, 10);
}

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "2031-04-17" → "17/04/2031". */
function vnDate(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

/** "17/04/2031" → "2031-04-17". */
function isoDate(vn: string): string {
  const [date, month, year] = vn.split("/");
  return `${year}-${month}-${date}`;
}

/** A clinic-time (UTC+7) wall clock on `day` as an ISO instant. */
function at(day: string, time: string): string {
  return new Date(`${day}T${time}:00+07:00`).toISOString();
}

async function openCalendarBranch(page: Page): Promise<string> {
  const request = page.waitForRequest(
    (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto("/calendar/list");
  return (await request).headers()["x-clinic-branch-id"];
}

/** The dialog's Ngày hẹn input. */
function dateField(dialog: Locator): Locator {
  return dialog.locator(".appt-field").filter({ hasText: /^Ngày hẹn/ }).getByPlaceholder("Chọn thời điểm");
}

/** Lịch đã hẹn's own navigator: ‹, the label that opens its calendar, ›. */
function diary(dialog: Locator) {
  const root = dialog.locator(".appt-mini-cal");
  return {
    root,
    prev: root.locator(".date-navigator-arrow").first(),
    next: root.locator(".date-navigator-arrow").last(),
    label: root.locator(".date-navigator-label"),
    mode: (name: string) => root.locator(".ant-segmented-item").filter({ hasText: name }),
  };
}

/** Mask mode: fill() is ignored, so type the digits. */
async function typeDate(dialog: Locator, day: string): Promise<void> {
  const input = dateField(dialog);
  await input.click({ position: { x: 4, y: 8 } });
  await input.pressSequentially(vnDate(day).replace(/\D/g, ""));
  await input.press("Enter");
  await expect(input).toHaveValue(vnDate(day));
}

async function pickOption(page: Page, dialog: Locator, field: RegExp, option?: string): Promise<void> {
  await dialog.locator(".appt-field").filter({ hasText: field }).first().getByRole("combobox").click();
  const options = page.locator("#ss-portal-dropdown [role=option]");
  await (option ? options.filter({ hasText: option }) : options).first().click();
}

/** Books `dentistId` with the first patient the server accepts at that time. */
async function book(page: Page, branchId: string, dentistId: string, day: string, time: string, end: string): Promise<Booking> {
  const patients = await call<{ items: { id: string; patientCode: string | null }[] }>(
    page, `/api/v1/app/patients?MaxResultCount=50&ClinicBranchId=${branchId}`, { branchId },
  );
  let lastError: unknown;
  for (const patient of patients.body.items.filter((p) => p.patientCode)) {
    const res = await call<Booking>(page, APPOINTMENTS, {
      method: "POST",
      branchId,
      json: {
        patientId: patient.id, dentistId, branchId, slotStart: at(day, time), slotEnd: at(day, end), type: 2,
        chiefComplaint: `R-1001 ${runId()}`,
      },
    });
    if (res.status === 200) return res.body;
    lastError = res.body.error;
  }
  throw new Error(`no booking could be made: ${JSON.stringify(lastError)}`);
}

test.describe("Lịch đã hẹn — chuyển ngày thì Ngày hẹn nhảy theo", () => {
  let branchId: string;
  let dentist: RunStaff;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    branchId = await openCalendarBranch(page);
    const run = `${runId()}${test.info().workerIndex}`;
    dentist = await createRunStaff(page, branchId, `md${run}`, { name: `BSNgay${run}`, isDentist: true });
    // Reopened so the dentist picker lists the run's dentist.
    await page.goto("/calendar/list");
    await assertRealApiTraffic(page, APPOINTMENTS);
  });

  test.afterEach(async ({ page }) => {
    const left = await dentistBookings(page);
    for (const booking of left) await call(page, `${APPOINTMENTS}/${booking.id}`, { method: "DELETE", branchId });
    if (dentist) await deleteStaff(page, dentist.id);
  });

  async function dentistBookings(page: Page): Promise<Booking[]> {
    const res = await call<{ items: Booking[] }>(
      page, `${APPOINTMENTS}?DentistId=${dentist.id}&fromDate=2027-01-01&toDate=2045-12-31&MaxResultCount=200`, { branchId },
    );
    expect(res.status).toBe(200);
    return res.body.items;
  }

  test("Tạo lịch hẹn: ‹ › and a picked day move Ngày hẹn, Tuần does not, the booking lands on the day shown", async ({ page }) => {
    const day = farDay();
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    const date = dateField(dialog);
    const nav = diary(dialog);

    await pickOption(page, dialog, /Chọn bệnh nhân/);
    await typeDate(dialog, day);
    await expect(nav.label).toHaveText(vnDate(day));

    // › one day on: the diary reads that day and Ngày hẹn follows.
    const nextRead = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${shiftDays(day, 1)}`) && r.ok());
    await nav.next.click();
    await nextRead;
    await expect(nav.label).toHaveText(vnDate(shiftDays(day, 1)));
    await expect(date).toHaveValue(vnDate(shiftDays(day, 1)));

    // ‹ twice: the day before the one typed.
    await nav.prev.click();
    await nav.prev.click();
    await expect(nav.label).toHaveText(vnDate(shiftDays(day, -1)));
    await expect(date).toHaveValue(vnDate(shiftDays(day, -1)));

    // A day picked in the diary's own calendar.
    const shown = shiftDays(day, -1);
    const pickedDate = shown.endsWith("-15") ? 16 : 15;
    const picked = `${shown.slice(0, 8)}${String(pickedDate).padStart(2, "0")}`;
    await nav.label.click();
    const panel = page.locator(".date-nav-dropdown");
    await panel.locator(".date-nav-day:not(.outside)").filter({ hasText: new RegExp(`^${pickedDate}$`) }).click();
    await expect(panel).toBeHidden();
    await expect(nav.label).toHaveText(vnDate(picked));
    await expect(date).toHaveValue(vnDate(picked));

    // Tuần is a range: browsing it leaves Ngày hẹn, and Ngày comes back on Ngày hẹn.
    await nav.mode("Tuần").click();
    await nav.next.click();
    await nav.next.click();
    await expect(date).toHaveValue(vnDate(picked));
    await nav.mode("Ngày").click();
    await expect(nav.label).toHaveText(vnDate(picked));
    await expect(date).toHaveValue(vnDate(picked));

    // Booked on the day shown, at a slot clicked there.
    await pickOption(page, dialog, /Chọn bác sĩ/, dentist.fullName);
    await dialog.getByPlaceholder("Nội dung đặt lịch").fill(`R-1001 ${runId()}`);
    await dialog.getByRole("button", { name: "Chọn giờ hẹn 10:15" }).click();
    await expect(dialog.getByPlaceholder("HH:mm")).toHaveValue("10:15");
    await expect(date).toHaveValue(vnDate(picked));

    const saved = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    const response = await saved;
    expect(response.status(), await response.text()).toBe(200);
    await expect(dialog).toBeHidden();

    await page.reload();
    const [booking, ...others] = await dentistBookings(page);
    expect(others).toHaveLength(0);
    expect(new Date(booking.slotStart).toISOString()).toBe(at(picked, "10:15"));

    const loaded = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${picked}`) && r.ok());
    await page.goto(`/calendar?date=${picked}`);
    await loaded;
    await expect(page.locator(".dtl-col").filter({ hasText: dentist.fullName }).locator(".dtl-block")).toHaveCount(1);
  });

  test("Cập nhật lịch hẹn: › moves Ngày hẹn and Lưu moves the booking to that day", async ({ page }) => {
    const day = farDay();
    const booking = await book(page, branchId, dentist.id, day, "09:00", "09:30");

    const loaded = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${day}`) && r.ok());
    await page.goto(`/calendar?date=${day}`);
    await loaded;
    await page.locator(".dtl-col").filter({ hasText: dentist.fullName }).locator(".dtl-block").click();
    const dialog = page.getByRole("dialog", { name: "Cập nhật lịch hẹn" });
    const date = dateField(dialog);
    const nav = diary(dialog);
    // The form is reset once the booking arrives; move only after that.
    await expect(date).toHaveValue(vnDate(day));
    await expect(nav.label).toHaveText(vnDate(day));

    await nav.next.click();
    await expect(nav.label).toHaveText(vnDate(shiftDays(day, 1)));
    await expect(date).toHaveValue(vnDate(shiftDays(day, 1)));
    await expect(dialog.getByPlaceholder("HH:mm")).toHaveValue("09:00");

    const put = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.request().method() === "PUT");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    const response = await put;
    expect(response.status(), await response.text()).toBe(200);
    await expect(dialog).toBeHidden();

    await page.reload();
    const stored = await dentistBookings(page);
    expect(stored.map((b) => b.id)).toEqual([booking.id]);
    expect(new Date(stored[0].slotStart).toISOString()).toBe(at(shiftDays(day, 1), "09:00"));
  });

  test("Tạo lịch tạm: ‹ › move Ngày hẹn too, a past day included", async ({ page }) => {
    await page.goto("/calendar");
    await page.locator(".cal-btn-temp").click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch tạm" });
    const date = dateField(dialog);
    const nav = diary(dialog);
    await expect(date).not.toHaveValue("");
    const opened = isoDate(await date.inputValue());
    await expect(nav.label).toHaveText(vnDate(opened));

    await nav.next.click();
    await expect(nav.label).toHaveText(vnDate(shiftDays(opened, 1)));
    await expect(date).toHaveValue(vnDate(shiftDays(opened, 1)));

    await nav.prev.click();
    await nav.prev.click();
    await expect(nav.label).toHaveText(vnDate(shiftDays(opened, -1)));
    await expect(date).toHaveValue(vnDate(shiftDays(opened, -1)));
  });

  test("Lặp lại lịch hẹn: a clicked session moves only the diary, › from there moves Ngày hẹn and the list", async ({ page }) => {
    const day = farDay();
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    const date = dateField(dialog);
    const nav = diary(dialog);

    await pickOption(page, dialog, /Chọn bệnh nhân/);
    await pickOption(page, dialog, /Chọn bác sĩ/, dentist.fullName);
    await typeDate(dialog, day);
    const time = dialog.getByPlaceholder("HH:mm");
    await time.fill("09:00");
    await time.press("Enter");
    await dialog.getByRole("checkbox", { name: "Lặp lại lịch hẹn" }).check();

    const rows = dialog.getByRole("region", { name: "Danh sách buổi hẹn" }).locator(".appt-series-row");
    await expect(rows).toHaveCount(6, { timeout: 15_000 });

    // The third session is shown in the diary; Ngày hẹn stays the series' first day.
    await rows.nth(2).click();
    await expect(nav.label).toHaveText(vnDate(shiftDays(day, 14)));
    await expect(dialog.locator(".mcal-day-focus")).toBeVisible();
    await expect(date).toHaveValue(vnDate(day));

    // › by hand from there: Ngày hẹn is the diary's new day, the list starts on it.
    await nav.next.click();
    await expect(nav.label).toHaveText(vnDate(shiftDays(day, 15)));
    await expect(date).toHaveValue(vnDate(shiftDays(day, 15)));
    await expect(rows.first()).toContainText(vnDate(shiftDays(day, 15)), { timeout: 15_000 });
  });
});
