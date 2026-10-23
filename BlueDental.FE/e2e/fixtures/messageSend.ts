import { expect, type Browser, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./auth";
import { call } from "./timekeepingStaff";
import { openShiftCovering } from "./workShift";

/**
 * Shared by the CSKH send specs (F-77 Gửi tin nhắn, F-79 Chiến dịch đã gửi):
 * BD-001 data made through the real API, the Zalo stub the host points at
 * (e2e/fixtures/zalo-stub.mjs — never the real OA), and the send screen's
 * steps. Templates, patients and bookings carry a run id and stay behind.
 */

export const SENDS = "/api/v1/app/message-sends";
export const TEMPLATES = "/api/v1/app/message-templates";
export const ZALO = "/api/v1/app/zalo";
export const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
export const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";
export const STUB_URL = process.env.E2E_ZALO_STUB_URL ?? "http://127.0.0.1:5199";
export const CHANNEL = { Sms: 0, Zalo: 1 } as const;
export const BATCH = { Queued: 0, Sending: 1, Completed: 2, Cancelled: 3, Stopped: 4 } as const;
export const asBranchOne = { branchId: BRANCH_ONE };

const PASSWORD = "GuiTin@123456";
const CARE_APPOINTMENT_REMINDER = 3;

export interface Patient {
  id: string;
  firstName: string;
  name: string;
  phone: string;
}

export interface Batch {
  id: string;
  status: number;
  recipientCount: number;
  skippedCount: number;
  sentCount: number;
  failedCount: number;
}

export interface Template {
  id: string;
  name: string;
  status: number;
}

export const toast = (page: Page, text: string | RegExp) => page.locator("[data-sonner-toast]", { hasText: text });
export const customerRow = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });
export const cta = (page: Page) => page.locator(".snd-cta");
export const templateTrigger = (page: Page) => page.getByRole("button", { name: /^Chọn mẫu từ danh sách mẫu/ });

/** dd/mm/yyyy and yyyy-mm-dd of the same local day. */
export function days(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const [y, m, d] = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())];
  return { shown: `${d}/${m}/${y}`, iso: `${y}-${m}-${d}` };
}

export function tomorrowAt(hour: number): Date {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  day.setHours(hour, 0, 0, 0);
  return day;
}

export const secondsFromNow = (seconds: number) => new Date(Date.now() + seconds * 1000);

