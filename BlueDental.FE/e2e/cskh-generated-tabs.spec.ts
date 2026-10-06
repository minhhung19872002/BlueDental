import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { openShiftCovering } from "./fixtures/workShift";

/**
 * Feature: CSKH tabs filled from the clinic's own data (owner, 2026-10-05).
 *
 * - Chúc mừng sinh nhật: every patient whose birthday falls in the window.
 * - Nhắc lịch hẹn: every booking in the window still on the book.
 * - Đặt lịch không đến: bookings 5+ minutes past their time with no arrival.
 * - All three: Đã liên hệ / Chưa liên hệ, persisted and written to the log.
 * - Lịch hẹn hủy (bug list #16): bookings cancelled in the window, with the
 *   reason the cancel now requires.
 * - Complain (bug list #16): filed by hand, content required, handled through
 *   the Thành công / Thất bại result dialog.
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted.
 * Fixtures go through the real API with the session the login screen gave.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";
const CARE = "/api/v1/app/care-records";

interface Patient {
  id: string;
  name: string;
}

/** One API call from inside the page, with the session and the branch header. */
async function call(
  page: Page,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; json: unknown; text: string }> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { status: res.status, json, text };
    },
    { method, url, body, branch: BRANCH },
  );
}

function localIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function newPatient(page: Page, dateOfBirth: string | null): Promise<Patient> {
  const suffix = runId() + String(Math.floor(Math.random() * 90 + 10));
  const firstName = `CSKH ${suffix}`;
  const res = await call(page, "POST", "/api/v1/app/patients", {
    firstName,
    lastName: "E2E",
    dateOfBirth,
    gender: "female",
    phoneNumber: `09${suffix.padStart(8, "0").slice(-8)}`,
  });
  expect(res.status, res.text).toBe(200);
  return { id: (res.json as { id: string }).id, name: `E2E ${firstName}` };
}

/** Books the patient at `start` with the first dentist free then. */
async function book(page: Page, patientId: string, start: Date): Promise<string> {
  const staff = (await call(page, "GET", "/api/v1/app/staff?MaxResultCount=20")).json as { items: { id: string }[] };
  const end = new Date(start.getTime() + 30 * 60_000);
  for (const dentist of staff.items) {
    // `start` follows the clock, so it may fall outside the default shifts.
    if (!(await openShiftCovering(page, BRANCH, dentist.id, start, end))) continue;
    const res = await call(page, "POST", "/api/v1/app/appointments", {
      patientId,
      dentistId: dentist.id,
      branchId: BRANCH,
      slotStart: start.toISOString(),
      slotEnd: end.toISOString(),
      type: 2,
      chiefComplaint: `e2e cskh ${runId()}`,
    });
    if (res.status === 200) return (res.json as { id: string }).id;
  }
  throw new Error("no dentist could take the e2e booking");
}

/**
 * Types into Tìm kiếm and waits for the debounced list request it causes, so a
 * row is not clicked while the list is about to be replaced under it.
 */
async function search(page: Page, text: string): Promise<void> {
  const listed = page.waitForResponse(
    (res) => res.url().includes(`${CARE}?`) && res.url().includes("filter=") && res.request().method() === "GET",
  );
  await page.getByRole("textbox", { name: "Tìm kiếm" }).fill(text);
  await listed;
}

