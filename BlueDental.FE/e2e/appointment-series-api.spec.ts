import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call, clinicToday, createRunStaff, deleteStaff, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * Feature F-65: "Lặp lại lịch hẹn" on Tạo lịch hẹn. The server lays the rule
 * out from the booking's own date, marks every session that cannot be booked
 * ("Trùng lịch") and refuses the whole series while one does. Afterwards each
 * session reads Đã hẹn / Đổi giờ / Đã đổi lịch / Đã huỷ hẹn / Kết thúc, and a
 * finished one is locked. Real API, a throw-away dentist, a day years out.
 */

const APPOINTMENTS = "/api/v1/app/appointments";
const SERIES = "/api/v1/app/appointment-series";
const SERIES_CONFLICT = "BlueDental:Appointment:0012";
const SESSION_FINISHED = "BlueDental:Appointment:0015";

const WEEKLY = 2;
const AFTER_COUNT = 1;
const State = { Free: 1, Conflict: 2, Booked: 3, TimeChanged: 4, Rescheduled: 5, Cancelled: 6, Finished: 7 } as const;
const Reason = { DentistBusy: 1, PatientBusy: 2, OutsideShift: 3 } as const;

interface Session {
  index: number;
  start: string;
  state: number;
  conflictReason: number | null;
  appointmentId: string | null;
}

interface Series {
  id: string | null;
  sessions: Session[];
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

/** A clinic-time (UTC+7) wall clock on `day` as an ISO instant. */
function at(day: string, time: string): string {
  return new Date(`${day}T${time}:00+07:00`).toISOString();
}

async function firstBranchAndPatient(page: Page): Promise<{ branchId: string; patientId: string }> {
  const request = page.waitForRequest(
    (r) => r.url().includes(APPOINTMENTS) && r.method() === "GET" && !!r.headers()["x-clinic-branch-id"],
  );
  await page.goto("/calendar");
  const branchId = (await request).headers()["x-clinic-branch-id"];
  const res = await call<{ items: { id: string }[] }>(
    page, `/api/v1/app/patients?MaxResultCount=1&ClinicBranchId=${branchId}`, { branchId },
  );
  expect(res.body.items.length, "the branch needs a patient").toBeGreaterThan(0);
  return { branchId, patientId: res.body.items[0].id };
}

test.describe("Lặp lại lịch hẹn — API", () => {
  let branchId: string;
  let patientId: string;
  let dentist: RunStaff;
  const bookings: string[] = [];

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    ({ branchId, patientId } = await firstBranchAndPatient(page));
    const run = `${runId()}${test.info().workerIndex}`;
    dentist = await createRunStaff(page, branchId, `rs${run}`, { name: `BSLapLai${run}`, isDentist: true });
  });

  test.afterEach(async ({ page }) => {
    // A finished session is locked (0015) and stays behind on its far-off day.
    for (const id of bookings.splice(0)) await call(page, `${APPOINTMENTS}/${id}`, { method: "DELETE", branchId });
    if (dentist) await deleteStaff(page, dentist.id);
  });

  function weekly(day: string, from: string, to: string, count = 6) {
    return {
      patientId, dentistId: dentist.id, branchId, type: 5,
      slotStart: at(day, from), slotEnd: at(day, to),
      chiefComplaint: `e2e-laplai-${runId()}`,
      recurrence: { frequency: WEEKLY, interval: 1, weekDays: [], end: AFTER_COUNT, count },
    };
  }

  async function dentistBookings(page: Page, from: string, to: string) {
    const res = await call<{ items: { id: string; seriesId: string | null }[] }>(
      page, `${APPOINTMENTS}?DentistId=${dentist.id}&fromDate=${from}&toDate=${to}&MaxResultCount=200`, { branchId },
    );
    expect(res.status).toBe(200);
    return res.body.items;
  }

  test("weekly × 6: preview, save, every session booked on its weekday at the same time", async ({ page }) => {
    const day = farDay();
    const input = weekly(day, "09:00", "09:30");

    const preview = await call<Series>(page, `${SERIES}/preview`, { method: "POST", branchId, json: input });
    expect(preview.status, JSON.stringify(preview.body.error)).toBe(200);
    expect(preview.body.sessions.map((s) => new Date(s.start).toISOString()))
      .toEqual([0, 7, 14, 21, 28, 35].map((d) => at(plusDays(day, d), "09:00")));
    expect(preview.body.sessions.every((s) => s.state === State.Free)).toBe(true);

    const created = await call<Series>(page, SERIES, { method: "POST", branchId, json: input });
    expect(created.status, JSON.stringify(created.body.error)).toBe(200);
    bookings.push(...created.body.sessions.map((s) => s.appointmentId!));
    expect(created.body.sessions).toHaveLength(6);

    // A separate read: six real appointments, all in the one series.
    const stored = await dentistBookings(page, day, plusDays(day, 36));
    expect(stored).toHaveLength(6);
    expect(new Set(stored.map((a) => a.seriesId))).toEqual(new Set([created.body.id]));

    const view = await call<Series>(page, `${SERIES}/by-appointment/${stored[2].id}`, { branchId });
    expect(view.status).toBe(200);
    expect(view.body.sessions.map((s) => s.state)).toEqual(Array(6).fill(State.Booked));
  });

