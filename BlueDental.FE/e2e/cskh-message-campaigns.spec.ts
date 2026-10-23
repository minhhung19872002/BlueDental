import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import {
  BATCH,
  BRANCH_ONE,
  BRANCH_TWO,
  CHANNEL,
  SENDS,
  addCustomer,
  asBranchOne,
  batchOf,
  book,
  confirmSend,
  cta,
  customerRow,
  days,
  expectCampaignList,
  linkStubIfIdle,
  makeStaff,
  newPatient,
  openSend,
  openSession,
  scheduleSend,
  toast,
  tomorrowAt,
  unlink,
  waitUntilDone,
  zaloTemplate,
  znsSendsTo,
  type Batch,
} from "./fixtures/messageSend";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: CSKH ▸ Chiến dịch đã gửi (F-79, BA P2210). Every press of Gửi or
 * Hẹn gửi is one row — Template first, then whom it went to, its last run and
 * Đang gửi / Đã gửi / Đã dừng; "Tạo chiến dịch" opens Gửi tin nhắn; Tạm dừng
 * stops what has not gone (a booked send is called off); Lịch sử opens
 * "Kết quả lần gửi": chips, figures, one bar with the reasons, every customer
 * by outcome, the failures as Excel. R12 "Sai định dạng số" is its own skip
 * reason; R05 customers sharing one number get one message. cskhSend read /
 * create; branch scope.
 *
 * Real login screen, real API, real PostgreSQL, the real send job; nothing is
 * intercepted. Zalo is the local stub (e2e/fixtures/zalo-stub.mjs), which
 * refuses numbers starting 0399 with -108 — never the real OA — so the spec
 * runs only with E2E_ZALO_STUB=1, on a local database. Templates, patients
 * and bookings carry a run id and stay behind.
 */

const CAMPAIGNS = "/api/v1/app/message-campaigns";
const CARE_APPOINTMENT_REMINDER = 3;
const SKIP_MERGED_PHONE = 5;

interface Recipient {
  key: string;
  skipReason: number | null;
  mergedIntoKey: string | null;
  mergedIntoName: string | null;
}

const campaignRows = (page: Page) => page.locator(".cskh-table tbody tr.ant-table-row");
const campaignRow = (page: Page, templateName: string) => campaignRows(page).filter({ hasText: templateName });
const stopButton = (row: Locator) => row.getByRole("button", { name: /Tạm dừng/ });
const kpiCard = (page: Page, label: string) =>
  page
    .locator(".cmp-kpis .kpi-card")
    .filter({ has: page.locator(".kpi-card-label", { hasText: new RegExp(`^${label}$`) }) });
const kpi = (page: Page, label: string) => kpiCard(page, label).locator(".kpi-card-value");
const reasons = (page: Page) => page.getByRole("list", { name: "Lý do" }).getByRole("listitem");
const resultTabs = (page: Page) => page.locator(".cmp-recipients-card .seg-tabs-item");
const activeTopTab = (page: Page) => page.locator(".pill-tab--active");

async function openCampaignList(page: Page): Promise<void> {
  const listed = assertRealApiTraffic(page, CAMPAIGNS);
  await page.goto("/cskh-grouping?tab=campaign&branch=BD-001");
  await listed;
}

/** The whole local day of `date`, the way the CSKH board sends a "Ngày" period. */
function wholeDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60_000 - 1);
  return { fromDate: start.toISOString(), toDate: end.toISOString() };
}

/** Tạm dừng through the API: the clean-up for a booked send a test leaves behind. */
async function stopQuietly(page: Page, batch: Batch): Promise<void> {
  if ((await batchOf(page, batch.id)).status === BATCH.Queued) {
    await call(page, `${CAMPAIGNS}/${batch.id}/stop`, { ...asBranchOne, method: "POST" });
  }
}

