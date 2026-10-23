import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import {
  BATCH,
  BRANCH_ONE,
  BRANCH_TWO,
  CHANNEL,
  SENDS,
  TEMPLATES,
  ZALO,
  addCustomer,
  asBranchOne,
  batchOf,
  book,
  changeContact,
  confirmSend,
  cta,
  customerRow,
  days,
  expectCampaignList,
  linkStub,
  linkStubIfIdle,
  makeStaff,
  newPatient,
  openSend,
  openSession,
  pickTemplate,
  scheduleSend,
  secondsFromNow,
  setGrant,
  stubConfig,
  templateTrigger,
  toast,
  tomorrowAt,
  unlink,
  zaloTemplate,
  znsSendsTo,
  type Batch,
  type Template,
} from "./fixtures/messageSend";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: CSKH ▸ Gửi tin nhắn (F-77, BA P2110 + "3 · Gửi tin nhắn" layout).
 * One channel and one template per send; customers from a CSKH tab over the
 * period or picked one by one (Khách lẻ); customers with no contact or a
 * missing variable are skipped and named; the 30-day guard; Xóa / Hoàn tác;
 * Hẹn giờ gửi and Huỷ hẹn; Gửi thử tới tôi; SMS shown as not connected; the
 * entries from the board and from the template list; cskhSend read / create;
 * branch scope. After Gửi the screen hands over to Chiến dịch đã gửi (F-79).
 *
 * Real login screen, real API, real PostgreSQL, the real send job; nothing is
 * intercepted. Zalo itself is the local stub (e2e/fixtures/zalo-stub.mjs) the
 * host's Zalo endpoints point at — never the real OA — so the whole spec runs
 * only with E2E_ZALO_STUB=1, on a local database. When BD-001 has no live
 * connection it is linked to the stub through the real connect flow and
 * unlinked after. Templates and patients carry a run id and stay behind.
 */

declare global {
  interface Window {
    /** R-1017: the CTA states a MutationObserver saw. */
    ctaTrace?: { text: string; disabled: boolean }[];
  }
}

const CARE_APPOINTMENT_REMINDER = 3;

const stat = (page: Page, tone: string) => page.locator(`.snd-stat--${tone}`);
const skipRecentBox = (page: Page) =>
  page.getByRole("checkbox", { name: "Không gửi lại cho khách đã nhận mẫu này trong 30 ngày" });

/** Why Thống kê CSKH says today's message to this customer failed, in the page's language. */
async function failureShown(page: Page, name: string): Promise<string | null> {
  const today = days(new Date()).iso;
  const res = await call<{ items: { error: string | null }[] }>(
    page,
    `/api/v1/app/message-stats/recipients?Filter=${encodeURIComponent(name)}&FromDate=${today}&ToDate=${today}`,
    asBranchOne,
  );
  expect(res.status).toBe(200);
  return res.body.items[0]?.error ?? null;
}

/** The "Người nhận" sheet of today's Thống kê CSKH Excel for `name`, as text. */
async function recipientsInExcel(page: Page, name: string): Promise<string> {
  const today = days(new Date()).iso;
  const res = await page.request.get(
    `/api/v1/app/message-stats/excel?Filter=${encodeURIComponent(name)}&FromDate=${today}&ToDate=${today}`,
    { headers: { "X-Clinic-Branch-Id": BRANCH_ONE, accept: "*/*", "accept-language": "vi" } },
  );
  expect(res.status()).toBe(200);
  const workbook = XLSX.read(await res.body(), { type: "buffer" });
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Người nhận"], { header: 1 }).flat().map(String).join("\n");
}

/** The CSKH board's "Đã gửi Zalo" count. */
async function zaloSentCount(page: Page): Promise<number> {
  const text = await page.getByRole("button", { name: /\d+\s*Đã gửi Zalo/ }).textContent();
  return Number(/\d+/.exec(text ?? "")?.[0]);
}

