import { readFileSync } from "node:fs";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";
import { openShiftCovering } from "./fixtures/workShift";

/**
 * Feature: Tổng quan ▸ Thống kê CSKH (F-78, BA P2110 img_31 / img_32).
 * The sub-menu beside the old dashboard; this month by default; KPI tiles,
 * Theo kênh, Hiệu suất theo mẫu, Lịch sử gửi and Người nhận counted from what
 * the send job really did; Kênh / Mẫu filters, recipient search, outcome and
 * sort; the Excel; a scheduled send that is called off; cskhStats read /
 * export; branch scope.
 *
 * Real login screen, real API, real PostgreSQL, the real send job; nothing is
 * intercepted. Zalo is the local stub (e2e/fixtures/zalo-stub.mjs), which
 * refuses every number starting 0399, so one customer of a send fails for
 * real. Runs only with E2E_ZALO_STUB=1, on a local database. The month holds
 * other runs' sends, so every figure is read with the run's own template
 * picked in Mẫu.
 */

const SENDS = "/api/v1/app/message-sends";
const STATS = "/api/v1/app/message-stats";
const TEMPLATES = "/api/v1/app/message-templates";
const ZALO = "/api/v1/app/zalo";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";
const PASSWORD = "ThongKe@123456";
const CHANNEL = { Zalo: 1 } as const;
const SOURCE_INDIVIDUAL = 1;
const BATCH = { Completed: 2, Cancelled: 3 } as const;
const CARE_APPOINTMENT_REMINDER = 3;
const STATS_PAGE = "/dashboard/cskh?branch=BD-001";
const asBranchOne = { branchId: BRANCH_ONE };

interface Patient {
  id: string;
  name: string;
  phone: string;
}