test.describe("CSKH — Chiến dịch đã gửi (Zalo giả lập)", () => {
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

  test("Tạo chiến dịch → gửi → Kết quả lần gửi: số liệu, lý do, từng khách, Excel lỗi", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E Chiến dịch ${runId()}`);
    const reached = await newPatient(page);
    const refused = await newPatient(page, `0399${runId()}`);
    const unbooked = await newPatient(page);
    const foreign = await newPatient(page, `+1415${runId()}${Math.floor(Math.random() * 10)}`);
    await book(page, reached.id, tomorrowAt(9));
    await book(page, refused.id, tomorrowAt(10));
    await book(page, foreign.id, tomorrowAt(11));

    await openCampaignList(page);
    await expect(page.locator(".pill-tabs .pill-tab")).toHaveText([
      "Chăm sóc khách hàng",
      "Phân nhóm CSKH",
      "Chiến dịch đã gửi",
      "Template tin nhắn",
    ]);
    await expect(activeTopTab(page)).toHaveText("Chiến dịch đã gửi");
    // The BA moved Template first and dropped the campaign-name columns.
    await expect(page.getByRole("columnheader").first()).toHaveText("Template");
    await expect(page.getByRole("columnheader", { name: "Chiến dịch", exact: true })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Tên chiến dịch", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: /Tạo chiến dịch/ }).click();
    await expect(page).toHaveURL(/\/cskh-grouping\/send\?branch=/);

    await openSend(page, `channel=zalo&templateId=${template.id}&to=individual`);
    for (const patient of [reached, refused, unbooked, foreign]) await addCustomer(page, patient.name);
    await expect(customerRow(page, unbooked.name).locator(".snd-row-missing")).toHaveText("Thiếu Ngày hẹn, Giờ hẹn");
    await expect(customerRow(page, foreign.name).locator(".snd-row-missing")).toHaveText("Sai định dạng số");
    await expect(page.locator(".snd-stat--total")).toHaveText("4 khách");
    await expect(page.locator(".snd-stat--missing")).toHaveText("1 thiếu dữ liệu biến");
    await expect(page.locator(".snd-stat--invalid")).toHaveText("1 sai định dạng số");
    await expect(cta(page)).toHaveText("Gửi 2 tin Zalo");

    await cta(page).click();
    const batch = await confirmSend(page);
    expect(batch).toMatchObject({ recipientCount: 2, skippedCount: 2 });
    await expect(toast(page, "Đã bắt đầu gửi 2 tin Zalo")).toBeVisible();
    await expectCampaignList(page);

    // Newest first; the list looks again while the send runs.
    const row = campaignRows(page).first();
    await expect(row).toContainText(template.name);
    await expect(row.locator(".cskh-badge")).toHaveText("ZNS");
    await expect(row).toContainText("Khách lẻ");
    await expect(row).toContainText("4 khách");
    await expect(row).toContainText("Đã gửi", { timeout: 60_000 });
    await expect(row).toContainText("1/2 thành công · 1 lỗi");
    await expect(stopButton(row)).toHaveCount(0);

    await row.getByRole("button", { name: /Lịch sử/ }).click();
    await expect(page).toHaveURL(new RegExp(`/cskh-grouping/campaigns/${batch.id}\\?branch=`));

    const crumbs = page.getByRole("navigation", { name: "Chiến dịch đã gửi" });
    await expect(crumbs.getByRole("link", { name: "Chiến dịch đã gửi" })).toBeVisible();
    await expect(crumbs.locator("[aria-current=page]")).toHaveText("Kết quả lần gửi");
    await expect(page.getByRole("heading", { level: 2, name: `Kết quả lần gửi · ${template.name}` })).toBeVisible();
    await expect(page.getByRole("list", { name: "Kết quả lần gửi" }).getByRole("listitem")).toHaveText([
      "ZNS",
      "Template ID 301001",
      "Gửi tay",
      /^.+ · \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/,
      "Khách lẻ · 4 khách",
    ]);

    await expect(kpi(page, "Khách đã chọn")).toHaveText("4");
    await expect(kpi(page, "Bị loại trước khi gửi")).toHaveText("2");
    await expect(kpi(page, "Đã gửi đi")).toHaveText("2");
    await expect(kpi(page, "Thành công")).toHaveText("1");
    await expect(kpi(page, "Thất bại")).toHaveText("1");
    await expect(kpi(page, "Đã nhận")).toHaveText("0");
    // Only the message Zalo took is charged: the stub prices #301001 at 300 đ.
    await expect(kpi(page, "Chi phí")).toHaveText(/^300\s/);
    await expect(kpiCard(page, "Chi phí")).toContainText(/1 tin × 300\s/);
    await expect(kpi(page, "Đã dừng")).toHaveCount(0);

    await expect(page.getByRole("img", { name: "Thành công 1, Lỗi 1, Bị loại 2" })).toBeVisible();
    await expect(page.locator(".cmp-legend-item")).toHaveCount(3);
    await expect(reasons(page)).toHaveCount(3);
    for (const reason of ["Số điện thoại không hợp lệ", "Thiếu dữ liệu biến", "Sai định dạng số"]) {
      await expect(reasons(page).filter({ hasText: reason })).toContainText("1");
    }
    // R13 is still open with the BA: no "Đã xem" and no "Gọi điện".
    await expect(page.getByText("Đã xem", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Gọi điện/ })).toHaveCount(0);

    await expect(resultTabs(page)).toHaveText(["Tất cả · 4", "Thành công · 1", "Thất bại · 1", "Bị loại · 2"]);
    await expect(page.getByRole("columnheader", { name: "Khách", exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Số điện thoại", exact: true })).toBeVisible();
    const customers = campaignRows(page);
    await expect(customers).toHaveCount(4);
    // Sent ones first, the left-out after.
    await expect(customers.nth(2)).toContainText("Bị loại");
    await expect(customers.nth(3)).toContainText("Bị loại");

    const reachedRow = customers.filter({ hasText: reached.name });
    await expect(reachedRow).toContainText(reached.phone);
    await expect(reachedRow).toContainText("Thành công");
    await expect(reachedRow).toContainText("Đã gửi, chờ Zalo báo nhận");
    await expect(reachedRow.getByRole("cell").last()).toHaveText(/^300\s/);
    await expect(reachedRow.getByRole("link", { name: reached.name })).toHaveAttribute(
      "href",
      new RegExp(`/patient/${reached.id}\\?branch=`),
    );
    const refusedRow = customers.filter({ hasText: refused.name });
    await expect(refusedRow).toContainText("Thất bại");
    await expect(refusedRow).toContainText("Số điện thoại không hợp lệ");
    // Thời điểm to the second on the send's own day; a refused message costs 0 đ (BA P2210).
    await expect(refusedRow.getByRole("cell").nth(4)).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
    await expect(refusedRow.getByRole("cell").last()).toHaveText(/^0\s/);
    const unbookedRow = customers.filter({ hasText: unbooked.name });
    await expect(unbookedRow).toContainText("Bị loại");
    await expect(unbookedRow).toContainText("Thiếu dữ liệu biến");
    await expect(unbookedRow.getByRole("cell").nth(4)).toHaveText("—");
    await expect(unbookedRow.getByRole("cell").last()).toHaveText("—");
    await expect(customers.filter({ hasText: foreign.name })).toContainText("Sai định dạng số");

    await resultTabs(page).filter({ hasText: "Thất bại" }).click();
    await expect(customers).toHaveCount(1);
    await expect(customers).toContainText(refused.name);
    await resultTabs(page).filter({ hasText: "Bị loại" }).click();
    await expect(customers).toHaveCount(2);
    await expect(customers.filter({ hasText: reached.name })).toHaveCount(0);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Xuất Excel danh sách lỗi/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^ket-qua-lan-gui-\d{8}-\d{4}\.xlsx$/);
    const workbook = XLSX.read(readFileSync(await file.path()), { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["Danh sách lỗi"]);
    const cells = XLSX.utils
      .sheet_to_json<unknown[]>(workbook.Sheets["Danh sách lỗi"], { header: 1 })
      .flat()
      .map(String)
      .join("\n");
    for (const name of [refused.name, unbooked.name, foreign.name]) expect(cells).toContain(name);
    expect(cells).not.toContain(reached.name);
    expect(cells).toContain("Số điện thoại không hợp lệ");

    // Only the two sendable numbers reached Zalo.
    expect(await znsSendsTo(reached.phone)).toHaveLength(1);
    expect(await znsSendsTo(refused.phone)).toHaveLength(1);
    expect(await znsSendsTo(unbooked.phone)).toEqual([]);
    expect(await znsSendsTo(foreign.phone)).toEqual([]);

    await crumbs.getByRole("link", { name: "Chiến dịch đã gửi" }).click();
    await expectCampaignList(page);
    await expect(activeTopTab(page)).toHaveText("Chiến dịch đã gửi");
    await campaignRow(page, template.name).getByRole("button", { name: /Lịch sử/ }).click();
    await page.getByRole("button", { name: /Về danh sách CSKH/ }).click();
    await expect(page).toHaveURL(/\/cskh-grouping\?branch=/);
    await expect(activeTopTab(page)).toHaveText("Chăm sóc khách hàng");
  });

  test("R05 gộp trùng số: hai hồ sơ chung một SĐT nhận một tin, hồ sơ sau ghi Gộp vào tin của…", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E Gộp số ${runId()}`);
    const holder = await newPatient(page);
    const start = tomorrowAt(15);
    await book(page, holder.id, start);
    // A Lịch tạm guest on the holder's number; "Zz" sorts after "Gửi", so the holder carries the message.
    const guestName = `E2E Zz Ghép ${runId()}`;
    const guest = await call<{ id: string }>(page, "/api/v1/app/appointments/temp", {
      ...asBranchOne,
      method: "POST",
      json: {
        patientName: guestName,
        patientPhone: holder.phone,
        branchId: BRANCH_ONE,
        slotStart: new Date(start.getTime() + 60 * 60_000).toISOString(),
        slotEnd: new Date(start.getTime() + 90 * 60_000).toISOString(),
      },
    });
    expect(guest.status, JSON.stringify(guest.body)).toBe(200);
    const holderKey = `p:${holder.id}`;
    const guestKey = `a:${guest.body.id}`;

    // The send screen names the shared message on the guest's row.
    await openSend(
      page,
      `channel=zalo&templateId=${template.id}&page=remind-appointment&care_dateMode=day&care_date=${days(start).iso}`,
    );
    await expect(page.locator(".snd-stat--merged")).toHaveText(/^\d+ gộp trùng số$/, { timeout: 15_000 });
    await page.getByRole("searchbox", { name: "Tìm khách" }).fill(guestName);
    await expect(customerRow(page, guestName).locator(".snd-row-merged")).toHaveText(`Gộp vào tin của ${holder.name}`);

    // Sent through the API with just these two rows: the rest of tomorrow's list is other runs' customers.
    const input = {
      channel: CHANNEL.Zalo,
      templateId: template.id,
      source: 0,
      careType: CARE_APPOINTMENT_REMINDER,
      ...wholeDay(start),
      patientIds: [],
      careRecordId: null,
      keys: [holderKey, guestKey],
      skipRecentDuplicates: true,
    };
    const listed = await call<{ items: Recipient[] }>(page, `${SENDS}/recipients`, {
      ...asBranchOne,
      method: "POST",
      json: input,
    });
    expect(listed.status).toBe(200);
    expect(listed.body.items.find((r) => r.key === holderKey)).toMatchObject({ skipReason: null });
    expect(listed.body.items.find((r) => r.key === guestKey)).toMatchObject({
      skipReason: SKIP_MERGED_PHONE,
      mergedIntoKey: holderKey,
      mergedIntoName: holder.name,
    });

    const sent = await call<Batch>(page, SENDS, { ...asBranchOne, method: "POST", json: { ...input, scheduledAt: null } });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(sent.body).toMatchObject({ recipientCount: 1, skippedCount: 1 });
    expect(await waitUntilDone(page, sent.body.id)).toMatchObject({ sentCount: 1, failedCount: 0 });
    expect(await znsSendsTo(holder.phone)).toHaveLength(1);

    const loaded = assertRealApiTraffic(page, `${CAMPAIGNS}/${sent.body.id}`);
    await page.goto(`/cskh-grouping/campaigns/${sent.body.id}?branch=BD-001`);
    await loaded;
    await expect(page.getByRole("list", { name: "Kết quả lần gửi" }).getByRole("listitem").last()).toHaveText(
      /^Nhắc lịch hẹn · .+ · 2 khách$/,
    );
    await expect(reasons(page).filter({ hasText: "Gộp trùng số" })).toContainText("1");
    // The BA's own example: two customers chosen, one message delivered.
    await expect(page.getByRole("heading", { level: 2, name: "Từ 2 khách đến 1 tin thành công" })).toBeVisible();
    const customers = campaignRows(page);
    await expect(customers).toHaveCount(2);
    // The guest's row names the holder too, so the holder's row is the one linking to their hồ sơ.
    const holderRow = customers.filter({ has: page.getByRole("link", { name: holder.name, exact: true }) });
    await expect(holderRow).toContainText("Thành công");
    await expect(holderRow).toContainText("gửi chung cho 2 hồ sơ");
    const guestRow = customers.filter({ hasText: guestName });
    await expect(guestRow).toContainText("Bị loại");
    await expect(guestRow).toContainText(`Gộp vào tin của ${holder.name}`);
    // A Lịch tạm guest has no hồ sơ to open.
    await expect(guestRow.getByRole("link")).toHaveCount(0);

    // Nothing failed: the list reads "1/1 thành công" with no "· 0 lỗi", run time as dd/MM HH:mm.
    await page.getByRole("navigation", { name: "Chiến dịch đã gửi" }).getByRole("link", { name: "Chiến dịch đã gửi" }).click();
    const listRow = campaignRows(page).filter({ hasText: template.name });
    await expect(listRow).toContainText("1/1 thành công");
    await expect(listRow).not.toContainText("lỗi");
    await expect(listRow).toContainText(/\d{2}\/\d{2} \d{2}:\d{2}/);
  });

  test("Tạm dừng lần gửi đã hẹn: xác nhận, hủy hẳn, không tin nào đi, không dừng lại lần nữa", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E Tạm dừng ${runId()}`);
    const patient = await newPatient(page);
    await book(page, patient.id, tomorrowAt(16));
    const batch = await scheduleSend(page, template.id, [patient.id], tomorrowAt(8));

    try {
      await openCampaignList(page);
      const row = campaignRow(page, template.name);
      await expect(row).toContainText("Đang gửi");
      await expect(row).toContainText(/Hẹn gửi \d{2}\/\d{2} 08:00/);

      await stopButton(row).click();
      const dialog = page.getByRole("dialog").filter({ hasText: "Tạm dừng lần gửi này?" });
      await expect(dialog).toContainText(`Lần gửi mẫu "${template.name}" hẹn lúc`);
      await expect(dialog).toContainText("sẽ bị hủy, không tin nào được gửi đi.");
      const stopped = page.waitForResponse((res) => new URL(res.url()).pathname === `${CAMPAIGNS}/${batch.id}/stop`);
      await dialog.getByRole("button", { name: /Tạm dừng$/ }).click();
      expect((await stopped).status()).toBe(200);
      await expect(toast(page, "Đã tạm dừng lần gửi")).toBeVisible();
      await expect(row).toContainText("Đã dừng");
      await expect(row).toContainText("0/1 đã gửi · 1 dừng");
      await expect(stopButton(row)).toHaveCount(0);

      // A booked send called off reads Đã dừng too; the server keeps it apart as Cancelled.
      expect((await batchOf(page, batch.id)).status).toBe(BATCH.Cancelled);
      const again = await call(page, `${CAMPAIGNS}/${batch.id}/stop`, { ...asBranchOne, method: "POST" });
      expect(again.status).not.toBe(200);

      await row.getByRole("button", { name: /Lịch sử/ }).click();
      await expect(page.getByRole("list", { name: "Kết quả lần gửi" })).toContainText(
        /Hẹn giờ \d{2}\/\d{2}\/\d{4} 08:00/,
      );
      await expect(kpi(page, "Đã dừng")).toHaveText("1");
      await expect(kpi(page, "Đã gửi đi")).toHaveText("0");
      const stoppedRow = campaignRows(page).filter({ hasText: patient.name });
      await expect(stoppedRow).toContainText("Đã dừng");
      await expect(stoppedRow).toContainText("Dừng trước khi gửi");
      expect(await znsSendsTo(patient.phone)).toEqual([]);
    } finally {
      await stopQuietly(page, batch);
    }
  });

  test("quyền: chỉ xem thì thấy tab và kết quả, không Tạo / Tạm dừng; không có cskhSend thì không thấy tab", async ({
    page,
    browser,
  }) => {
    const template = await zaloTemplate(page, `E2E Chiến dịch quyền ${runId()}`);
    const patient = await newPatient(page);
    await book(page, patient.id, tomorrowAt(17));
    const batch = await scheduleSend(page, template.id, [patient.id], tomorrowAt(8));
    const readOnly = await makeStaff(page, ["BlueDental.cskhCare.read", "BlueDental.cskhSend.read"]);
    const careOnly = await makeStaff(page, ["BlueDental.cskhCare.read"]);

    try {
      const viewer = await openSession(browser, readOnly.credentials);
      await openCampaignList(viewer.page);
      await expect(activeTopTab(viewer.page)).toHaveText("Chiến dịch đã gửi");
      await expect(viewer.page.getByRole("button", { name: /Tạo chiến dịch/ })).toHaveCount(0);
      const row = campaignRow(viewer.page, template.name);
      await expect(row).toContainText("Đang gửi");
      await expect(stopButton(row)).toHaveCount(0);
      await row.getByRole("button", { name: /Lịch sử/ }).click();
      await expect(
        viewer.page.getByRole("heading", { level: 2, name: `Kết quả lần gửi · ${template.name}` }),
      ).toBeVisible();
      const refused = await call(viewer.page, `${CAMPAIGNS}/${batch.id}/stop`, { ...asBranchOne, method: "POST" });
      expect(refused.status).toBe(403);
      await viewer.context.close();

      const careStaff = await openSession(browser, careOnly.credentials);
      await careStaff.page.goto("/cskh-grouping?tab=care&branch=BD-001");
      await expect(activeTopTab(careStaff.page)).toHaveText("Chăm sóc khách hàng");
      await expect(careStaff.page.locator(".pill-tab").filter({ hasText: "Chiến dịch đã gửi" })).toHaveCount(0);
      const listed = await call(careStaff.page, CAMPAIGNS, asBranchOne);
      expect(listed.status).toBe(403);
      await careStaff.context.close();

      expect((await batchOf(page, batch.id)).status).toBe(BATCH.Queued);
    } finally {
      await stopQuietly(page, batch);
      await readOnly.tearDown();
      await careOnly.tearDown();
    }
  });

  test("phạm vi chi nhánh: lần gửi của BD-001 không đọc / dừng được từ chi nhánh khác", async ({ page }) => {
    const template = await zaloTemplate(page, `E2E Chiến dịch chi nhánh ${runId()}`);
    const patient = await newPatient(page);
    await book(page, patient.id, tomorrowAt(18));
    const batch = await scheduleSend(page, template.id, [patient.id], tomorrowAt(8));
    const asBranchTwo = { branchId: BRANCH_TWO };

    try {
      expect((await call(page, `${CAMPAIGNS}/${batch.id}`, asBranchTwo)).status).toBe(404);
      expect((await call(page, `${CAMPAIGNS}/${batch.id}/recipients`, asBranchTwo)).status).toBe(404);
      expect((await call(page, `${CAMPAIGNS}/${batch.id}/stop`, { ...asBranchTwo, method: "POST" })).status).toBe(404);
      const other = await call<{ items: { id: string }[] }>(page, `${CAMPAIGNS}?MaxResultCount=100`, asBranchTwo);
      expect(other.status).toBe(200);
      expect(other.body.items.map((item) => item.id)).not.toContain(batch.id);

      const own = await call<{ items: { id: string }[] }>(page, `${CAMPAIGNS}?MaxResultCount=100`, asBranchOne);
      expect(own.body.items.map((item) => item.id)).toContain(batch.id);
      expect((await batchOf(page, batch.id)).status).toBe(BATCH.Queued);
    } finally {
      await stopQuietly(page, batch);
    }
  });
});