/** Xuất Excel on the open board: the file name and the first sheet's rows. */
async function exportBoard(page: Page): Promise<{ filename: string; rows: string[][] }> {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel" }).click();
  const file = await download;
  // The xlsx ESM build has no readFile.
  const workbook = XLSX.read(readFileSync(await file.path()), { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return {
    filename: file.suggestedFilename(),
    rows: XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" }),
  };
}

/** The care board on one tab and day, searched down to one patient. */
async function openBoard(page: Page, tab: string, query: string, day?: Date): Promise<void> {
  const dayParams = day ? `&care_dateMode=day&care_date=${localIsoDate(day)}` : "";
  await page.goto(`/cskh-grouping?tab=care&page=${tab}${dayParams}`);
  await assertRealApiTraffic(page, `${CARE}/stats`);
  await search(page, query);
}

/**
 * Flips the row to Đã liên hệ through the dropdown, then proves it stuck and
 * was logged. `rowKey` pins the care task when the search text matches several.
 */
async function markContacted(page: Page, rowText: string, rowKey?: string): Promise<void> {
  const rows = page.locator(".cskh-table tbody tr.ant-table-row");
  const row = rowKey ? rows.and(page.locator(`[data-row-key="${rowKey}"]`)) : rows.filter({ hasText: rowText });
  await expect(row).toHaveCount(1, { timeout: 15_000 });
  const select = row.locator(".cskh-contact-select");
  await expect(select).toContainText("Chưa liên hệ");
  const id = await row.getAttribute("data-row-key");

  // Wide tabs scroll sideways: a minimal scroll would park the dropdown under
  // the pinned Thao tác column, so bring it to the middle first.
  await select.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
  await select.click();
  const saved = page.waitForResponse(
    (res) => res.url().includes(`${CARE}/${id}/contact-status`) && res.request().method() === "PUT",
  );
  await page.locator(".ant-select-dropdown:visible").getByText("Đã liên hệ", { exact: true }).click();
  expect((await saved).status()).toBe(200);

  await page.reload();
  await search(page, rowText);
  await expect(row.locator(".cskh-contact-select")).toContainText("Đã liên hệ", { timeout: 15_000 });

  const logs = await call(page, "GET", `${CARE}/${id}/contact-logs`);
  expect(logs.status, logs.text).toBe(200);
  const [latest] = logs.json as { status: number; creatorName: string | null }[];
  expect(latest.status).toBe(2);
  expect(latest.creatorName).toBeTruthy();
}

test.describe("CSKH › Sinh nhật, Nhắc lịch hẹn, Đặt lịch không đến", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
  });

  test("a patient whose birthday is this month is listed under the default Tháng view", async ({ page }) => {
    const today = new Date();
    const patient = await newPatient(page, `1990-${localIsoDate(today).slice(5)}`);
    const notThisMonth = await newPatient(page, `1990-${today.getMonth() === 0 ? "06" : "01"}-15`);

    await page.goto("/cskh-grouping?tab=care&page=birthday");
    await expect(page.getByRole("button", { name: "Tháng", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("textbox", { name: "Tìm kiếm" }).fill(patient.name);
    await expect(page.locator(".cskh-table tbody tr.ant-table-row").filter({ hasText: patient.name })).toHaveCount(1, {
      timeout: 15_000,
    });

    await page.getByRole("textbox", { name: "Tìm kiếm" }).fill(notThisMonth.name);
    await expect(page.getByText("Không có dữ liệu")).toBeVisible();

    // A birthday task filed by hand for a patient with no date of birth is not
    // a birthday: it stays off the tab even though its date is in the window.
    const noBirthday = await newPatient(page, null);
    const filed = await call(page, "POST", CARE, {
      patientId: noBirthday.id,
      branchId: BRANCH,
      type: 2,
      subject: "Happy Birthday",
      dueAt: new Date().toISOString(),
      status: 1,
    });
    expect(filed.status, filed.text).toBe(200);
    await page.reload();
    await search(page, noBirthday.name);
    await expect(page.getByText("Không có dữ liệu")).toBeVisible();

    // The Chưa liên hệ counter narrows by contact state, not by one status.
    const narrowed = page.waitForRequest((r) => r.url().includes(`${CARE}?`) && r.url().includes("contacted=false"));
    await page.getByRole("button", { name: /\d+\s*Chưa liên hệ/ }).click();
    await narrowed;
    await page.getByRole("button", { name: /\d+\s*Tổng khách/ }).click();

    await search(page, patient.name);
    await markContacted(page, patient.name);
  });

  test("a booking is reminded until it is cancelled", async ({ page }) => {
    const patient = await newPatient(page, null);
    const start = new Date(Date.now() + 24 * 3600_000);
    start.setMinutes(0, 0, 0);
    const appointmentId = await book(page, patient.id, start);

    await openBoard(page, "remind-appointment", patient.name, start);
    await markContacted(page, patient.name);

    const cancelled = await call(page, "POST", `/api/v1/app/appointments/${appointmentId}/cancel`, { reason: 1, note: "e2e" });
    expect(cancelled.status, cancelled.text).toBe(200);
    await openBoard(page, "remind-appointment", patient.name, start);
    await expect(page.getByText("Không có dữ liệu")).toBeVisible({ timeout: 15_000 });
  });

  test("a booking five minutes overdue with no arrival is a missed one, until the patient checks in", async ({
    page,
  }) => {
    // The API refuses a booking in the past, so take a real overdue one the
    // clinic already has: booked, never arrived, in the last month. Once its
    // time is over the server has moved it to Trễ hẹn (7, bug list item 17) —
    // still a missed one, and still received if the patient turns up.
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 3600_000);
    const found = await call(
      page,
      "GET",
      `/api/v1/app/appointments?branchId=${BRANCH}&statuses=1&statuses=2&statuses=7&isTemporary=false` +
        `&fromDate=${localIsoDate(monthAgo)}&toDate=${localIsoDate(now)}&maxResultCount=200`,
    );
    expect(found.status, found.text).toBe(200);
    const overdue = (found.json as { items: { id: string; slotStart: string; patientId: string; patientCode: string }[] })
      .items.find((a) => new Date(a.slotStart).getTime() < now.getTime() - 10 * 60_000);
    expect(overdue, "the demo clinic should have an overdue booking with no arrival").toBeTruthy();
    const day = new Date(overdue!.slotStart);

    await openBoard(page, "missed-appointment", overdue!.patientCode, day);
    await expect(page.getByRole("columnheader", { name: "Lịch hẹn", exact: true })).toBeVisible();
    const tasks = await call(
      page,
      "GET",
      `${CARE}?type=8&branchId=${BRANCH}&patientId=${overdue!.patientId}&maxResultCount=1000` +
        `&fromDate=${encodeURIComponent(new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString())}` +
        `&toDate=${encodeURIComponent(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999).toISOString())}`,
    );
    const task = (tasks.json as { items: { id: string; appointmentId: string }[] }).items.find(
      (t) => t.appointmentId === overdue!.id,
    );
    expect(task, "the overdue booking should have its Đặt lịch không đến task").toBeTruthy();
    await call(page, "PUT", `${CARE}/${task!.id}/contact-status`, { contacted: false });
    await page.reload();
    await search(page, overdue!.patientCode);
    await markContacted(page, overdue!.patientCode, task!.id);

    // A booking still ahead is not missed.
    const later = await newPatient(page, null);
    const ahead = new Date(Date.now() + 2 * 3600_000);
    await book(page, later.id, ahead);
    await openBoard(page, "missed-appointment", later.name, ahead);
    await expect(page.getByText("Không có dữ liệu")).toBeVisible({ timeout: 15_000 });

    // Arriving late takes the row off the tab.
    const checkIn = await call(page, "POST", `/api/v1/app/appointments/${overdue!.id}/check-in`);
    expect(checkIn.status, checkIn.text).toBe(200);
    await openBoard(page, "missed-appointment", overdue!.patientCode, day);
    await expect(page.locator(`.cskh-table tbody tr[data-row-key="${task!.id}"]`)).toHaveCount(0, { timeout: 15_000 });
  });
});

test.describe("CSKH › Lịch hẹn hủy, Complain (bug list #16)", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
  });

  test("a cancel needs a reason, and the cancelled booking is listed with it under Lịch hẹn hủy", async ({ page }) => {
    const patient = await newPatient(page, null);
    const start = new Date(Date.now() + 24 * 3600_000);
    start.setMinutes(0, 0, 0);
    const appointmentId = await book(page, patient.id, start);
    const cancelUrl = `/api/v1/app/appointments/${appointmentId}/cancel`;

    // No reason, or a blank one: refused, and the booking stays on the book.
    for (const body of [{ reason: 1 }, { reason: 1, note: "   " }]) {
      const refused = await call(page, "POST", cancelUrl, body);
      expect(refused.status, refused.text).toBeGreaterThanOrEqual(400);
      expect((refused.json as { error?: { code?: string } }).error?.code).toBe("BlueDental:Appointment:0004");
    }
    await openBoard(page, "cancelled-appointment", patient.name);
    await expect(page.getByText("Không có dữ liệu")).toBeVisible({ timeout: 15_000 });

    const reason = `E2E lý do hủy ${runId()}`;
    const cancelled = await call(page, "POST", cancelUrl, { reason: 1, note: ` ${reason} ` });
    expect(cancelled.status, cancelled.text).toBe(200);
    expect((cancelled.json as { cancellationNote: string }).cancellationNote).toBe(reason);

    // Windowed by the day it was cancelled — today — not by the slot given up.
    await openBoard(page, "cancelled-appointment", patient.name, new Date());
    await expect(page.getByRole("columnheader", { name: "Lý do hủy", exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Ngày hủy", exact: true })).toBeVisible();
    const row = page.locator(".cskh-table tbody tr.ant-table-row").filter({ hasText: patient.name });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await expect(row).toContainText(reason);
    await markContacted(page, patient.name);

    // Xuất Excel carries the cancel day and the reason.
    const cancelledSheet = await exportBoard(page);
    expect(cancelledSheet.filename).toMatch(/^cskh-lich-hen-huy-.*\.xlsx$/);
    const cancelledHeader = cancelledSheet.rows[0];
    expect(cancelledHeader.slice(0, 2)).toEqual(["Ngày hủy", "Lịch hẹn"]);
    const cancelledLine = cancelledSheet.rows.find((r) => r.includes(patient.name));
    expect(cancelledLine?.[cancelledHeader.indexOf("Lý do hủy")]).toBe(reason);
    expect(cancelledLine?.[cancelledHeader.indexOf("Trạng thái")]).toBe("Đã liên hệ");

    // The slot's own day is not the cancel day: nothing there.
    await openBoard(page, "cancelled-appointment", patient.name, start);
    await expect(page.getByText("Không có dữ liệu")).toBeVisible({ timeout: 15_000 });
  });

  test("a complaint is filed with its content and responsible staff, then handled", async ({ page }) => {
    const patient = await newPatient(page, null);
    const content = `E2E complain ${runId()}`;

    await page.goto("/cskh-grouping?tab=care&page=complaint&care_dateMode=day");
    await assertRealApiTraffic(page, `${CARE}/stats`);
    await expect(page.getByRole("button", { name: "Complain", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Tạo mới" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Tạo công việc mới" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Ngày ghi nhận")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "+3 tháng" })).toHaveCount(0);

    // The floating label sits beside the combobox, not inside it.
    const picker = (label: string) =>
      dialog.locator("div").filter({ has: page.getByRole("combobox"), hasText: label }).last().getByRole("combobox");
    await picker("Chọn khách hàng").click();
    await page.locator("#ss-portal-dropdown .ss-search-input").fill(patient.name);
    await page.locator("#ss-portal-dropdown").getByRole("option", { name: new RegExp(patient.name) }).click();

    // A patient alone is not a complaint: the content is required.
    const save = dialog.getByRole("button", { name: "Lưu" });
    await expect(save).toBeDisabled();
    await picker("Nhân viên phụ trách").click();
    const staffOption = page.locator("#ss-portal-dropdown").getByRole("option").first();
    const staffName = ((await staffOption.textContent()) ?? "").trim();
    await staffOption.click();
    await dialog.getByRole("textbox", { name: "Nội dung complain" }).fill(content);

    const created = page.waitForResponse((res) => res.url().endsWith(CARE) && res.request().method() === "POST");
    await save.click();
    expect((await created).status()).toBe(200);
    await expect(page.getByText("Đã tạo công việc chăm sóc")).toBeVisible();

    // Persisted: after a reload the row carries the content and the staff.
    await page.reload();
    await search(page, patient.name);
    const row = page.locator(".cskh-table tbody tr.ant-table-row").filter({ hasText: patient.name });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await expect(row.locator("textarea.cskh-note-input")).toHaveValue(content);
    if (staffName) await expect(row).toContainText(staffName);

    // Handled: Thành công through the result dialog, and it sticks.
    await row.locator("button.cskh-action--care").click();
    const result = page.getByRole("dialog").filter({ hasText: patient.name });
    await expect(result).toBeVisible();
    await result.getByRole("checkbox", { name: "Thành công" }).click();
    await result.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã lưu kết quả chăm sóc")).toBeVisible();

    await page.reload();
    await search(page, patient.name);
    await expect(row).toContainText("Thành công", { timeout: 15_000 });

    // Xuất Excel carries the complaint, who handles it and how it ended.
    const sheet = await exportBoard(page);
    expect(sheet.filename).toMatch(/^cskh-complain-.*\.xlsx$/);
    const header = sheet.rows[0];
    expect(header[0]).toBe("Ngày ghi nhận");
    const line = sheet.rows.find((r) => r.includes(patient.name));
    expect(line?.[header.indexOf("Nội dung")]).toBe(content);
    expect(line?.[header.indexOf("Kết quả xử lý")]).toBe("Thành công");
    if (staffName) expect(line?.[header.indexOf("NV phụ trách")]).toBe(staffName);
  });
});
