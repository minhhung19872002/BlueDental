import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { OFF, setDayOff } from "./fixtures/lichNghi";
import { call, clinicToday, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * Feature: Lịch hẹn — a booking that runs into the dentist's time off on the
 * Lịch nghỉ board is refused (F-90 / F-10, R-1210; owner 2026-11-11). The day
 * splits at midday: nghỉ sáng refuses a slot starting before the afternoon
 * shift starts (13:00 by default), nghỉ chiều one ending after the morning
 * shift ends (12:00), evenings included; nghỉ cả ngày refuses the whole day.
 * A day with nothing off books at any hour — the profile hours no longer fence
 * a booking (R-742's rule is retired). The server refuses; there is no override.
 *
 * Real stack: a throw-away dentist, the time off saved through the real board
 * API, real bookings read back through separate requests. Nothing intercepted.
 */

const APPOINTMENTS = "/api/v1/app/appointments";
const OFF_DAY = "BlueDental:Appointment:0009";
const OFF_MORNING = "BlueDental:Appointment:0019";
const OFF_AFTERNOON = "BlueDental:Appointment:0020";

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

test.describe("Lịch hẹn — chặn theo Lịch nghỉ của bác sĩ", () => {
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
        slotStart: at(day, from), slotEnd: at(day, to), chiefComplaint: `e2e-lichnghi-${runId()}`,
      },
    });
  }

  async function expectBooked(page: Page, day: string, from: string, to: string) {
    const res = await create(page, day, from, to);
    expect(res.status, `${from}-${to}: ${JSON.stringify(res.body.error)}`).toBe(200);
    bookings.push(res.body.id);
    const stored = await call<Booking>(page, `${APPOINTMENTS}/${res.body.id}`, { branchId });
    expect(new Date(stored.body.slotStart).toISOString()).toBe(at(day, from));
    return res.body;
  }

  async function expectRefused(page: Page, day: string, from: string, to: string, code: string) {
    const res = await create(page, day, from, to);
    expect(res.status, `${from}-${to} must be refused`).not.toBe(200);
    expect(res.body.error?.code, `${from}-${to}`).toBe(code);
    return res.body.error?.message ?? "";
  }

  async function storedCount(page: Page, day: string): Promise<number> {
    const list = await call<{ items: unknown[] }>(
      page, `${APPOINTMENTS}?DentistId=${dentist.id}&date=${day}&MaxResultCount=50`, { branchId },
    );
    return list.body.items.length;
  }

  test("nothing off that day: lunch, the evening and past 17:00 all book", async ({ page }) => {
    const day = farDay();
    for (const [from, to] of [["12:15", "12:45"], ["19:00", "19:30"], ["16:45", "17:15"], ["06:30", "07:00"]]) {
      await expectBooked(page, day, from, to);
    }
  });

  test("nghỉ cả ngày: every hour is refused and nothing is stored", async ({ page }) => {
    const day = farDay();
    await setDayOff(page, branchId, dentist.id, day, OFF.FullDay);
    for (const [from, to] of [["09:00", "09:30"], ["15:00", "15:30"], ["20:00", "20:30"]]) {
      await expectRefused(page, day, from, to, OFF_DAY);
    }
    expect(await storedCount(page, day), "nothing refused was stored").toBe(0);
  });

  test("nghỉ sáng: a slot starting before 13:00 is refused, from 13:00 it books; moving it into the morning is refused", async ({ page }) => {
    const day = farDay();
    await setDayOff(page, branchId, dentist.id, day, OFF.Morning);

    for (const [from, to] of [["09:00", "09:30"], ["12:30", "13:00"], ["12:45", "13:15"]]) {
      const message = await expectRefused(page, day, from, to, OFF_MORNING);
      expect(message).toContain("13:00");
    }
    const booked = await expectBooked(page, day, "13:00", "13:30");
    await expectBooked(page, day, "20:00", "20:30");

    const moved = await call(page, `${APPOINTMENTS}/${booked.id}`, {
      method: "PUT",
      branchId,
      json: { slotStart: at(day, "10:00"), slotEnd: at(day, "10:30"), dentistId: dentist.id, chiefComplaint: "moved" },
    });
    expect(moved.body.error?.code).toBe(OFF_MORNING);
    const stored = await call<Booking>(page, `${APPOINTMENTS}/${booked.id}`, { branchId });
    expect(new Date(stored.body.slotStart).toISOString(), "the refused move left it put").toBe(at(day, "13:00"));
  });

  test("nghỉ chiều: a slot ending by 12:00 books, one running past 12:00 or in the evening is refused", async ({ page }) => {
    const day = farDay();
    await setDayOff(page, branchId, dentist.id, day, OFF.Afternoon);

    // Refusals first: 11:45-12:15 would otherwise clash with the patient's own 11:30 booking.
    for (const [from, to] of [["11:45", "12:15"], ["15:00", "15:30"], ["19:00", "19:30"]]) {
      const message = await expectRefused(page, day, from, to, OFF_AFTERNOON);
      expect(message).toContain("12:00");
    }
    await expectBooked(page, day, "07:00", "07:30");

    // Ending right on 12:00 books — even stamped with stray milliseconds
    // (bug 2026-10-13: Tạo tiếp nhận sent dayjs()'s and it was refused).
    const stamped = (time: string) => at(day, time).replace(".000Z", ".437Z");
    const lastSlot = await call<Booking>(page, APPOINTMENTS, {
      method: "POST",
      branchId,
      json: {
        patientId, dentistId: dentist.id, branchId, type: 2,
        slotStart: stamped("11:30"), slotEnd: stamped("12:00"), chiefComplaint: `e2e-lichnghi-${runId()}`,
      },
    });
    expect(lastSlot.status, JSON.stringify(lastSlot.body.error)).toBe(200);
    bookings.push(lastSlot.body.id);
  });

  test("time off cleared on the board: the morning books again", async ({ page }) => {
    const day = farDay();
    await setDayOff(page, branchId, dentist.id, day, OFF.Morning);
    await expectRefused(page, day, "09:00", "09:30", OFF_MORNING);
    await setDayOff(page, branchId, dentist.id, day, OFF.None);
    await expectBooked(page, day, "09:00", "09:30");
  });

  test("checked in today, then Cập nhật thông tin moves the afternoon end: the plan saves, the clock stays, bookings follow", async ({ page }) => {
    // Owner 2026-10-13 (R-912): the edit used to be dropped silently once the
    // day had a check-in, so the dentist stayed on the 17:00 he opened with.
    const TK = "/api/v1/app/time-keepings";
    const today = clinicToday();
    const opened = await call<{ id: string }>(page, `${TK}/open-day`, {
      method: "POST", branchId, json: { staffId: dentist.id, clinicBranchId: branchId, workDate: today },
    });
    expect(opened.status, JSON.stringify(opened.body.error)).toBe(200);
    const checkIn = await call(page, `${TK}/${opened.body.id}/check-in`, { method: "POST", branchId, json: { shift: 1 } });
    expect(checkIn.status, JSON.stringify(checkIn.body.error)).toBe(200);

    const edited = await call(page, `${TK}/${opened.body.id}/info`, {
      method: "PUT",
      branchId,
      json: { note: null, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "13:00", afternoonEnd: "23:59" },
    });
    expect(edited.status, JSON.stringify(edited.body.error)).toBe(200);

    // A separate read: the new plan is stored and the morning clock-in survived.
    const stored = await call<{
      morningShift: { checkedInAt: string | null };
      afternoonShift: { plannedEnd: string };
    }>(page, `${TK}/${opened.body.id}`, { branchId });
    expect(stored.body.afternoonShift.plannedEnd).toContain("23:59");
    expect(stored.body.morningShift.checkedInAt).not.toBeNull();

    // Booking after 17:00 today now passes the shift check (a slot still ahead of now).
    const nowMinutes = Math.floor(((Date.now() / 60_000) + 7 * 60) % (24 * 60));
    const startMinutes = Math.max(17 * 60 + 15, Math.ceil((nowMinutes + 10) / 15) * 15);
    test.skip(startMinutes + 30 > 23 * 60 + 59, "too late in the clinic day to book a slot after 17:00");
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const evening = await create(page, today, hhmm(startMinutes), hhmm(startMinutes + 30));
    expect(evening.status, JSON.stringify(evening.body.error)).toBe(200);
    bookings.push(evening.body.id);
  });


  test("the editor: 09:00 on nghỉ sáng is refused with the reason and the dialog stays open, 13:30 then saves", async ({ page }) => {
    const reason = `Lịch nghỉ E2E ${runId()}`;
    const day = farDay();
    const [year, month, date] = day.split("-");
    await setDayOff(page, branchId, dentist.id, day, OFF.Morning);

    await page.goto("/calendar/list");
    await assertRealApiTraffic(page, APPOINTMENTS);
    await page.getByRole("button", { name: /Tạo lịch hẹn/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });

    // Mask mode (DATE_INPUT_FORMAT): fill() is ignored, so type the digits from the day cell.
    const dateInput = dialog.getByPlaceholder("Chọn thời điểm");
    await dateInput.click({ position: { x: 4, y: 8 } });
    await dateInput.pressSequentially(`${date}${month}${year}`);
    await dateInput.press("Enter");
    await expect(dateInput).toHaveValue(`${date}/${month}/${year}`);

    await dialog.locator(".appt-field").filter({ hasText: /Chọn bệnh nhân/ }).first().getByRole("combobox").click();
    await page.locator("#ss-portal-dropdown [role=option]").first().click();
    // Nghỉ sáng only: still offered that day (the picker knows the date, not the hour).
    await dialog.locator(".appt-field").filter({ hasText: /Chọn bác sĩ/ }).first().getByRole("combobox").click();
    await page.locator("#ss-portal-dropdown [role=option]").filter({ hasText: dentist.fullName }).first().click();

    const time = dialog.getByPlaceholder("HH:mm");
    await time.fill("09:00");
    await time.press("Enter");
    await dialog.getByPlaceholder("Nội dung đặt lịch").fill(reason);

    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText(/bác sĩ đã đăng ký nghỉ ca sáng hôm đó/)).toBeVisible();
    await expect(dialog).toBeVisible();

    await time.fill("13:30");
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
    expect(found.body.items.map((b) => new Date(b.slotStart).toISOString())).toEqual([at(day, "13:30")]);
  });
});
