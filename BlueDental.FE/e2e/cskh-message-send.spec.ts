import { expect, test, type Browser, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";
import { openShiftCovering } from "./fixtures/workShift";

/**
 * Feature: CSKH ▸ Gửi tin nhắn (F-77, BA P2110 + "3 · Gửi tin nhắn" layout).
 * One channel and one template per send; customers from a CSKH tab over the
 * period or picked one by one (Khách lẻ); customers with no contact or a
 * missing variable are skipped and named; the 30-day guard; Xóa / Hoàn tác;
 * Hẹn giờ gửi and Huỷ hẹn; Gửi thử tới tôi; SMS shown as not connected; the
 * entries from the board and from the template list; cskhSend read / create;
 * branch scope.
 *
 * Real login screen, real API, real PostgreSQL, the real send job; nothing is
 * intercepted. Zalo itself is the local stub (e2e/fixtures/zalo-stub.mjs) the
 * host's Zalo endpoints point at — never the real OA — so the whole spec runs
 * only with E2E_ZALO_STUB=1, on a local database. When BD-001 has no live
 * connection it is linked to the stub through the real connect flow and
 * unlinked after. Templates and patients carry a run id and stay behind.
 */

const SENDS = "/api/v1/app/message-sends";
const TEMPLATES = "/api/v1/app/message-templates";
const ZALO = "/api/v1/app/zalo";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";
const STUB_URL = process.env.E2E_ZALO_STUB_URL ?? "http://127.0.0.1:5199";
const PASSWORD = "GuiTin@123456";
const CHANNEL = { Sms: 0, Zalo: 1 } as const;
const BATCH = { Completed: 2, Cancelled: 3 } as const;
const CARE_APPOINTMENT_REMINDER = 3;
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
  skippedCount: number;
  sentCount: number;
  failedCount: number;
}

interface Template {
  id: string;
  name: string;
  status: number;
}

const toast = (page: Page, text: string | RegExp) => page.locator("[data-sonner-toast]", { hasText: text });
const customerRow = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });
const stat = (page: Page, tone: string) => page.locator(`.snd-stat--${tone}`);
const cta = (page: Page) => page.locator(".snd-cta");
const templateTrigger = (page: Page) => page.getByRole("button", { name: /^Chọn mẫu từ danh sách mẫu/ });
const skipRecentBox = (page: Page) =>
  page.getByRole("checkbox", { name: "Không gửi lại cho khách đã nhận mẫu này trong 30 ngày" });

/** dd/mm/yyyy and yyyy-mm-dd of the same local day. */
function days(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const [y, m, d] = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())];
  return { shown: `${d}/${m}/${y}`, iso: `${y}-${m}-${d}` };
}

function tomorrowAt(hour: number): Date {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  day.setHours(hour, 0, 0, 0);
  return day;
}

/** An approved ZNS template (#301001 on the stub) for Nhắc lịch hẹn, every parameter mapped. */
async function zaloTemplate(page: Page, name: string): Promise<Template> {
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

async function newPatient(page: Page): Promise<Patient> {
  const suffix = runId() + String(Math.floor(Math.random() * 90 + 10));
  const firstName = `Gửi ${suffix}`;
  const phone = `09${suffix.padStart(8, "0").slice(-8)}`;
  const res = await call<{ id: string }>(page, "/api/v1/app/patients", {
    ...asBranchOne,
    method: "POST",
    json: { firstName, lastName: "E2E", dateOfBirth: null, gender: "female", phoneNumber: phone },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { id: res.body.id, name: `E2E ${firstName}`, phone };
}

/** Books the patient at `start` with the first dentist free then. */
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
        chiefComplaint: `e2e gửi tin ${runId()}`,
      },
    });
    if (res.status === 200) return;
  }
  throw new Error("no dentist could take the e2e booking");
}

/** ZNS sends the stub took for this phone (Zalo gets it as 84…, so the tail is compared). */
async function znsSendsTo(phone: string): Promise<{ body: string }[]> {
  const calls = (await (await fetch(`${STUB_URL}/__calls`)).json()) as { path: string; body: string }[];
  return calls.filter((c) => c.path === "/message/template" && c.body.includes(phone.slice(1)));
}

async function openSend(page: Page, query: string): Promise<void> {
  const loaded = assertRealApiTraffic(page, `${SENDS}/templates`);
  await page.goto(`/cskh-grouping/send?branch=BD-001&${query}`);
  await loaded;
}

