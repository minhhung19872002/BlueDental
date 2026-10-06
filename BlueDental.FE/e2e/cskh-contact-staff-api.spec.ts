import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";
import { call } from "./fixtures/ledgerReceipt";

/**
 * Bug list item 13 (2026-10-06): CSKH › Nhắc lịch hẹn — setting a row to
 * Đã liên hệ saved the state and the note, but "Nhân viên chăm sóc" stayed
 * "—". Whoever changes the state is now recorded, with the moment.
 *
 * Real API on the logged-in session; each read-back is a separate request.
 */

const CARE = "/api/v1/app/care-records";
const REMINDER = 3; // CareType.AppointmentReminder

interface Care {
  id: string;
  status: number;
  careStaffName: string | null;
  contactedAt: string | null;
}

test("setting a reminder to Đã liên hệ records who did it and when", async ({ page }) => {
  await login(page);
  const me = (await call(page, "/api/abp/application-configuration")).body as {
    currentUser: { name: string | null; userName: string };
  };
  const myName = me.currentUser.name ?? me.currentUser.userName;

  const list = await call(page, `${CARE}?type=${REMINDER}&maxResultCount=100`);
  const row = (list.body.items as Care[]).find((r) => r.status === 1);
  test.skip(!row, "no uncontacted reminder to work on");

  const contacted = await call(page, `${CARE}/${row!.id}/contact-status`, { method: "PUT", json: { contacted: true } });
  expect(contacted.status).toBe(200);

  const after = (await call(page, `${CARE}/${row!.id}`)).body as unknown as Care;
  expect(after.status).not.toBe(1);
  expect(after.careStaffName).toBe(myName);
  expect(after.contactedAt).toBeTruthy();

  // Set back: the moment goes, the name stays as who last touched it.
  await call(page, `${CARE}/${row!.id}/contact-status`, { method: "PUT", json: { contacted: false } });
  const back = (await call(page, `${CARE}/${row!.id}`)).body as unknown as Care;
  expect(back.status).toBe(1);
  expect(back.contactedAt).toBeNull();
  expect(back.careStaffName).toBe(myName);
});
