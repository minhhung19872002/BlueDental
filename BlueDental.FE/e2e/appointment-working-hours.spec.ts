import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call, clinicToday, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * Feature: Lịch hẹn — no booking outside the dentist's working hours (QA row 3,
 * R-742). BA: "Ngoài giờ làm việc khóa luôn, không cho book" — the server
 * refuses, there is no override.
 *
 * The hours are the dentist's shifts in Lịch làm việc for that day, 08:00-12:00
 * and 13:00-17:00 when nothing was registered. Real stack: a throw-away
 * dentist, real bookings, a real shift opened through the timekeeping API.
 */

const APPOINTMENTS = "/api/v1/app/appointments";
const OUTSIDE_HOURS = "BlueDental:Appointment:0008";

interface Booking {
  id: string;
  slotStart: string;
  slotEnd: string;
}

/** A day years out, so neither the run's dentist nor anyone else has it booked. */
function farDay(): string {
  const date = new Date(`${clinicToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 400 + Math.floor(Math.random() * 4000));
  return date.toISOString().slice(0, 10);
}

/** A clinic-time (UTC+7) wall clock on `day` as an ISO instant. */
function at(day: string, time: string): string {
  return new Date(`${day}T${time}:00+07:00`).toISOString();
}

async function openCalendarBranch(page: Page): Promise<string> {
  const request = page.waitForRequest(
    (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto("/calendar");
  return (await request).headers()["x-clinic-branch-id"];
}

async function firstPatientId(page: Page, branchId: string): Promise<string> {
  const res = await call<{ items: { id: string }[] }>(
    page, `/api/v1/app/patients?MaxResultCount=1&ClinicBranchId=${branchId}`, { branchId },
  );
  expect(res.body.items.length, "the branch needs a patient").toBeGreaterThan(0);
  return res.body.items[0].id;
}

test.describe("Lịch hẹn — chỉ đặt trong giờ làm của bác sĩ", () => {
  let branchId: string;
  let dentist: RunStaff;
  let patientId: string;
  const bookings: string[] = [];

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    branchId = await openCalendarBranch(page);
    const run = `${runId()}${test.info().workerIndex}`;
    dentist = await createRunStaff(page, branchId, `wh${run}`, { name: `BSGioLam${run}`, isDentist: true });
    patientId = await firstPatientId(page, branchId);
  });

  test.afterEach(async ({ page }) => {
    for (const id of bookings.splice(0)) await call(page, `${APPOINTMENTS}/${id}`, { method: "DELETE", branchId });
    if (dentist) await deleteStaff(page, dentist.id);
  });

  function create(page: Page, day: string, from: string, to: string) {
    return call<Booking>(page, APPOINTMENTS, {
      method: "POST",
      branchId,
      json: {
        patientId, dentistId: dentist.id, branchId, type: 2,
        slotStart: at(day, from), slotEnd: at(day, to), chiefComplaint: `e2e-giolam-${runId()}`,
      },
    });
  }

  test("the default shifts: lunch, evening and a slot running past 17:00 are refused, 09:00 is booked", async ({ page }) => {
    const day = farDay();

    for (const [from, to] of [["12:15", "12:45"], ["19:00", "19:30"], ["16:45", "17:15"]]) {
      const refused = await create(page, day, from, to);
      expect(refused.status, `${from}-${to} must be refused`).not.toBe(200);
      expect(refused.body.error?.code).toBe(OUTSIDE_HOURS);
      expect(refused.body.error?.message).toContain("08:00-12:00, 13:00-17:00");
    }
    const list = await call<{ items: unknown[] }>(
      page, `${APPOINTMENTS}?DentistId=${dentist.id}&date=${day}&MaxResultCount=50`, { branchId },
    );
    expect(list.body.items, "nothing refused was stored").toHaveLength(0);

    const booked = await create(page, day, "09:00", "09:30");
    expect(booked.status, JSON.stringify(booked.body.error)).toBe(200);
    bookings.push(booked.body.id);

    // Moving it into the evening is refused just the same, and it stays put.
    const moved = await call(page, `${APPOINTMENTS}/${booked.body.id}`, {
      method: "PUT",
      branchId,
      json: { slotStart: at(day, "19:00"), slotEnd: at(day, "19:30"), dentistId: dentist.id, chiefComplaint: "moved" },
    });
    expect(moved.body.error?.code).toBe(OUTSIDE_HOURS);
    const stored = await call<Booking>(page, `${APPOINTMENTS}/${booked.body.id}`, { branchId });
    expect(new Date(stored.body.slotStart).toISOString()).toBe(at(day, "09:00"));
  });

  test("a shift opened in Lịch làm việc moves the limit: 19:00 is booked, 20:00 still refused", async ({ page }) => {
    const day = farDay();
    const opened = await call(page, "/api/v1/app/time-keepings/open-day", {
      method: "POST",
      branchId,
      json: {
        staffId: dentist.id, clinicBranchId: branchId, workDate: day,
        morningStart: "08:00:00", morningEnd: "12:00:00", afternoonStart: "13:00:00", afternoonEnd: "20:00:00",
      },
    });
    expect(opened.status, JSON.stringify(opened.body.error)).toBe(200);

    const evening = await create(page, day, "19:00", "19:30");
    expect(evening.status, JSON.stringify(evening.body.error)).toBe(200);
    bookings.push(evening.body.id);

    const late = await create(page, day, "20:00", "20:30");
    expect(late.body.error?.code).toBe(OUTSIDE_HOURS);
    expect(late.body.error?.message).toContain("08:00-12:00, 13:00-20:00");
  });

  test("the editor: 12:15 is refused with the reason and the dialog stays open, 09:00 then saves", async ({ page }) => {
    const reason = `Giờ làm E2E ${runId()}`;
    const [year, month, date] = farDay().split("-");

    await page.goto("/calendar/list");
    await assertRealApiTraffic(page, APPOINTMENTS);
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });

    await dialog.locator(".appt-field").filter({ hasText: /Chọn bệnh nhân/ }).first().getByRole("combobox").click();
    await page.locator("#ss-portal-dropdown [role=option]").first().click();
    await dialog.locator(".appt-field").filter({ hasText: /Chọn bác sĩ/ }).first().getByRole("combobox").click();
    await page.locator("#ss-portal-dropdown [role=option]").filter({ hasText: dentist.fullName }).first().click();

    // Mask mode (DATE_INPUT_FORMAT): fill() is ignored, so type the digits from the day cell.
    const dateInput = dialog.getByPlaceholder("Chọn thời điểm");
    await dateInput.click({ position: { x: 4, y: 8 } });
    await dateInput.pressSequentially(`${date}${month}${year}`);
    await dateInput.press("Enter");
    await expect(dateInput).toHaveValue(`${date}/${month}/${year}`);
    const time = dialog.getByPlaceholder("HH:mm");
    await time.fill("12:15");
    await time.press("Enter");
    await dialog.getByPlaceholder("Nội dung đặt lịch").fill(reason);

    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText(/Không thể đặt lịch: giờ hẹn nằm ngoài ca làm của bác sĩ/)).toBeVisible();
    await expect(dialog).toBeVisible();

    await time.fill("09:00");
    await time.press("Enter");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();

    const search = page.getByPlaceholder("Tìm kiếm bệnh nhân, bác sĩ, lý do khám...");
    await search.fill(reason);
    const row = page.getByRole("row", { name: new RegExp(reason) });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await page.getByPlaceholder("Tìm kiếm bệnh nhân, bác sĩ, lý do khám...").fill(reason);
    await expect(row).toBeVisible({ timeout: 15_000 });

    const found = await call<{ items: Booking[] }>(
      page, `${APPOINTMENTS}?Filter=${encodeURIComponent(reason)}&MaxResultCount=5`, { branchId },
    );
    bookings.push(...found.body.items.map((b) => b.id));
  });
});
