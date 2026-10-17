import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { DAY_OFF, setOwnDay } from "./fixtures/ownDayOff";
import { call, clinicToday, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * R-981 (BA 2026-10-17): in "Lịch đã hẹn" by doctor, a click on an empty slot
 * of a doctor's row fills Giờ hẹn and Chọn bác sĩ with that doctor. A doctor
 * the form cannot take is left out with a toast saying why (OFF on Chấm công
 * that day / no longer an active doctor); the time is still taken. The saved
 * booking is read back after a reload.
 * Real stack: throw-away dentists, their rows made by real bookings, the OFF
 * day written by the doctor themselves; nothing is intercepted.
 */

const APPOINTMENTS = "/api/v1/app/appointments";

interface Booking {
  id: string;
  dentistId: string;
  slotStart: string;
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

/** A clinic-time (UTC+7) wall clock on `day` as an ISO instant. */
function at(day: string, time: string): string {
  return new Date(`${day}T${time}:00+07:00`).toISOString();
}

/** Books `dentistId` for 15 minutes from `time` with the first patient that is free then. */
async function book(page: Page, branchId: string, dentistId: string, day: string, time: string): Promise<Booking> {
  const patients = await call<{ items: { id: string; patientCode: string | null }[] }>(
    page, `/api/v1/app/patients?MaxResultCount=50&ClinicBranchId=${branchId}`, { branchId },
  );
  const slotStart = at(day, time);
  const slotEnd = new Date(new Date(slotStart).getTime() + 15 * 60_000).toISOString();
  let lastError: unknown;
  for (const patient of patients.body.items.filter((p) => p.patientCode)) {
    const res = await call<Booking>(page, APPOINTMENTS, {
      method: "POST",
      branchId,
      json: { patientId: patient.id, dentistId, branchId, slotStart, slotEnd, type: 2, chiefComplaint: `e2e-pick-doctor-${runId()}` },
    });
    if (res.status === 200) return res.body;
    lastError = res.body.error;
  }
  throw new Error(`no booking could be made: ${JSON.stringify(lastError)}`);
}

/** Mask mode: fill() is ignored, so type the digits from the day cell. */
async function typeDate(page: Page, input: Locator, day: string) {
  const dayRead = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.url().includes(`date=${day}`) && r.ok());
  await input.click({ position: { x: 4, y: 8 } });
  await input.pressSequentially(vnDate(day).replace(/\D/g, ""));
  await input.press("Enter");
  await expect(input).toHaveValue(vnDate(day));
  await dayRead;
}

test.describe("Lịch đã hẹn theo bác sĩ — bấm ô trống điền giờ và bác sĩ", () => {
  let branchId: string;
  let day: string;
  let off: RunStaff & { userName: string };
  let working: RunStaff;
  let gone: RunStaff;
  let offName: string;
  let workingName: string;
  let goneName: string;

  test.beforeEach(async ({ page, browser }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    const request = page.waitForRequest(
      (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
    );
    await page.goto("/calendar/list");
    branchId = (await request).headers()["x-clinic-branch-id"];

    const run = `${runId()}${test.info().workerIndex}`;
    day = shiftDays(clinicToday(), 6);
    offName = `BSPNghi${run}`;
    workingName = `BSPLam${run}`;
    goneName = `BSPNgung${run}`;
    const created = await createRunStaff(page, branchId, `po${run}`, { name: offName, isDentist: true, roleNames: ["admin"] });
    off = { ...created, userName: `tk-e2e-po${run}` };
    working = await createRunStaff(page, branchId, `pw${run}`, { name: workingName, isDentist: true });
    gone = await createRunStaff(page, branchId, `pg${run}`, { name: goneName, isDentist: true });

    // Each doctor gets a row in Lịch đã hẹn through a real booking, made
    // before the OFF day is registered and before the third stops being a doctor.
    await book(page, branchId, off.id, day, "09:00");
    await book(page, branchId, working.id, day, "14:00");
    await book(page, branchId, gone.id, day, "16:00");
    await setOwnDay(browser, off, branchId, day, DAY_OFF);
    const profile = await call<Record<string, unknown>>(page, `/api/v1/app/staff/${gone.id}`, { branchId });
    const demoted = await call(page, `/api/v1/app/staff/${gone.id}`, {
      method: "PUT",
      branchId,
      json: { ...profile.body, isDentist: false, roleNames: [], branchIds: [branchId] },
    });
    expect(demoted.status, JSON.stringify(demoted.body.error)).toBe(200);

    // Reopened so the doctor pickers list the run's dentists.
    await page.goto("/calendar/list");
    await assertRealApiTraffic(page, APPOINTMENTS);
  });

  test.afterEach(async ({ page }) => {
    const res = await call<{ items: Booking[] }>(
      page, `${APPOINTMENTS}?date=${day}&MaxResultCount=500`, { branchId },
    );
    const ids = new Set([off?.id, working?.id, gone?.id].filter(Boolean));
    for (const booking of res.body.items ?? []) {
      if (ids.has(booking.dentistId)) {
        await call(page, `${APPOINTMENTS}/${booking.id}`, { method: "DELETE", branchId });
      }
    }
    for (const s of [off, working, gone]) if (s) await deleteStaff(page, s.id);
  });

  test("Tạo lịch hẹn: OFF / ngừng hoạt động → chỉ điền giờ + toast lý do; bác sĩ làm việc → điền cả hai, lưu và đọc lại", async ({ page }) => {
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await expect(dialog).toBeVisible();
    await typeDate(page, dialog.getByPlaceholder("Chọn thời điểm"), day);

    const time = dialog.getByPlaceholder("HH:mm");
    const doctorField = dialog.locator(".appt-field").filter({ hasText: /Chọn bác sĩ/ }).first();
    await dialog.locator(".appt-mini-cal-menu-btn").click();
    await expect(dialog.locator(".mcal-day-doctor").filter({ hasText: offName })).toHaveCount(1);

    // OFF on Chấm công that day: the time only, and the toast names the day.
    await dialog.getByRole("button", { name: `Chọn giờ hẹn 11:00 với ${offName}` }).click();
    await expect(time).toHaveValue("11:00");
    await expect(page.getByText(
      `Bác sĩ ${offName} nghỉ ngày ${vnDate(day)} (đã đăng ký OFF trên Chấm công) nên chưa được chọn, chỉ điền giờ hẹn.`,
    )).toBeVisible();
    await expect(doctorField).not.toContainText(offName);

    // No longer a doctor (Bác sĩ unticked on Nhân viên): the time only, with its own reason.
    await dialog.getByRole("button", { name: `Chọn giờ hẹn 11:15 với ${goneName}` }).click();
    await expect(time).toHaveValue("11:15");
    await expect(page.getByText(
      `Bác sĩ ${goneName} đã ngừng hoạt động hoặc không còn là bác sĩ nên chưa được chọn, chỉ điền giờ hẹn.`,
    )).toBeVisible();
    await expect(doctorField).not.toContainText(goneName);

    // A working doctor: both filled; the diary then shows that doctor only.
    await dialog.getByRole("button", { name: `Chọn giờ hẹn 11:30 với ${workingName}` }).click();
    await expect(time).toHaveValue("11:30");
    await expect(doctorField).toContainText(workingName);
    await expect(dialog.locator(".mcal-day-doctor")).toHaveText([workingName]);

    await dialog.locator(".appt-field").filter({ hasText: /Chọn bệnh nhân/ }).first().getByRole("combobox").click();
    await page.locator("#ss-portal-dropdown [role=option]").first().click();
    await dialog.getByPlaceholder("Nội dung đặt lịch").fill(`Chọn bác sĩ từ ô ${runId()}`);

    // ✕ empties Chọn bác sĩ, which is still required: the error shows at once and Lưu is off.
    const save = dialog.getByRole("button", { name: "Lưu" });
    await expect(save).toBeEnabled();
    await doctorField.locator(".ss-icon--clear").dispatchEvent("mousedown");
    await expect(doctorField).not.toContainText(workingName);
    await expect(doctorField).toContainText("Vui lòng chọn bác sĩ");
    await expect(save).toBeDisabled();
    // Picked again from the diary row, the error goes and Lưu comes back.
    await dialog.getByRole("button", { name: `Chọn giờ hẹn 11:30 với ${workingName}` }).click();
    await expect(doctorField).toContainText(workingName);
    await expect(doctorField).not.toContainText("Vui lòng chọn bác sĩ");
    await expect(save).toBeEnabled();
    const saved = page.waitForResponse((r) => r.url().includes(APPOINTMENTS) && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    const response = await saved;
    expect(response.status(), await response.text()).toBe(200);
    await expect(dialog).toBeHidden();

    await page.reload();
    const res = await call<{ items: Booking[] }>(
      page, `${APPOINTMENTS}?DentistId=${working.id}&date=${day}&MaxResultCount=50`, { branchId },
    );
    expect(res.status).toBe(200);
    const starts = res.body.items.map((b) => new Date(b.slotStart).toISOString()).sort();
    expect(starts).toEqual([at(day, "11:30"), at(day, "14:00")]);
  });

  test("Tạo lịch tạm: bấm ô ở hàng bác sĩ điền giờ và bác sĩ, hàng bác sĩ nghỉ thì cảnh báo", async ({ page }) => {
    await page.goto("/calendar");
    await page.locator(".cal-btn-temp").click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch tạm" });
    await expect(dialog).toBeVisible();
    await typeDate(page, dialog.locator(".appt-field").filter({ hasText: /^Ngày hẹn/ }).locator("input").first(), day);

    const time = dialog.getByPlaceholder("HH:mm");
    const doctorField = dialog.locator(".appt-field").filter({ hasText: /Chọn bác sĩ/ }).first();
    await dialog.locator(".appt-mini-cal-menu-btn").click();

    await dialog.getByRole("button", { name: `Chọn giờ hẹn 10:00 với ${offName}` }).click();
    await expect(time).toHaveValue("10:00");
    await expect(page.getByText(`Bác sĩ ${offName} nghỉ ngày ${vnDate(day)}`, { exact: false })).toBeVisible();
    await expect(doctorField).not.toContainText(offName);

    await dialog.getByRole("button", { name: `Chọn giờ hẹn 10:45 với ${workingName}` }).click();
    await expect(time).toHaveValue("10:45");
    await expect(doctorField).toContainText(workingName);
    await expect(dialog.locator(".mcal-day-doctor")).toHaveText([workingName]);

    // Lịch tạm needs no doctor: ✕ empties the field with no error.
    await doctorField.locator(".ss-icon--clear").dispatchEvent("mousedown");
    await expect(doctorField).not.toContainText(workingName);
    await expect(dialog.locator(".appt-field-error")).toHaveCount(0);
  });
});
