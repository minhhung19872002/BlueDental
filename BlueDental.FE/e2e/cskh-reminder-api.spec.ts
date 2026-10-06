import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";
import { call } from "./fixtures/ledgerReceipt";

/**
 * Bug list item 12 (2026-10-06): CSKH › Nhắc lịch hẹn, Tháng 10/2026 listed
 * bookings already Hoàn thành / Đang khám / Đã đến and ones whose day had
 * passed, and "Chưa liên hệ" (8) was larger than "Tổng khách" (5).
 *
 * Now the tab lists only bookings still to come and not yet arrived, and its
 * total counts bookings — the same thing the contact counters count.
 * Real API on the logged-in session.
 */

const CARE = "/api/v1/app/care-records";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const REMINDER = 3;
const MISSED = 8;
const NOT_ARRIVED = [1, 2]; // Đã hẹn, Đã xác nhận
const MISSED_AFTER_MS = 5 * 60_000;

interface Row {
  id: string;
  appointmentId: string | null;
  appointmentStatus: number | null;
  /** The booking's time — a reminder task follows its appointment. */
  dueAt: string | null;
}

function monthWindow(): string {
  const now = new Date(Date.now() + 7 * 3600_000);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const last = new Date(Date.UTC(y, now.getUTCMonth() + 1, 0)).getUTCDate();
  return `fromDate=${encodeURIComponent(`${y}-${m}-01T00:00:00+07:00`)}&toDate=${encodeURIComponent(`${y}-${m}-${last}T23:59:59+07:00`)}`;
}

test("Nhắc lịch hẹn lists only bookings still to come, and its counters agree", async ({ page }) => {
  await login(page);
  const query = `type=${REMINDER}&clinicBranchId=${BRANCH_ONE}&${monthWindow()}`;

  const list = await call(page, `${CARE}?${query}&maxResultCount=1000`);
  expect(list.status).toBe(200);
  const rows = list.body.items as Row[];
  const now = Date.now();

  for (const row of rows) {
    expect(NOT_ARRIVED, `row ${row.id}`).toContain(row.appointmentStatus);
    expect(new Date(row.dueAt!).getTime(), `row ${row.id}`).toBeGreaterThan(now - MISSED_AFTER_MS - 60_000);
  }

  const stats = (await call(page, `${CARE}/stats?${query}`)).body as {
    totalRecords: number;
    contacted: number;
    notContacted: number;
  };
  expect(stats.totalRecords).toBe(list.body.totalCount);
  expect(stats.contacted + stats.notContacted).toBe(stats.totalRecords);

  // The two appointment tabs split the un-arrived bookings: none is in both.
  const missed = await call(page, `${CARE}?type=${MISSED}&clinicBranchId=${BRANCH_ONE}&${monthWindow()}&maxResultCount=1000`);
  const reminded = new Set(rows.map((r) => r.appointmentId));
  for (const row of missed.body.items as Row[]) {
    expect(reminded.has(row.appointmentId), `appointment ${row.appointmentId}`).toBe(false);
  }
});
