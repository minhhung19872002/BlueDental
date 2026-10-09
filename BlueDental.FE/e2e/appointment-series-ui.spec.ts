import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call, clinicToday, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * Feature F-65: "Lặp lại lịch hẹn" in Tạo lịch hẹn, through the real dialog.
 * Ticking the box lays out "Danh sách buổi hẹn" from Ngày hẹn, a row click
 * shows that session in Lịch đã hẹn, and "Lưu N lịch hẹn" books them all — or,
 * while one row reads Trùng lịch, nothing at all. Real stack: a throw-away
 * dentist, a day years out, no interception.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

interface Booking {
  id: string;
  seriesId: string | null;
  slotStart: string;
}

function farDay(): string {
  const date = new Date(`${clinicToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 400 + Math.floor(Math.random() * 4000));
  return date.toISOString().slice(0, 10);
}

function plusDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "2031-04-17" → "17/04/2031". */
function vnDate(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
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

test.describe("Lặp lại lịch hẹn — hộp thoại Tạo lịch hẹn", () => {
  let branchId: string;
  let dentist: RunStaff;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    branchId = await openCalendarBranch(page);
    const run = `${runId()}${test.info().workerIndex}`;
    dentist = await createRunStaff(page, branchId, `su${run}`, { name: `BSLapLaiUI${run}`, isDentist: true });
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

  /** Fills patient, the run's dentist, Ngày hẹn, 09:00 and Nội dung, then ticks the box. */
  async function openRepeating(page: Page, day: string, reason: string): Promise<Locator> {
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });

    await dialog.locator(".appt-field").filter({ hasText: /Chọn bệnh nhân/ }).first().getByRole("combobox").click();
    await page.locator("#ss-portal-dropdown [role=option]").first().click();
    await dialog.locator(".appt-field").filter({ hasText: /Chọn bác sĩ/ }).first().getByRole("combobox").click();
    await page.locator("#ss-portal-dropdown [role=option]").filter({ hasText: dentist.fullName }).first().click();

    // Mask mode: fill() is ignored, so type the digits.
    const dateInput = dialog.getByPlaceholder("Chọn thời điểm");
    await dateInput.click({ position: { x: 4, y: 8 } });
    await dateInput.pressSequentially(vnDate(day).replace(/\D/g, ""));
    await dateInput.press("Enter");
    await expect(dateInput).toHaveValue(vnDate(day));
    const time = dialog.getByPlaceholder("HH:mm");
    await time.fill("09:00");
    await time.press("Enter");
    await dialog.getByPlaceholder("Nội dung đặt lịch").fill(reason);

    await dialog.getByRole("checkbox", { name: "Lặp lại lịch hẹn" }).check();
    return dialog;
  }

  test("weekly × 6: the list, a row shown in Lịch đã hẹn, six bookings saved and kept after reload", async ({ page }) => {
    const day = farDay();
    const reason = `Lặp lại E2E ${runId()}`;
    const dialog = await openRepeating(page, day, reason);

    // Hàng tuần is the default and reads the weekday off Ngày hẹn.
    const weekday = ["chủ nhật", "thứ 2", "thứ 3", "thứ 4", "thứ 5", "thứ 6", "thứ 7"][new Date(`${day}T00:00:00Z`).getUTCDay()];
    await expect(dialog.getByRole("combobox", { name: "Kiểu lặp lại" }).locator("..")).toContainText(`Hàng tuần vào ${weekday}`);

    const list = dialog.getByRole("region", { name: "Danh sách buổi hẹn" });
    const rows = list.locator(".appt-series-row");
    await expect(rows).toHaveCount(6, { timeout: 15_000 });
    await expect(list).toContainText("6 buổi");
    for (let i = 0; i < 6; i++) {
      await expect(rows.nth(i)).toContainText(vnDate(plusDays(day, 7 * i)));
      await expect(rows.nth(i)).toContainText("09:00");
      await expect(rows.nth(i)).toContainText("Còn trống");
    }
    await expect(dialog).toContainText(`Từ ${vnDate(day)} đến ${vnDate(plusDays(day, 35))}`);

    // A row click moves Lịch đã hẹn to that day, with the slot marked.
    const third = plusDays(day, 14);
    const dayRead = page.waitForRequest((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${third}`));
    await rows.nth(2).click();
    await dayRead;
    const focus = dialog.locator(".mcal-day-focus");
    await expect(focus).toBeVisible();
    // Not on the book yet: the day says what the dashed slot is, never "Chưa có lịch hẹn".
    await expect(dialog).toContainText(new RegExp(`Buổi hẹn dự kiến 09:00 – \\d{2}:\\d{2} ${vnDate(third)}`));
    await expect(dialog).not.toContainText("Chưa có lịch hẹn ngày");
    // Scrolled, the slot slides under the sticky time header, not over it.
    const content = dialog.locator(".appt-mini-cal-content");
    const layers = await content.evaluate((box) => {
      const z = (sel: string) => Number(getComputedStyle(box.querySelector(sel)!).zIndex);
      return { header: z(".mcal-day-header"), focus: z(".mcal-day-focus") };
    });
    expect(layers.focus).toBeLessThan(layers.header);

    await dialog.getByRole("button", { name: "Lưu 6 lịch hẹn" }).click();
    await expect(page.getByText("Đã tạo 6 lịch hẹn")).toBeVisible();
    await expect(dialog).toBeHidden();

    // A separate read: six real bookings, one series, one per week at 09:00.
    const stored = await dentistBookings(page);
    expect(stored).toHaveLength(6);
    expect(new Set(stored.map((b) => b.seriesId)).size).toBe(1);
    expect(stored[0].seriesId).not.toBeNull();
    expect(stored.map((b) => new Date(b.slotStart).toISOString()).sort())
      .toEqual([0, 7, 14, 21, 28, 35].map((d) => at(plusDays(day, d), "09:00")));

    await page.reload();
    await page.getByPlaceholder("Tìm kiếm bệnh nhân, bác sĩ, lý do khám...").fill(reason);
    await expect(page.getByRole("row", { name: new RegExp(reason) })).toHaveCount(6, { timeout: 15_000 });
  });

  test("one Trùng lịch row: red with its reason, and Lưu books nothing", async ({ page }) => {
    const day = farDay();
    const patients = await call<{ items: { id: string }[] }>(
      page, `/api/v1/app/patients?MaxResultCount=1&ClinicBranchId=${branchId}`, { branchId },
    );
    // The dentist is already booked at 09:00 on the second week.
    const taken = await call<{ id: string }>(page, APPOINTMENTS, {
      method: "POST",
      branchId,
      json: {
        patientId: patients.body.items[0].id, dentistId: dentist.id, branchId, type: 2,
        slotStart: at(plusDays(day, 7), "09:00"), slotEnd: at(plusDays(day, 7), "09:30"),
        chiefComplaint: `e2e-laplai-chan-${runId()}`,
      },
    });
    expect(taken.status, JSON.stringify(taken.body)).toBe(200);

    const dialog = await openRepeating(page, day, `Lặp lại trùng E2E ${runId()}`);
    const rows = dialog.locator(".appt-series-row");
    await expect(rows).toHaveCount(6, { timeout: 15_000 });
    await expect(rows.nth(1)).toHaveClass(/appt-series-row--conflict/);
    await expect(rows.nth(1)).toContainText("Trùng lịch");
    await expect(dialog.locator(".appt-series-row--conflict")).toHaveCount(1);

    await rows.nth(1).locator(".appt-series-state").hover();
    await expect(page.getByRole("tooltip")).toContainText("Bác sĩ đã có lịch hẹn khác trong khung giờ này");

    await dialog.getByRole("button", { name: "Lưu 6 lịch hẹn" }).click();
    await expect(page.getByText("Bác sĩ đã có lịch bị trùng, không thể tạo lịch hẹn").first()).toBeVisible();
    await expect(dialog).toBeVisible();

    const stored = await dentistBookings(page);
    expect(stored.map((b) => b.id), "only the booking that was already there").toEqual([taken.body.id]);
  });
});