/** Khách lẻ: find the customer by name in the picker and add them. */
async function addCustomer(page: Page, name: string): Promise<void> {
  await page.locator(".snd-picker .ss-trigger").click();
  const dropdown = page.locator("#ss-portal-dropdown");
  await dropdown.locator(".ss-search-input").fill(name);
  await dropdown.getByRole("option", { name: new RegExp(name) }).click();
  await expect(customerRow(page, name)).toHaveCount(1, { timeout: 15_000 });
}

async function pickTemplate(page: Page, name: string): Promise<void> {
  await templateTrigger(page).click();
  await page.getByRole("searchbox", { name: /^Tìm mẫu/ }).fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
  await expect(templateTrigger(page)).toContainText(name);
}

/** Confirms the CTA's dialog; resolves with the batch the server queued. */
async function confirmSend(page: Page): Promise<Batch> {
  const dialog = page.getByRole("dialog").filter({ hasText: "Xác nhận gửi tin" });
  await expect(dialog).toBeVisible();
  const created = page.waitForResponse((res) => new URL(res.url()).pathname === SENDS && res.request().method() === "POST");
  await dialog.getByRole("button", { name: /Có$/ }).click();
  const res = await created;
  expect(res.status()).toBe(200);
  return (await res.json()) as Batch;
}

async function batchOf(page: Page, id: string): Promise<Batch> {
  return (await call<Batch>(page, `${SENDS}/${id}`, asBranchOne)).body;
}

/** A throw-away role holding just `grants`, and a staff member of BD-001 in it. */
async function makeStaff(page: Page, grants: string[], phoneNumber: string | null = null) {
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
  return { credentials: { userName, password: PASSWORD }, tearDown };
}

async function openSession(browser: Browser, credentials: { userName: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);
  return { context, page };
}