/** An approved ZNS template (#301001 on the stub) for Nhắc lịch hẹn, every parameter mapped. */
export async function zaloTemplate(page: Page, name: string): Promise<Template> {
  const res = await call<Template>(page, TEMPLATES, {
    ...asBranchOne,
    method: "POST",
    json: {
      publish: true,
      channel: CHANNEL.Zalo,
      name,
      purpose: CARE_APPOINTMENT_REMINDER,
      content: null,
      subject: null,
      externalTemplateId: "301001",
      paramMap: {
        customer_name: "{ten_khach_hang}",
        booking_date: "{ngay_hen}",
        booking_time: "{gio_hen}",
        promo_note: "Nhớ mang theo sổ khám",
      },
      removeDiacritics: false,
    },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body.status, "the stub approved #301001").toBe(1);
  return res.body;
}

/** A BD-001 patient; `phone` defaults to a fresh 09… number. */
export async function newPatient(page: Page, phone?: string): Promise<Patient> {
  const suffix = runId() + String(Math.floor(Math.random() * 90 + 10));
  const firstName = `Gửi ${suffix}`;
  const phoneNumber = phone ?? `09${suffix.padStart(8, "0").slice(-8)}`;
  const res = await call<{ id: string }>(page, "/api/v1/app/patients", {
    ...asBranchOne,
    method: "POST",
    json: { firstName, lastName: "E2E", dateOfBirth: null, gender: "female", phoneNumber },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { id: res.body.id, firstName, name: `E2E ${firstName}`, phone: phoneNumber };
}

/** The hồ sơ edit: a new number, or none at all (a hồ sơ then needs an email). */
export async function changeContact(
  page: Page,
  patient: Patient,
  phoneNumber: string | null,
  email: string | null = null,
): Promise<void> {
  const res = await call(page, `/api/v1/app/patients/${patient.id}`, {
    ...asBranchOne,
    method: "PUT",
    json: { firstName: patient.firstName, lastName: "E2E", dateOfBirth: null, gender: "female", phoneNumber, email },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
}

/**
 * Books the patient at `start` with the first dentist on shift then. Runs on
 * the same day fill the dentists' slots, so the double-booking warning is
 * confirmed the way the dialog's Xác nhận does (R-971).
 */
export async function book(page: Page, patientId: string, start: Date): Promise<void> {
  const staff = await call<{ items: { id: string }[] }>(page, "/api/v1/app/staff?MaxResultCount=20", asBranchOne);
  const end = new Date(start.getTime() + 30 * 60_000);
  for (const dentist of staff.body.items) {
    if (!(await openShiftCovering(page, BRANCH_ONE, dentist.id, start, end))) continue;
    const res = await call(page, "/api/v1/app/appointments", {
      ...asBranchOne,
      method: "POST",
      json: {
        patientId,
        dentistId: dentist.id,
        branchId: BRANCH_ONE,
        slotStart: start.toISOString(),
        slotEnd: end.toISOString(),
        type: 2,
        chiefComplaint: `e2e gửi tin ${runId()}`,
        allowDentistOverlap: true,
      },
    });
    if (res.status === 200) return;
  }
  throw new Error("no dentist could take the e2e booking");
}

/** ZNS sends the stub took for this phone (Zalo gets it as 84…, so the tail is compared). */
export async function znsSendsTo(phone: string): Promise<{ body: string }[]> {
  const calls = (await (await fetch(`${STUB_URL}/__calls`)).json()) as { path: string; body: string }[];
  return calls.filter((c) => c.path === "/message/template" && c.body.includes(phone.slice(1)));
}

export async function openSend(page: Page, query: string): Promise<void> {
  const loaded = assertRealApiTraffic(page, `${SENDS}/templates`);
  await page.goto(`/cskh-grouping/send?branch=BD-001&${query}`);
  await loaded;
}

/** Khách lẻ: find the customer by name in the picker and add them. */
export async function addCustomer(page: Page, name: string): Promise<void> {
  await page.locator(".snd-picker .ss-trigger").click();
  const dropdown = page.locator("#ss-portal-dropdown");
  await dropdown.locator(".ss-search-input").fill(name);
  await dropdown.getByRole("option", { name: new RegExp(name) }).click();
  await expect(customerRow(page, name)).toHaveCount(1, { timeout: 15_000 });
}

export async function pickTemplate(page: Page, name: string): Promise<void> {
  await templateTrigger(page).click();
  await page.getByRole("searchbox", { name: /^Tìm mẫu/ }).fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
  await expect(templateTrigger(page)).toContainText(name);
}

/** Confirms the CTA's dialog; resolves with the batch the server queued. */
export async function confirmSend(page: Page): Promise<Batch> {
  const dialog = page.getByRole("dialog").filter({ hasText: "Xác nhận gửi tin" });
  await expect(dialog).toBeVisible();
  const created = page.waitForResponse((res) => new URL(res.url()).pathname === SENDS && res.request().method() === "POST");
  await dialog.getByRole("button", { name: /Có$/ }).click();
  const res = await created;
  expect(res.status()).toBe(200);
  return (await res.json()) as Batch;
}

/** After Gửi / Hẹn gửi the screen hands over to Chiến dịch đã gửi (BA P2210, F-79). */
export async function expectCampaignList(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/cskh-grouping\?tab=campaign/);
}

export async function batchOf(page: Page, id: string): Promise<Batch> {
  return (await call<Batch>(page, `${SENDS}/${id}`, asBranchOne)).body;
}

export async function waitUntilDone(page: Page, id: string, timeout = 60_000): Promise<Batch> {
  await expect
    .poll(async () => (await batchOf(page, id)).status, { timeout, intervals: [2_000] })
    .toBe(BATCH.Completed);
  return batchOf(page, id);
}

/** A throw-away role holding just `grants`, and a staff member of BD-001 in it. */
export async function makeStaff(page: Page, grants: string[], phoneNumber: string | null = null) {
  const id = runId() + String(Math.floor(Math.random() * 90 + 10));
  const roleName = `Gửi tin ${id}`;
  const role = await call<{ id: string }>(page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  const granted = await call(page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
    method: "PUT",
    json: { permissions: grants.map((name) => ({ name, isGranted: true })) },
  });
  expect(granted.status).toBe(204);

  const userName = `guitin${id}`;
  const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
    method: "POST",
    json: {
      userName,
      password: PASSWORD,
      name: `Nhân viên gửi tin ${id}`,
      email: `${userName}@bluedental.local`,
      phoneNumber,
      roleNames: [roleName],
      branchIds: [BRANCH_ONE],
      isActive: true,
    },
  });
  expect(staff.status, JSON.stringify(staff.body)).toBe(200);

  const tearDown = async () => {
    await call(page, `/api/v1/app/staff/${staff.body.id}`, { method: "DELETE" });
    await call(page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
  };
  return { credentials: { userName, password: PASSWORD }, roleName, tearDown };
}

export async function setGrant(page: Page, roleName: string, name: string, isGranted: boolean): Promise<void> {
  const res = await call(page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
    method: "PUT",
    json: { permissions: [{ name, isGranted }] },
  });
  expect(res.status).toBe(204);
}

/** "Hẹn giờ gửi" through the API, for a time a few seconds ahead the UI cannot pick. */
export async function scheduleSend(page: Page, templateId: string, patientIds: string[], at: Date): Promise<Batch> {
  const res = await call<Batch>(page, SENDS, {
    ...asBranchOne,
    method: "POST",
    json: { channel: CHANNEL.Zalo, templateId, source: 1, patientIds, skipRecentDuplicates: true, scheduledAt: at.toISOString() },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

export async function stubConfig(change: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${STUB_URL}/__config`, { method: "POST", body: JSON.stringify(change) });
  expect(res.ok).toBe(true);
}

/**
 * Linked the way a manager links the real OA: the signed state from
 * connect-url comes back on Zalo's redirect, and the stub takes any code.
 */
export async function linkStub(page: Page): Promise<void> {
  const connect = await call<{ url: string }>(page, `${ZALO}/connect-url`, asBranchOne);
  expect(connect.status, "connect-url needs the host's Zalo app credentials").toBe(200);
  const state = new URL(connect.body.url).searchParams.get("state") ?? "";
  const callback = await page.request.get(`${ZALO}/oauth/callback`, {
    params: { code: "stub-code", state },
    maxRedirects: 0,
  });
  expect(callback.headers().location).toContain("zalo=connected");
}

export async function unlink(page: Page): Promise<void> {
  const unlinked = await call(page, `${ZALO}/connection`, { ...asBranchOne, method: "DELETE" });
  expect(unlinked.status, "unlink the stub OA").toBe(204);
}

/** Links BD-001 to the stub when it has no live connection; true when this call linked it. */
export async function linkStubIfIdle(page: Page): Promise<boolean> {
  const status = await call<{ isConnected: boolean }>(page, `${ZALO}/status`, asBranchOne);
  if (status.body.isConnected) return false;
  await linkStub(page);
  return true;
}

export async function openSession(browser: Browser, credentials: { userName: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);
  return { context, page };
}