  test("one clash refuses the whole series: Trùng lịch on that session, nothing stored", async ({ page }) => {
    const day = farDay();
    const third = plusDays(day, 14);
    const single = await call<{ id: string }>(page, APPOINTMENTS, {
      method: "POST",
      branchId,
      json: { patientId, dentistId: dentist.id, branchId, type: 2, slotStart: at(third, "09:15"), slotEnd: at(third, "09:45") },
    });
    expect(single.status, JSON.stringify(single.body.error)).toBe(200);
    bookings.push(single.body.id);

    const input = weekly(day, "09:00", "09:30");
    const preview = await call<Series>(page, `${SERIES}/preview`, { method: "POST", branchId, json: input });
    expect(preview.body.sessions.map((s) => s.state))
      .toEqual([State.Free, State.Free, State.Conflict, State.Free, State.Free, State.Free]);
    expect(preview.body.sessions[2].conflictReason).toBe(Reason.DentistBusy);

    const refused = await call<Series>(page, SERIES, { method: "POST", branchId, json: input });
    expect(refused.status).not.toBe(200);
    expect(refused.body.error?.code).toBe(SERIES_CONFLICT);
    // The Vietnamese wording ("Bác sĩ đã có lịch bị trùng…") is checked on the toast in the UI spec.

    const stored = await dentistBookings(page, day, plusDays(day, 36));
    expect(stored.map((a) => a.id)).toEqual([single.body.id]);
  });

  test("lunch time clashes with the shift on every session", async ({ page }) => {
    const preview = await call<Series>(page, `${SERIES}/preview`, {
      method: "POST", branchId, json: weekly(farDay(), "12:15", "12:45", 3),
    });
    expect(preview.status).toBe(200);
    expect(preview.body.sessions.map((s) => s.conflictReason)).toEqual(Array(3).fill(Reason.OutsideShift));
  });

  test("sessions read Đổi giờ / Đã đổi lịch / Đã huỷ hẹn / Kết thúc, and a finished one is locked", async ({ page }) => {
    const day = farDay();
    const created = await call<Series>(page, SERIES, {
      method: "POST", branchId, json: weekly(day, "09:00", "09:30", 5),
    });
    expect(created.status, JSON.stringify(created.body.error)).toBe(200);
    const ids = created.body.sessions.map((s) => s.appointmentId!);
    bookings.push(...ids);

    const move = (id: string, onDay: string, time: string) => call(page, `${APPOINTMENTS}/${id}`, {
      method: "PUT",
      branchId,
      json: { slotStart: at(onDay, time), slotEnd: at(onDay, time.replace(":00", ":30")), dentistId: dentist.id },
    });
    expect((await move(ids[1], plusDays(day, 7), "14:00")).status).toBe(200);
    expect((await move(ids[2], plusDays(day, 15), "09:00")).status).toBe(200);
    const cancelled = await call(page, `${APPOINTMENTS}/${ids[3]}/cancel`, {
      method: "POST", branchId, json: { reason: 1, note: "e2e lặp lại" },
    });
    expect(cancelled.status).toBe(200);
    const finished = await call(page, `${APPOINTMENTS}/${ids[4]}/complete`, { method: "POST", branchId, json: {} });
    expect(finished.status, JSON.stringify(finished.body.error)).toBe(200);

    const view = await call<Series>(page, `${SERIES}/by-appointment/${ids[0]}`, { branchId });
    expect(view.body.sessions.map((s) => s.state)).toEqual(
      [State.Booked, State.TimeChanged, State.Rescheduled, State.Cancelled, State.Finished],
    );

    const edit = await move(ids[4], plusDays(day, 28), "10:00");
    expect(edit.body.error?.code).toBe(SESSION_FINISHED);
    const remove = await call(page, `${APPOINTMENTS}/${ids[4]}`, { method: "DELETE", branchId });
    expect(remove.body.error?.code).toBe(SESSION_FINISHED);
    bookings.splice(bookings.indexOf(ids[4]), 1);
  });
});