test.describe("CSKH — Gửi tin nhắn (Zalo giả lập)", () => {
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

  test("Khách lẻ: gửi Zalo qua giả lập, bỏ qua khách thiếu biến, rồi chống gửi trùng 30 ngày", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E Gửi lẻ ${runId()}`);
    const booked = await newPatient(page);
    const unbooked = await newPatient(page);
    await book(page, booked.id, tomorrowAt(10));

    await openSend(page, `channel=zalo&templateId=${template.id}&to=individual`);
    await expect(page.getByRole("radiogroup", { name: "Kênh gửi" }).getByRole("radio", { name: /^Zalo/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(templateTrigger(page)).toContainText(template.name);
    await expect(cta(page)).toHaveText("Chọn khách để gửi");
    await expect(cta(page)).toBeDisabled();

    await addCustomer(page, booked.name);
    await addCustomer(page, unbooked.name);

    const ready = customerRow(page, booked.name);
    await expect(ready.getByRole("checkbox", { name: `Chọn ${booked.name}` })).toBeChecked();
    await expect(ready).toContainText("Chưa nhận");
    // No booking: {ngay_hen} / {gio_hen} explain the gap, so the ZNS
    // parameters they fill are not named again, and no raw key leaks (the
    // ZNS preview lists parameter names on purpose, so only rows and checks).
    await expect(customerRow(page, unbooked.name).locator(".snd-row-missing")).toHaveText("Thiếu Ngày hẹn, Giờ hẹn");
    await expect(page.getByText(/CSKH:/)).toHaveCount(0);
    await expect(page.getByText(/^Thiếu .*booking_/)).toHaveCount(0);

    await expect(stat(page, "total")).toHaveText("2 khách");
    await expect(stat(page, "fresh")).toHaveText("1 chưa nhận mẫu này");
    await expect(stat(page, "missing")).toHaveText("1 thiếu dữ liệu biến");
    await expect(page.getByLabel("Kiểm tra trước khi gửi").getByText("1 khách sẽ nhận")).toBeVisible();
    await expect(cta(page)).toHaveText("Gửi 1 tin Zalo");

    await cta(page).click();
    const batch = await confirmSend(page);
    expect(batch).toMatchObject({ recipientCount: 1, skippedCount: 1 });
    await expect(toast(page, "Đã bắt đầu gửi 1 tin Zalo")).toBeVisible();

    // The send job picks the batch up within seconds.
    await expect
      .poll(async () => (await batchOf(page, batch.id)).status, { timeout: 60_000, intervals: [2_000] })
      .toBe(BATCH.Completed);
    expect(await batchOf(page, batch.id)).toMatchObject({ sentCount: 1, failedCount: 0, skippedCount: 1 });

    const [sent, ...again] = await znsSendsTo(booked.phone);
    expect(again).toEqual([]);
    expect(JSON.parse(sent.body)).toMatchObject({
      template_id: "301001",
      template_data: { customer_name: booked.name, promo_note: "Nhớ mang theo sổ khám" },
    });
    expect(await znsSendsTo(unbooked.phone)).toEqual([]);

    // Picks live in the page, not the URL: after a reload the customer is
    // added again and now shows the receipt, so the 30-day guard holds them.
    await page.reload();
    await addCustomer(page, booked.name);
    await expect(customerRow(page, booked.name)).toContainText(/Đã nhận \d{2}\/\d{2}\/\d{4}/);
    await expect(stat(page, "received")).toHaveText("1 đã nhận mẫu này");
    await expect(page.getByLabel("Kiểm tra trước khi gửi").getByText("1 đã nhận mẫu này")).toBeVisible();
    await expect(cta(page)).toHaveText("Không có khách để gửi");
    await expect(cta(page)).toBeDisabled();

    await skipRecentBox(page).uncheck();
    await expect(page.getByText("Đang tắt: khách có thể nhận trùng")).toBeVisible();
    await expect(cta(page)).toHaveText("Gửi 1 tin Zalo");
    await expect(cta(page)).toBeEnabled();
  });

  test("Danh sách CSKH: mở từ Nhắc lịch hẹn, Xóa / Hoàn tác, Hẹn giờ gửi rồi Huỷ hẹn — không tin nào đi", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E Gửi hẹn ${runId()}`);
    const patient = await newPatient(page);
    const start = tomorrowAt(10);
    await book(page, patient.id, start);
    const day = days(start);

    const counted = assertRealApiTraffic(page, "/api/v1/app/care-records/stats");
    await page.goto(`/cskh-grouping?tab=care&page=remind-appointment&care_dateMode=day&care_date=${day.iso}&branch=BD-001`);
    await counted;
    await page.getByRole("button", { name: "Gửi tin nhắn chăm sóc" }).click();

    await expect(page).toHaveURL(/\/cskh-grouping\/send\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("channel")).toBe("zalo");
    expect(url.searchParams.get("page")).toBe("remind-appointment");
    expect(url.searchParams.get("care_date")).toBe(day.iso);
    const lists = page.getByRole("radiogroup", { name: "Chọn 1 danh sách chăm sóc" });
    await expect(lists.getByRole("radio", { name: /^Nhắc lịch hẹn/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("button", { name: "Danh sách CSKH", exact: true })).toHaveAttribute("aria-pressed", "true");

    await pickTemplate(page, template.name);
    await page.getByRole("searchbox", { name: "Tìm khách" }).fill(patient.name);
    const row = customerRow(page, patient.name);
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await expect(row).toContainText("Chưa nhận");

    await row.getByRole("button", { name: `Xóa ${patient.name}` }).click();
    const remove = page.getByRole("dialog").filter({ hasText: "Xóa khách khỏi lần gửi" });
    await expect(remove).toContainText("Bạn có chắc chắn muốn xóa khách hàng này ra khỏi danh sách chăm sóc");
    await remove.getByRole("button", { name: /Xóa$/ }).click();
    await expect(row).toHaveCount(0);
    await page.getByRole("button", { name: "Hoàn tác 1 khách đã xóa" }).click();
    await expect(row).toHaveCount(1);
    await page.getByRole("searchbox", { name: "Tìm khách" }).fill("");

    // Ticking proposes the next full hour; moved to tomorrow, the job cannot fire first.
    await page.getByRole("checkbox", { name: "Hẹn giờ gửi" }).check();
    const date = page.locator(".snd-schedule-fields .ant-picker input").first();
    await date.click({ position: { x: 4, y: 8 } });
    await date.pressSequentially(days(tomorrowAt(0)).shown.replace(/\D/g, ""));
    await date.press("Enter");
    await expect(date).toHaveValue(days(tomorrowAt(0)).shown);
    await expect(cta(page)).toHaveText(/^Hẹn gửi \d+ tin Zalo$/);

    await cta(page).click();
    await expect(page.getByRole("dialog").filter({ hasText: "Xác nhận gửi tin" })).toContainText(`“${template.name}” lúc`);
    const batch = await confirmSend(page);
    await expect(toast(page, /Đã hẹn gửi \d+ tin Zalo lúc/)).toBeVisible();

    const queued = page.locator(".snd-queued-item").filter({ hasText: template.name });
    await expect(queued).toContainText("Gửi lúc");
    await queued.getByRole("button", { name: "Huỷ hẹn" }).click();
    const cancel = page.getByRole("dialog").filter({ hasText: "Huỷ lần gửi đã hẹn" });
    await cancel.getByRole("button", { name: /Có$/ }).click();
    await expect(toast(page, "Đã huỷ lần gửi đã hẹn")).toBeVisible();
    await expect(queued).toHaveCount(0);

    expect((await batchOf(page, batch.id)).status).toBe(BATCH.Cancelled);
    expect(await znsSendsTo(patient.phone)).toEqual([]);
  });

  test("Gửi thử tới tôi: đi tới SĐT của tài khoản; tài khoản chưa có SĐT thì báo lỗi", async ({ page, browser }) => {
    const template = await zaloTemplate(page, `E2E Gửi thử ${runId()}`);
    const patient = await newPatient(page);
    await book(page, patient.id, tomorrowAt(11));
    const grants = ["BlueDental.cskhSend.read", "BlueDental.cskhSend.create"];
    const myPhone = `08${runId()}${String(Math.floor(Math.random() * 90 + 10))}`;
    const withPhone = await makeStaff(page, grants, myPhone);
    const withoutPhone = await makeStaff(page, grants);

    try {
      const mine = await openSession(browser, withPhone.credentials);
      await openSend(mine.page, `channel=zalo&templateId=${template.id}&to=individual`);
      await addCustomer(mine.page, patient.name);
      await mine.page.getByRole("button", { name: "Gửi thử Zalo tới tôi" }).click();
      await expect(toast(mine.page, /^Đã gửi thử tới /)).toBeVisible();
      const [sample] = await znsSendsTo(myPhone);
      expect(JSON.parse(sample.body)).toMatchObject({ template_id: "301001", template_data: { customer_name: patient.name } });
      expect(await znsSendsTo(patient.phone)).toEqual([]);
      await mine.context.close();

      const none = await openSession(browser, withoutPhone.credentials);
      await openSend(none.page, `channel=zalo&templateId=${template.id}&to=individual`);
      await addCustomer(none.page, patient.name);
      await none.page.getByRole("button", { name: "Gửi thử Zalo tới tôi" }).click();
      await expect(toast(none.page, "Tài khoản của bạn chưa có số điện thoại để gửi thử.")).toBeVisible();
      await none.context.close();
    } finally {
      await withPhone.tearDown();
      await withoutPhone.tearDown();
    }
  });

  test("SMS chưa kết nối gửi; Dùng mẫu này để gửi chọn sẵn kênh và mẫu", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E Gửi từ mẫu ${runId()}`);

    await openSend(page, "channel=sms&to=individual");
    const sms = page.getByRole("radiogroup", { name: "Kênh gửi" }).getByRole("radio", { name: /^SMS/ });
    await expect(sms).toHaveAttribute("aria-checked", "true");
    await expect(sms).toContainText("Chưa kết nối gửi");
    await expect(page.getByRole("list").getByText("Kênh SMS chưa kết nối gửi")).toBeVisible();
    await expect(cta(page)).toHaveText("Kênh SMS chưa kết nối gửi");
    await expect(cta(page)).toBeDisabled();
    await expect(page.getByRole("button", { name: "Gửi thử SMS tới tôi" })).toBeDisabled();

    await page.goto("/cskh-grouping?tab=template&branch=BD-001");
    const listed = page.waitForResponse((res) => new URL(res.url()).searchParams.get("filter") === template.name);
    await page.getByLabel("Tìm theo tên mẫu hoặc nội dung").fill(template.name);
    await listed;
    await page.locator("tr.tpl-row", { hasText: template.name }).click();
    await page
      .locator(`aside.tpl-preview-card[aria-label="${template.name}"]`)
      .getByRole("button", { name: "Dùng mẫu này để gửi" })
      .click();

    await expect(page).toHaveURL(/\/cskh-grouping\/send\?/);
    expect(new URL(page.url()).searchParams.get("templateId")).toBe(template.id);
    await expect(page.getByRole("radiogroup", { name: "Kênh gửi" }).getByRole("radio", { name: /^Zalo/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(templateTrigger(page)).toContainText(template.name);
  });

  test("quyền cskhSend: không có thì không thấy nút và không vào được; chỉ xem thì không gửi được", async ({ page, browser }) => {
    const template = await zaloTemplate(page, `E2E Gửi quyền ${runId()}`);
    const patient = await newPatient(page);
    const start = tomorrowAt(14);
    await book(page, patient.id, start);
    const board = `/cskh-grouping?tab=care&page=remind-appointment&care_dateMode=day&care_date=${days(start).iso}&branch=BD-001`;
    const careOnly = await makeStaff(page, ["BlueDental.cskhCare.read"]);
    const readOnly = await makeStaff(page, ["BlueDental.cskhCare.read", "BlueDental.cskhSend.read"]);

    try {
      const care = await openSession(browser, careOnly.credentials);
      await care.page.goto(board);
      await care.page.getByRole("textbox", { name: "Tìm kiếm" }).fill(patient.name);
      const row = care.page.locator(".cskh-table tbody tr.ant-table-row").filter({ hasText: patient.name });
      await expect(row).toHaveCount(1, { timeout: 15_000 });
      await expect(row.getByRole("button", { name: /^Gửi (SMS|Zalo)$/ })).toHaveCount(0);
      await expect(care.page.getByRole("button", { name: "Gửi tin nhắn chăm sóc" })).toHaveCount(0);
      await care.page.goto("/cskh-grouping/send?branch=BD-001&channel=zalo");
      await expect(care.page.getByText("Không có quyền truy cập")).toBeVisible();
      expect((await call(care.page, `${SENDS}/templates`, asBranchOne)).status).toBe(403);
      await care.context.close();

      const reader = await openSession(browser, readOnly.credentials);
      await openSend(reader.page, `channel=zalo&templateId=${template.id}&to=individual`);
      await addCustomer(reader.page, patient.name);
      await expect(cta(reader.page)).toHaveCount(0);
      await expect(reader.page.getByRole("button", { name: /^Gửi thử/ })).toHaveCount(0);
      const input = { channel: CHANNEL.Zalo, templateId: template.id, source: 1, patientIds: [patient.id] };
      expect((await call(reader.page, SENDS, { ...asBranchOne, method: "POST", json: input })).status).toBe(403);
      expect(
        (await call(reader.page, `${SENDS}/test`, { ...asBranchOne, method: "POST", json: { templateId: template.id } })).status,
      ).toBe(403);
      await reader.context.close();
    } finally {
      await careOnly.tearDown();
      await readOnly.tearDown();
    }
    expect(await znsSendsTo(patient.phone)).toEqual([]);
  });

  test("chi nhánh: mẫu của chi nhánh khác không được liệt kê và không dùng để gửi được", async ({ page }) => {
    const ours = await zaloTemplate(page, `E2E Gửi CN1 ${runId()}`);
    const theirsName = `E2E Gửi CN2 ${runId()}`;
    const theirs = await call<Template>(page, TEMPLATES, {
      branchId: BRANCH_TWO,
      method: "POST",
      json: {
        publish: false,
        channel: CHANNEL.Sms,
        name: theirsName,
        purpose: CARE_APPOINTMENT_REMINDER,
        content: "Chào {ten_khach_hang}",
        subject: null,
        externalTemplateId: null,
        paramMap: null,
        removeDiacritics: false,
      },
    });
    expect(theirs.status, JSON.stringify(theirs.body)).toBe(200);

    const namesIn = async (branchId: string) =>
      (await call<{ items: Template[] }>(page, `${SENDS}/templates`, { branchId })).body.items.map((item) => item.name);
    expect(await namesIn(BRANCH_ONE)).toContain(ours.name);
    expect(await namesIn(BRANCH_ONE)).not.toContain(theirsName);
    expect(await namesIn(BRANCH_TWO)).toContain(theirsName);
    expect(await namesIn(BRANCH_TWO)).not.toContain(ours.name);

    // BD-001's template cannot be sent from the other branch.
    const patient = await newPatient(page);
    const crossed = await call(page, SENDS, {
      branchId: BRANCH_TWO,
      method: "POST",
      json: { channel: CHANNEL.Zalo, templateId: ours.id, source: 1, patientIds: [patient.id] },
    });
    expect(crossed.status).not.toBe(200);
    expect(await znsSendsTo(patient.phone)).toEqual([]);
  });
});