test.describe("CSKH — Gửi tin nhắn (Zalo giả lập)", () => {
  test.skip(!process.env.E2E_ZALO_STUB, "cần host trỏ Zalo về e2e/fixtures/zalo-stub.mjs (E2E_ZALO_STUB=1)");
  test.describe.configure({ timeout: 180_000 });

  let linkedHere = false;

  test.beforeEach(async ({ page }) => {
    await login(page);
    linkedHere = await linkStubIfIdle(page);
  });

  test.afterEach(async ({ page }) => {
    if (linkedHere) await unlink(page);
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
    await expectCampaignList(page);
    await expect(page.locator(".cskh-table tbody tr.ant-table-row").first()).toContainText(template.name);

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

    // Picked again on a fresh send screen, the customer now shows the
    // receipt, so the 30-day guard holds them.
    await openSend(page, `channel=zalo&templateId=${template.id}&to=individual`);
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
    await expectCampaignList(page);
    const listed = page.locator(".cskh-table tbody tr.ant-table-row").filter({ hasText: template.name });
    await expect(listed).toContainText("Đang gửi");
    await expect(listed).toContainText(/Hẹn gửi \d{2}\/\d{2} \d{2}:\d{2}/);

    // Huỷ hẹn on the send screen still calls the booked send off.
    await openSend(page, "channel=zalo&to=individual");
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

  test("R-1013: lô đã hẹn giờ chưa gửi cũng giữ chống gửi trùng — dòng ghi Chờ gửi, không gửi lại được", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E Gửi chờ ${runId()}`);
    const patient = await newPatient(page);
    await book(page, patient.id, tomorrowAt(10));
    const at = tomorrowAt(8);
    const queued = await scheduleSend(page, template.id, [patient.id], at);

    try {
      await openSend(page, `channel=zalo&templateId=${template.id}&to=individual`);
      await addCustomer(page, patient.name);
      await expect(customerRow(page, patient.name)).toContainText(`Chờ gửi ${days(at).shown}`);
      await expect(stat(page, "received")).toHaveText("1 đã nhận mẫu này");
      await expect(cta(page)).toHaveText("Không có khách để gửi");
      await expect(cta(page)).toBeDisabled();

      // The server holds them too: a send now skips the customer the booked batch will reach.
      const now = await call<Batch>(page, SENDS, {
        ...asBranchOne,
        method: "POST",
        json: { channel: CHANNEL.Zalo, templateId: template.id, source: 1, patientIds: [patient.id], skipRecentDuplicates: true },
      });
      if (now.status === 200) expect(now.body).toMatchObject({ recipientCount: 0, skippedCount: 1 });
      else expect(now.status, JSON.stringify(now.body)).toBe(403);
    } finally {
      expect((await call(page, `${SENDS}/${queued.id}/cancel`, { ...asBranchOne, method: "POST" })).status).toBe(200);
    }
    expect(await znsSendsTo(patient.phone)).toEqual([]);
  });

  test("R-1014: Gửi Zalo từ nút trên dòng CSKH đánh dấu dòng đó đã gửi Zalo", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E Gửi dòng ${runId()}`);
    const patient = await newPatient(page);
    const start = tomorrowAt(15);
    await book(page, patient.id, start);
    const board = `/cskh-grouping?tab=care&page=remind-appointment&care_dateMode=day&care_date=${days(start).iso}&branch=BD-001`;

    const counted = assertRealApiTraffic(page, "/api/v1/app/care-records/stats");
    await page.goto(board);
    await counted;
    const before = await zaloSentCount(page);
    await page.getByRole("textbox", { name: "Tìm kiếm" }).fill(patient.name);
    const row = page.locator(".cskh-table tbody tr.ant-table-row").filter({ hasText: patient.name });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await row.getByRole("button", { name: "Gửi Zalo" }).click();

    await expect(page).toHaveURL(/\/cskh-grouping\/send\?/);
    const recordId = new URL(page.url()).searchParams.get("careRecordId") ?? "";
    expect(recordId).not.toBe("");
    const record = () => call<{ zaloSentAt: string | null }>(page, `/api/v1/app/care-records/${recordId}`, asBranchOne);
    expect((await record()).body.zaloSentAt).toBeNull();

    await pickTemplate(page, template.name);
    await expect(customerRow(page, patient.name)).toHaveCount(1, { timeout: 15_000 });
    await expect(cta(page)).toHaveText("Gửi 1 tin Zalo");
    await cta(page).click();
    const batch = await confirmSend(page);
    await expect
      .poll(async () => (await batchOf(page, batch.id)).status, { timeout: 60_000, intervals: [2_000] })
      .toBe(BATCH.Completed);
    expect(await batchOf(page, batch.id)).toMatchObject({ sentCount: 1, failedCount: 0 });
    expect((await record()).body.zaloSentAt).not.toBeNull();

    const recounted = assertRealApiTraffic(page, "/api/v1/app/care-records/stats");
    await page.goto(board);
    await recounted;
    await expect.poll(() => zaloSentCount(page)).toBe(before + 1);
  });

  test("R-1015: Lịch gửi đã hẹn chỉ liệt kê lô hẹn giờ và tự rơi khỏi danh sách khi tới giờ", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E Gửi lịch ${runId()}`);
    const patient = await newPatient(page);
    const other = await newPatient(page);
    await book(page, patient.id, tomorrowAt(9));
    await book(page, other.id, tomorrowAt(9));
    await openSend(page, `channel=zalo&templateId=${template.id}&to=individual`);
    const queued = page.locator(".snd-queued-item").filter({ hasText: template.name });

    // A send for now waits as Queued a few seconds too; the list read right after must not carry it.
    await addCustomer(page, patient.name);
    await cta(page).click();
    const now = await confirmSend(page);
    await expectCampaignList(page);
    // Gửi hands over to Chiến dịch đã gửi (F-79) while the send screen's own re-read may still be on its
    // way; only the list the reopened send screen reads counts.
    const reread = page.waitForResponse(
      (res) =>
        new URL(page.url()).pathname === "/cskh-grouping/send" &&
        new URL(res.url()).pathname === SENDS &&
        res.request().method() === "GET",
    );
    await openSend(page, `channel=zalo&templateId=${template.id}&to=individual`);
    const listed = await reread;
    expect(new URL(listed.url()).searchParams.get("scheduled")).toBe("true");
    expect(((await listed.json()) as Batch[]).map((b) => b.id)).not.toContain(now.id);
    await expect(queued).toHaveCount(0);

    // Booked 25 s ahead: listed, then gone on its own once the job takes it — no reload.
    const later = await scheduleSend(page, template.id, [other.id], secondsFromNow(25));
    await page.reload();
    await expect(queued).toHaveCount(1);
    await expect(queued).toHaveCount(0, { timeout: 90_000 });
    expect((await batchOf(page, later.id)).status).not.toBe(BATCH.Cancelled);
  });

  test("R-1016: OA hết hạn (làm mới token bị từ chối) — lô hẹn giờ thất bại ngay, màn gửi vẫn mở được", async ({ page }) => {
    test.skip(!linkedHere, "chi nhánh đang có kết nối Zalo thật — không đụng vào");
    await unlink(page);
    // Tokens that live 1 h fall inside the host's 2 h leeway, so every use refreshes.
    await stubConfig({ tokenLife: "3600" });
    try {
      await linkStub(page);
      const template = await zaloTemplate(page, `E2E Gửi hết hạn ${runId()}`);
      const patient = await newPatient(page);
      await book(page, patient.id, tomorrowAt(10));
      const batch = await scheduleSend(page, template.id, [patient.id], secondsFromNow(20));
      await stubConfig({ refreshFails: true });

      // Refused on the first run — not left to the job's retries a minute or more apart.
      await expect
        .poll(async () => (await batchOf(page, batch.id)).status, { timeout: 55_000, intervals: [2_000] })
        .toBe(BATCH.Completed);
      expect(await batchOf(page, batch.id)).toMatchObject({ sentCount: 0, failedCount: 1 });
      expect(await failureShown(page, patient.name)).toMatch(/^(Zalo OA chưa kết nối|Zalo OA is not connected)$/);
      expect(await znsSendsTo(patient.phone)).toEqual([]);

      const status = await call<{ isConnected: boolean }>(page, `${ZALO}/status`, asBranchOne);
      expect(status.body.isConnected).toBe(false);
      await openSend(page, `channel=zalo&templateId=${template.id}&to=individual`);
      await addCustomer(page, patient.name);
      await expect(cta(page)).toHaveText("Kênh Zalo chưa kết nối gửi");
      await expect(cta(page)).toBeDisabled();
    } finally {
      await stubConfig({ reset: true });
    }
  });

  test("R-1017: đổi danh sách thì nút Gửi khoá lại tới khi đọc xong danh sách mới", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E Gửi đổi tệp ${runId()}`);
    const patient = await newPatient(page);
    const start = tomorrowAt(16);
    await book(page, patient.id, start);

    await openSend(page, `channel=zalo&templateId=${template.id}&page=remind-appointment&care_dateMode=day&care_date=${days(start).iso}`);
    await expect(cta(page)).toHaveText(/^Gửi \d+ tin Zalo$/, { timeout: 15_000 });
    await expect(cta(page)).toBeEnabled();

    // Every state the CTA passes through, so the in-between one is caught however short.
    await page.evaluate(() => {
      const trace: { text: string; disabled: boolean }[] = [];
      window.ctaTrace = trace;
      new MutationObserver(() => {
        const button = document.querySelector<HTMLButtonElement>(".snd-cta");
        if (button) trace.push({ text: button.textContent?.trim() ?? "", disabled: button.disabled });
      }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    });
    const reread = page.waitForResponse((res) => new URL(res.url()).pathname === `${SENDS}/recipients`);
    await page.getByRole("radiogroup", { name: "Chọn 1 danh sách chăm sóc" }).getByRole("radio", { checked: false }).first().click();
    await reread;

    const trace = await page.evaluate(() => window.ctaTrace ?? []);
    expect(trace.some((step) => /^Gửi \d+ tin Zalo$/.test(step.text) && step.disabled)).toBe(true);
    expect(trace.some((step) => /^Gửi \d+ tin Zalo$/.test(step.text) && !step.disabled)).toBe(false);
  });

  test("R-1018: xem trước bị lỗi thì báo lỗi, không quay mãi", async ({ page, browser }) => {
    const template = await zaloTemplate(page, `E2E Gửi xem trước ${runId()}`);
    const first = await newPatient(page);
    const second = await newPatient(page);
    await book(page, first.id, tomorrowAt(11));
    await book(page, second.id, tomorrowAt(11));
    const staff = await makeStaff(page, ["BlueDental.cskhSend.read", "BlueDental.cskhSend.create"]);

    try {
      const session = await openSession(browser, staff.credentials);
      const mine = session.page;
      await openSend(mine, `channel=zalo&templateId=${template.id}&to=individual`);
      await addCustomer(mine, first.name);
      await addCustomer(mine, second.name);
      const preview = mine.locator(".snd-preview");
      await expect(preview.locator(".snd-preview-for")).toContainText(first.name);

      // The read right goes while the page is open: the next preview is refused.
      await setGrant(page, staff.roleName, "BlueDental.cskhSend.read", false);
      await customerRow(mine, first.name).getByRole("checkbox", { name: `Chọn ${first.name}` }).uncheck();
      await expect(preview).toContainText("Không xem trước được:", { timeout: 15_000 });
      await expect(preview.locator(".ant-spin")).toHaveCount(0);
      await session.context.close();
    } finally {
      await staff.tearDown();
    }
  });

  test("R-1019: khách đổi số sau khi hẹn giờ — tin đi số mới; khách mất số thì Thất bại có lý do", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E Gửi đổi số ${runId()}`);
    const moved = await newPatient(page);
    const gone = await newPatient(page);
    await book(page, moved.id, tomorrowAt(10));
    await book(page, gone.id, tomorrowAt(10));
    const batch = await scheduleSend(page, template.id, [moved.id, gone.id], secondsFromNow(20));
    expect(batch.recipientCount).toBe(2);

    const newPhone = `07${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    await changeContact(page, moved, newPhone);
    await changeContact(page, gone, null, `e2e-gui-${gone.id.slice(0, 8)}@bluedental.local`);

    await expect
      .poll(async () => (await batchOf(page, batch.id)).status, { timeout: 75_000, intervals: [2_000] })
      .toBe(BATCH.Completed);
    expect(await batchOf(page, batch.id)).toMatchObject({ sentCount: 1, failedCount: 1 });
    expect(await znsSendsTo(newPhone)).toHaveLength(1);
    expect(await znsSendsTo(moved.phone)).toEqual([]);
    expect(await znsSendsTo(gone.phone)).toEqual([]);
    const noPhone = /Khách không còn số điện thoại hợp lệ|The customer no longer has a valid phone number/;
    expect(await failureShown(page, gone.name)).toMatch(noPhone);
    // The Excel reads the same rows: the reason leaves translated, not as the stored text.
    const sheet = await recipientsInExcel(page, gone.name);
    expect(sheet).toContain(gone.name);
    expect(sheet).toMatch(noPhone);
    expect(sheet).not.toContain("No phone number Zalo accepts.");
  });
});