interface Batch {
  id: string;
  status: number;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const shown = (date: Date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
const iso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const card = (page: Page, title: string) =>
  page.locator("section.cskh-stats-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const kpi = (page: Page, label: string) =>
  page.locator(".kpi-card").filter({ has: page.locator(".kpi-card-label").getByText(label, { exact: true }) });
const rowsOf = (section: Locator) => section.locator("tbody tr.ant-table-row");
const rowOf = (section: Locator, text: string) => rowsOf(section).filter({ hasText: text });

function tomorrowAt(hour: number): Date {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  day.setHours(hour, 0, 0, 0);
  return day;
}

/** An approved ZNS template (#301001 on the stub) for Nhắc lịch hẹn, every parameter mapped. */
async function zaloTemplate(page: Page, name: string): Promise<{ id: string; name: string }> {
  const res = await call<{ id: string; name: string; status: number }>(page, TEMPLATES, {
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

/** A customer of BD-001; `prefix` "0399" gives a number the stub refuses. */
async function newPatient(page: Page, label: string, prefix: "09" | "0399"): Promise<Patient> {
  const suffix = runId() + String(Math.floor(Math.random() * 90 + 10));
  const firstName = `${label} ${suffix}`;
  const phone = prefix + suffix.padStart(10, "0").slice(-(10 - prefix.length));
  const res = await call<{ id: string }>(page, "/api/v1/app/patients", {
    ...asBranchOne,
    method: "POST",
    json: { firstName, lastName: "E2E TK", dateOfBirth: null, gender: "female", phoneNumber: phone },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { id: res.body.id, name: `E2E TK ${firstName}`, phone };
}

/**
 * Books the patient at `start` with the first dentist on shift then, so {ngay_hen} / {gio_hen}
 * fill. Runs on the same day fill the dentists' slots, so the double-booking warning is
 * confirmed the way the dialog's Xác nhận does (R-971).
 */
async function book(page: Page, patientId: string, start: Date): Promise<void> {
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
        chiefComplaint: `e2e thống kê ${runId()}`,
        allowDentistOverlap: true,
      },
    });
    if (res.status === 200) return;
  }
  throw new Error("no dentist could take the e2e booking");
}

/** Khách lẻ through the real send endpoint; `scheduledAt` books it instead. */
async function sendTo(page: Page, templateId: string, patients: Patient[], scheduledAt: Date | null = null): Promise<Batch> {
  const res = await call<Batch>(page, SENDS, {
    ...asBranchOne,
    method: "POST",
    json: {
      channel: CHANNEL.Zalo,
      templateId,
      source: SOURCE_INDIVIDUAL,
      patientIds: patients.map((patient) => patient.id),
      skipRecentDuplicates: false,
      scheduledAt: scheduledAt?.toISOString() ?? null,
    },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

/** Waits for the send job to finish the batch. */
async function finished(page: Page, id: string): Promise<Batch> {
  await expect
    .poll(async () => (await call<Batch>(page, `${SENDS}/${id}`, asBranchOne)).body.status, {
      timeout: 60_000,
      intervals: [2_000],
    })
    .toBe(BATCH.Completed);
  return (await call<Batch>(page, `${SENDS}/${id}`, asBranchOne)).body;
}

/** Mẫu: the run's own template, found by typing, so the month's other sends drop out. */
async function pickTemplate(page: Page, name: string): Promise<void> {
  const select = page.getByRole("combobox", { name: "Mẫu" });
  await select.click();
  await select.fill(name);
  await page.locator(".ant-select-item-option").filter({ hasText: name }).click();
  await expect(page.locator(".cskh-stats-template")).toContainText(name);
}

/** A throw-away role holding just `grants`, and a staff member of BD-001 in it. */
async function makeStaff(page: Page, grants: string[]) {
  const id = runId() + String(Math.floor(Math.random() * 90 + 10));
  const roleName = `Thống kê ${id}`;
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

  const userName = `thongke${id}`;
  const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
    method: "POST",
    json: {
      userName,
      password: PASSWORD,
      name: `Nhân viên thống kê ${id}`,
      email: `${userName}@bluedental.local`,
      phoneNumber: null,
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
  return { credentials: { userName, password: PASSWORD }, tearDown };
}

async function openSession(browser: Browser, credentials: { userName: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);
  return { context, page };
}

test.describe("Tổng quan ▸ Thống kê CSKH (Zalo giả lập)", () => {
  test.skip(!process.env.E2E_ZALO_STUB, "cần host trỏ Zalo về e2e/fixtures/zalo-stub.mjs (E2E_ZALO_STUB=1)");
  test.describe.configure({ timeout: 180_000 });

  let linkedHere = false;

  // Linked the way a manager links the real OA: the signed state from
  // connect-url comes back on Zalo's redirect, and the stub takes any code.
  test.beforeEach(async ({ page }) => {
    await login(page);
    const status = await call<{ isConnected: boolean }>(page, `${ZALO}/status`, asBranchOne);
    linkedHere = !status.body.isConnected;
    if (!linkedHere) return;

    const connect = await call<{ url: string }>(page, `${ZALO}/connect-url`, asBranchOne);
    expect(connect.status, "connect-url needs the host's Zalo app credentials").toBe(200);
    const state = new URL(connect.body.url).searchParams.get("state") ?? "";
    const callback = await page.request.get(`${ZALO}/oauth/callback`, {
      params: { code: "stub-code", state },
      maxRedirects: 0,
    });
    expect(callback.headers().location).toContain("zalo=connected");
  });

  test.afterEach(async ({ page }) => {
    if (!linkedHere) return;
    const unlinked = await call(page, `${ZALO}/connection`, { ...asBranchOne, method: "DELETE" });
    expect(unlinked.status, "unlink the stub OA").toBe(204);
  });

  test("một lần gửi Zalo — 1 thành công, 1 bị từ chối — hiện đúng ở mọi khối; lọc, tìm, sắp xếp và Excel theo bộ lọc", async ({
    page,
  }) => {
    const template = await zaloTemplate(page, `E2E TK gửi ${runId()}`);
    const reached = await newPatient(page, "A nhận", "09");
    const refused = await newPatient(page, "B lỗi", "0399");
    await book(page, reached.id, tomorrowAt(15));
    await book(page, refused.id, tomorrowAt(16));
    const batch = await finished(page, (await sendTo(page, template.id, [reached, refused])).id);
    expect(batch).toMatchObject({ recipientCount: 2, sentCount: 1, failedCount: 1 });

    // Tổng quan is a group of two now: the old dashboard, then Thống kê CSKH.
    await page.goto("/reception?branch=BD-001");
    await page.locator('.app-nav-group[title="Tổng quan"]').click();
    await expect(page.locator(".app-ribbon .app-ribbon-item")).toHaveText(["Tổng quan", "Thống kê CSKH"]);
    const overview = page.waitForResponse((res) => new URL(res.url()).pathname === `${STATS}/overview`);
    await page.locator('.app-ribbon-item[title="Thống kê CSKH"]').click();
    await expect(page).toHaveURL(/\/dashboard\/cskh/);

    // BA: this month up to today by default, compared with the period before.
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const asked = new URL((await overview).url()).searchParams;
    expect(asked.get("fromDate")).toBe(iso(first));
    expect(asked.get("toDate")).toBe(iso(today));
    expect(asked.get("compareFromDate"), "So sánh kỳ trước is on by default").not.toBeNull();
    const period = today.getDate() === 1 ? shown(today) : `${shown(first)} – ${shown(today)}`;
    await expect(page.getByRole("button", { name: `Thời gian: ${period}` })).toContainText("Theo ngày");

    await pickTemplate(page, template.name);
    await expect(kpi(page, "Tin đã gửi").locator(".kpi-card-value")).toHaveText("2");
    await expect(kpi(page, "Gửi thành công").locator(".kpi-card-value")).toHaveText(/^50\s?%$/);
    await expect(kpi(page, "Gửi thành công").locator(".kpi-card-sub")).toHaveText("1 tin");
    await expect(kpi(page, "Thất bại").locator(".kpi-card-value")).toHaveText("1");
    await expect(kpi(page, "Thất bại").locator(".kpi-card-sub")).toHaveText(/^50\s?% số tin đã gửi$/);

    const zalo = page.locator(".cskh-stats-channel").filter({ hasText: "Zalo" });
    await expect(zalo.locator(".cskh-stats-channel-count")).toHaveText("2 tin");
    await expect(zalo.locator(".cskh-stats-channel-sub")).toHaveText(/^Thành công 50\s?%$/);

    const used = rowOf(card(page, "Hiệu suất theo mẫu"), template.name);
    await expect(used).toHaveCount(1);
    await expect(used).toContainText("1 chiến dịch");
    await expect(used).toContainText(shown(today));

    const history = card(page, "Lịch sử gửi");
    await expect(rowsOf(history)).toHaveCount(1);
    await expect(rowsOf(history)).toContainText("Khách lẻ");
    await expect(rowsOf(history)).toContainText("1 thành công · 1 lỗi");
    await expect(rowsOf(history)).toContainText("Hoàn tất");

    const recipients = card(page, "Người nhận");
    await expect(rowsOf(recipients)).toHaveCount(2);
    await expect(rowOf(recipients, reached.name)).toContainText("Đã nhận");
    await expect(rowOf(recipients, refused.name)).toContainText("Thất bại");
    // The provider's own refusal, as Zalo worded it.
    await expect(rowOf(recipients, refused.name)).toContainText("Phone number is invalid (-108)");

    // Sorted on the server by name, both ways.
    const names = () => rowsOf(recipients).locator("td:first-child").allTextContents();
    await recipients.getByRole("columnheader", { name: "Khách hàng" }).click();
    await expect.poll(names).toEqual([reached.name, refused.name]);
    await recipients.getByRole("columnheader", { name: "Khách hàng" }).click();
    await expect.poll(names).toEqual([refused.name, reached.name]);

    // A phone typed as the clinic writes it (0…) finds the message Zalo got as 84….
    const search = recipients.getByRole("textbox", { name: "Tên hoặc SĐT" });
    await search.fill(refused.phone);
    await expect(rowsOf(recipients)).toHaveCount(1);
    await expect(rowsOf(recipients)).toContainText(refused.name);
    await search.fill("");
    await expect(rowsOf(recipients)).toHaveCount(2);
    await recipients.getByRole("combobox", { name: "Trạng thái" }).click();
    await page.locator(".ant-select-item-option").filter({ hasText: /^Thất bại$/ }).click();
    await expect(rowsOf(recipients)).toHaveCount(1);
    await expect(rowsOf(recipients)).toContainText(refused.name);

    // The Excel reads the same template, and the recipient search with it.
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Xuất báo cáo Excel" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^thong-ke-cskh-\d{8}-\d{4}\.xlsx$/);
    const workbook = XLSX.read(readFileSync(await file.path()), { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["Theo ngày", "Theo mẫu", "Lịch sử gửi", "Người nhận"]);
    const cells = (sheet: string) =>
      XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1 }).flat().map(String).join("\n");
    expect(cells("Theo mẫu")).toContain(template.name);
    expect(cells("Người nhận")).toContain(refused.name);
    expect(cells("Người nhận")).not.toContain(reached.name);

    // Another channel lets the Zalo template go: no block keeps its rows.
    await page.locator(".cskh-stats-channels").getByRole("button", { name: "SMS", exact: true }).click();
    await expect(page.locator(".cskh-stats-template")).toContainText("Tất cả mẫu");
    await expect(rowOf(card(page, "Hiệu suất theo mẫu"), template.name)).toHaveCount(0);
    await expect(rowOf(history, template.name)).toHaveCount(0);
  });

  test("Hẹn giờ gửi rồi huỷ: Lịch sử gửi ghi Đã hẹn giờ rồi Đã huỷ, Kết quả Chưa gửi, không tính là tin đã gửi", async ({
    page,
  }) => {
    const template = await zaloTemplate(page, `E2E TK hẹn ${runId()}`);
    const patient = await newPatient(page, "C hẹn", "09");
    await book(page, patient.id, tomorrowAt(15));
    const batch = await sendTo(page, template.id, [patient], tomorrowAt(9));

    await page.goto(STATS_PAGE);
    await pickTemplate(page, template.name);
    const history = card(page, "Lịch sử gửi");
    await expect(rowsOf(history)).toHaveCount(1);
    await expect(rowsOf(history)).toContainText("Đã hẹn giờ");
    await expect(rowsOf(history)).toContainText("Chưa gửi");
    await expect(rowOf(card(page, "Người nhận"), patient.name)).toContainText("Đã hẹn giờ");
    await expect(kpi(page, "Tin đã gửi").locator(".kpi-card-value")).toHaveText("0");

    const cancelled = await call<Batch>(page, `${SENDS}/${batch.id}/cancel`, { ...asBranchOne, method: "POST" });
    expect(cancelled.status).toBe(200);

    await page.reload();
    await pickTemplate(page, template.name);
    await expect(rowsOf(history)).toHaveCount(1);
    await expect(rowsOf(history)).toContainText("Đã huỷ");
    await expect(rowsOf(history)).toContainText("Chưa gửi");
    // The booked message went with the send: nobody is listed as reached.
    await expect(rowsOf(card(page, "Người nhận"))).toHaveCount(0);
    await expect(kpi(page, "Tin đã gửi").locator(".kpi-card-value")).toHaveText("0");
  });

  test("quyền cskhStats: không có thì không thấy mục và bị chặn; chỉ Xem thì không có Xuất Excel", async ({ page, browser }) => {
    const none = await makeStaff(page, ["BlueDental.cskhCare.read"]);
    const reader = await makeStaff(page, ["BlueDental.cskhStats.read"]);
    const range = `fromDate=${iso(new Date())}&toDate=${iso(new Date())}`;

    try {
      const stranger = await openSession(browser, none.credentials);
      await stranger.page.goto("/reception?branch=BD-001");
      await stranger.page.locator('.app-nav-group[title="Tổng quan"]').click();
      await expect(stranger.page.locator('.app-ribbon-item[title="Thống kê CSKH"]')).toHaveCount(0);
      await stranger.page.goto(STATS_PAGE);
      await expect(stranger.page.getByText("Không có quyền truy cập")).toBeVisible();
      expect((await call(stranger.page, `${STATS}/overview?${range}`, asBranchOne)).status).toBe(403);
      await stranger.context.close();

      const viewer = await openSession(browser, reader.credentials);
      await viewer.page.goto(STATS_PAGE);
      await expect(kpi(viewer.page, "Tin đã gửi")).toBeVisible();
      await expect(card(viewer.page, "Lịch sử gửi")).toBeVisible();
      await expect(viewer.page.getByRole("button", { name: "Xuất báo cáo Excel" })).toHaveCount(0);
      expect((await call(viewer.page, `${STATS}/overview?${range}`, asBranchOne)).status).toBe(200);
      expect((await call(viewer.page, `${STATS}/excel?${range}`, asBranchOne)).status).toBe(403);
      await viewer.context.close();
    } finally {
      await none.tearDown();
      await reader.tearDown();
    }
  });

  test("chi nhánh: lần gửi của BD-001 không lẫn vào số liệu, mẫu hay người nhận của chi nhánh khác", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E TK CN1 ${runId()}`);
    const patient = await newPatient(page, "D chi nhánh", "09");
    await book(page, patient.id, tomorrowAt(16));
    const batch = await finished(page, (await sendTo(page, template.id, [patient])).id);
    expect(batch.sentCount).toBe(1);

    const range = `fromDate=${iso(new Date())}&toDate=${iso(new Date())}`;
    const optionsIn = async (branchId: string) =>
      (await call<{ id: string }[]>(page, `${STATS}/templates`, { branchId })).body.map((option) => option.id);
    expect(await optionsIn(BRANCH_ONE)).toContain(template.id);
    expect(await optionsIn(BRANCH_TWO)).not.toContain(template.id);

    const batchIdsIn = async (branchId: string) =>
      (
        await call<{ items: { id: string }[] }>(page, `${STATS}/batches?${range}&MaxResultCount=100`, { branchId })
      ).body.items.map((item) => item.id);
    expect(await batchIdsIn(BRANCH_ONE)).toContain(batch.id);
    expect(await batchIdsIn(BRANCH_TWO)).not.toContain(batch.id);

    const reachedIn = async (branchId: string) =>
      (
        await call<{ totalCount: number }>(page, `${STATS}/recipients?${range}&filter=${encodeURIComponent(patient.name)}`, {
          branchId,
        })
      ).body.totalCount;
    expect(await reachedIn(BRANCH_ONE)).toBe(1);
    expect(await reachedIn(BRANCH_TWO)).toBe(0);

    // On screen in the other branch: neither the send nor the customer.
    await page.goto("/dashboard/cskh?branch=BD-002");
    await expect(card(page, "Lịch sử gửi")).toBeVisible();
    await expect(rowOf(card(page, "Lịch sử gửi"), template.name)).toHaveCount(0);
    const recipients = card(page, "Người nhận");
    await recipients.getByRole("textbox", { name: "Tên hoặc SĐT" }).fill(patient.name);
    await expect(recipients.getByText("Chưa có tin nhắn nào trong khoảng thời gian này.")).toBeVisible();
  });
});
