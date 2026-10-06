import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";
import { call } from "./fixtures/ledgerReceipt";

/**
 * Bug list item 17 (2026-10-06): the 09:30 booking of 05/10/2026 for DH260033,
 * who never came, still read "Đã đặt lịch" the next day — expected Trễ hẹn.
 *
 * Now a worker on the server moves a booking whose time is over without an
 * arrival to Trễ hẹn every minute, writes it to the appointment history as
 * done by the system, and reception can still check the patient in if they
 * turn up late after all. Real API on the logged-in session.
 */

const APPOINTMENTS = "/api/v1/app/appointments";
const HISTORY = "/api/v1/app/appointment-change-log";
const REQUESTED = 1;
const CONFIRMED = 2;
const CHECKED_IN = 3;
const NO_SHOW = 7;
const STATUS_CHANGED = 3;
const SYSTEM = 5;
/** The worker runs every minute; give it two passes before calling a booking overlooked. */
const GRACE_MS = 2 * 60_000;

interface Appointment {
  id: string;
  status: number;
  slotEnd: string;
  checkedInAt: string | null;
}

interface ChangeLog {
  action: number;
  source: number;
  statusBefore: number | null;
  statusAfter: number | null;
  actorUserId: string | null;
}

function clinicDay(offsetDays: number): string {
  return new Date(Date.now() + 7 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

const window30Days = () => `fromDate=${clinicDay(-30)}&toDate=${clinicDay(0)}&maxResultCount=1000`;

test("a booking whose time is over without an arrival turns Trễ hẹn by itself", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  await login(page);

  const overlooked = async () => {
    const res = await call(page, `${APPOINTMENTS}?statuses=${REQUESTED}&statuses=${CONFIRMED}&${window30Days()}`);
    expect(res.status).toBe(200);
    const cutoff = Date.now() - GRACE_MS;
    return (res.body.items as Appointment[]).filter((a) => new Date(a.slotEnd).getTime() <= cutoff).length;
  };
  await expect.poll(overlooked, { timeout: 5 * 60_000, intervals: [10_000] }).toBe(0);

  const late = await call(page, `${APPOINTMENTS}?statuses=${NO_SHOW}&${window30Days()}`);
  const marked = (late.body.items as Appointment[]).filter((a) => !a.checkedInAt);
  expect(marked.length).toBeGreaterThan(0);

  // The move is in the history, by the system, Đã hẹn / Đã xác nhận → Trễ hẹn.
  let byWorker: Appointment | undefined;
  for (const appointment of marked) {
    const history = await call(page, `${HISTORY}?appointmentId=${appointment.id}&maxResultCount=50`);
    const rows = history.body.items as ChangeLog[];
    if (rows.some((r) => r.action === STATUS_CHANGED && r.source === SYSTEM && r.statusAfter === NO_SHOW)) {
      const row = rows.find((r) => r.source === SYSTEM && r.statusAfter === NO_SHOW)!;
      expect([REQUESTED, CONFIRMED]).toContain(row.statusBefore);
      expect(row.actorUserId).toBeNull();
      byWorker = appointment;
      break;
    }
  }
  expect(byWorker, "no Trễ hẹn booking carries a system history row").toBeDefined();

  // A late patient who turns up after all is still received.
  const checkIn = await call(page, `${APPOINTMENTS}/${byWorker!.id}/check-in`, { method: "POST" });
  expect(checkIn.status).toBe(200);
  expect(checkIn.body.status).toBe(CHECKED_IN);

  const reloaded = await call(page, `${APPOINTMENTS}/${byWorker!.id}`);
  expect(reloaded.body.status).toBe(CHECKED_IN);
  expect(reloaded.body.checkedInAt).toBeTruthy();
});
