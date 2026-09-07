import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login } from "./fixtures/auth";

/**
 * Feature: Chi tiết kế hoạch điều trị (F-38), /patient/:id/treatment-plan/:planId.
 *
 * The slip code in the plan tab opens the page. It carries the reference's
 * three-step breadcrumb, the four pill tabs (Chi tiết, Thanh toán, Hoàn tiền,
 * Dư nợ — kept in `?planTab=`), the five money figures, the 15-column service
 * table with its status menu and eye dialog, the receipts filed against the
 * slip with "Tạo Phiếu Thanh Toán" / "In hóa đơn tổng", the refunds with
 * "Hoàn Tiền", and the lines the held balance covered. Under 640px every table
 * folds into grouped cards.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL. The
 * tests run in order: the first one makes a fresh slip so the money flows
 * below start from a line nobody has paid, and the isolation check at the end
 * has something to refuse.
 */

const PLANS_API = "/api/v1/app/patient-treatments";
const PAYMENTS_API = "/api/v1/app/patient-payments";
const CODE = /^DT\d+$/;
const MONEY = /\d đ$/;
const PAGER_TOTAL = /^Hiển thị \d+–\d+ trên \d+ .+$/;
const DETAIL_URL = /\/patient\/[0-9a-f-]{36}\/treatment-plan\/[0-9a-f-]{36}/;

let patientUrl = "";
let detailUrl = "";
let planCode = "";
let paidAmount = 0;
let paymentCode = "";
let refundCode = "";

async function freshPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

function money(text: string): number {
  return Number(text.replace(/[^\d]/g, ""));
}

async function statValue(page: Page, label: string): Promise<number> {
  const stat = page.locator(".pdt-stat", { has: page.locator("dt", { hasText: label }) });
  return money(await stat.locator("dd").innerText());
}

function openDropdown(page: Page, panel = ".ant-select-dropdown:not(.tp-service-dropdown)") {
  return page.locator(`${panel}:not(.ant-select-dropdown-hidden)`).last();
}

async function pickFirstOption(page: Page, combobox: Locator) {
  await combobox.click();
  const option = openDropdown(page).locator(".ant-select-item-option").first();
  await expect(option).toBeVisible();
  await option.click();
}

/** Makes a slip with one line on the first patient and returns its code. */
async function createSlip(page: Page): Promise<string> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
  await expect(firstName).toBeVisible();
  await firstName.click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  patientUrl = page.url().split("?")[0];

  const listed = page.waitForResponse((res) => res.url().includes(PLANS_API) && res.request().method() === "GET");
  await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
  expect((await listed).ok()).toBeTruthy();

  const before = await page.locator(".tp-table .tp-code").allTextContents();
  await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu dịch vụ" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
  const service = openDropdown(page, ".tp-service-dropdown").locator(".ant-select-item-option:has(.tp-opt-service)").first();
  await expect(service).toBeVisible();
  await service.click();
  await pickFirstOption(page, dialog.getByRole("combobox", { name: /Bác sĩ chẩn đoán/ }));
  await pickFirstOption(page, dialog.getByRole("combobox", { name: /^Chẩn đoán/ }));
  await dialog.locator(".tp-tooth-btn").click();
  const picker = page.getByRole("dialog", { name: "Chọn răng" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Răng 14", exact: true }).click();
  await picker.locator(".tp-teeth-foot button").click();
  await expect(picker).toBeHidden();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã tạo kế hoạch điều trị")).toBeVisible();
  await expect(dialog).toBeHidden();

  // Newest first, so the new code lands on page one whatever the page count is.
  const unseen = async () =>
    (await page.locator(".tp-table .tp-code").allTextContents()).find((c) => !before.includes(c)) ?? "";
  await expect.poll(unseen, { timeout: 15_000 }).toMatch(CODE);
  return unseen();
}

async function openDetail(page: Page, tab?: string) {
  const slip = page.waitForResponse((res) => res.url().includes(`${PLANS_API}/`) && res.request().method() === "GET");
  await page.goto(tab ? `${detailUrl}?planTab=${tab}` : detailUrl);
  expect((await slip).ok()).toBeTruthy();
  await expect(page.locator(".pdt-crumb--current")).toHaveText(planCode);
}

function tab(page: Page, name: string) {
  return page.getByRole("tab", { name, exact: true });
}

test.describe.configure({ mode: "serial" });

test.describe("Chi tiết kế hoạch điều trị", () => {
  test("the slip code opens the detail page with breadcrumb, tabs, stats and the service table", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    planCode = await createSlip(page);

    const slip = page.waitForResponse((res) => res.url().includes(`${PLANS_API}/`) && res.request().method() === "GET");
    await page.locator(".tp-table .tp-code", { hasText: planCode }).click();
    await expect(page).toHaveURL(DETAIL_URL);
    expect((await slip).ok()).toBeTruthy();
    detailUrl = page.url().split("?")[0];
    expect(detailUrl.startsWith(patientUrl)).toBeTruthy();

    // Breadcrumb: [code] - name › Kế hoạch điều trị › slip code.
    const crumbs = page.locator(".pdt-crumbs .pdt-crumb");
    await expect(crumbs).toHaveCount(3);
    await expect(crumbs.first()).toHaveText(/^\[.+\] - .+$/);
    await expect(crumbs.nth(1)).toHaveText("Kế hoạch điều trị");
    await expect(crumbs.last()).toHaveText(planCode);

    // Tabs, stats, toolbar and the table share one white card under the breadcrumb.
    const body = page.locator(".pdt-body");
    await expect(body.getByRole("tablist")).toBeVisible();
    await expect(body.locator(".pdt-toolbar")).toBeVisible();
    await expect(body.locator(".tp-table")).toBeVisible();
    expect(await body.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("12px");

    // Four pill tabs, "Chi tiết" selected, and the five money figures.
    await expect(page.getByRole("tab")).toHaveText(["Chi tiết", "Thanh toán", "Hoàn tiền", "Dư nợ"]);
    await expect(tab(page, "Chi tiết")).toHaveAttribute("aria-selected", "true");
    const labels = page.locator(".pdt-stat dt");
    await expect(labels).toHaveText(["Doanh thu dự kiến", "Đã thanh toán", "Công nợ", "Đã hoàn", "Dư nợ"]);
    for (const value of await page.locator(".pdt-stat dd").allInnerTexts()) expect(value.trim()).toMatch(MONEY);
    expect(await statValue(page, "Doanh thu dự kiến")).toBeGreaterThan(0);
    expect(await statValue(page, "Đã thanh toán")).toBe(0);

    // The toolbar and the 15-column table with one line, in the reference's order.
    await expect(page.getByRole("combobox", { name: /Thêm dịch vụ mới/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Thêm công đoạn" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tạo Đơn Thuốc" })).toBeVisible();
    await expect(page.getByRole("button", { name: "In Hóa Đơn" })).toBeVisible();
    const headers = await page.locator(".pdt-table thead th").allInnerTexts();
    expect(headers.map((h) => h.trim())).toEqual([
      "", "Dịch vụ", "Chẩn đoán", "Bác sĩ điều trị", "Răng", "Số lượng", "Đơn giá", "Tổng giảm giá",
      "Thành tiền", "Ghi chú", "Bác sĩ chẩn đoán 1", "Chẩn đoán 2", "Nhân sự tư vấn 1", "Nhân sự tư vấn 2", "Thao tác",
    ]);
    const rows = page.locator(".pdt-table tbody tr.ant-table-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator(".pdt-status")).toHaveText("Đã tạo");
    await expect(page.locator(".ant-pagination-total-text")).toHaveText(PAGER_TOTAL);

    // The eye opens the read-only detail dialog for that line.
    await rows.first().getByRole("button", { name: "Xem chi tiết" }).click();
    const detail = page.getByRole("dialog", { name: "Chi tiết dịch vụ" });
    await expect(detail).toBeVisible();
    await expect(detail.locator(".pdt-detail-section h3")).toHaveText([
      "Chi tiết kế hoạch", "Thông tin khách hàng", "Thông tin nhân viên", "Thông tin thanh toán",
    ]);
    await detail.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(detail).toBeHidden();

    // The printer icon opens the slip's "Chi tiết phiếu" — a dialog, not a
    // download — with the clinic, the customer, the line and the money; what
    // "In Phiếu" sends to the printer is the hidden "Phiếu điều trị" sheet.
    let downloaded = false;
    page.once("download", () => { downloaded = true; });
    await page.getByRole("button", { name: "In phiếu điều trị" }).click();
    const slipDialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await expect(slipDialog).toBeVisible();
    await expect(slipDialog.locator(".pdt-receipt-section h3")).toHaveText([
      "Thông tin chi nhánh", "Thông tin khách hàng", "Chi tiết dịch vụ", "Tổng thanh toán dịch vụ",
    ]);
    await expect(slipDialog.locator(".pdt-receipt-fact", { hasText: "Phòng khám" })).not.toContainText("—");
    await expect(slipDialog.locator(".pdt-receipt-fact", { hasText: "Mã KH" })).toContainText(/\w/);
    await expect(slipDialog.locator(".pdt-receipt-table tbody tr.ant-table-row")).toHaveCount(1);
    await expect(slipDialog.locator(".pdt-receipt-totals dt")).toHaveText(["Tổng phí", "Đã trả trước đó", "Tổng còn nợ"]);
    await expect(slipDialog.getByRole("button", { name: "In Phiếu" })).toBeVisible();
    const sheet = slipDialog.locator(".pdt-sheet");
    await expect(sheet).toHaveCount(1);
    await expect(sheet).toBeHidden();
    await expect(sheet.locator(".pdt-slip-sheet-title h2")).toHaveText("Phiếu điều trị");
    await expect(sheet.locator(".pdt-slip-sheet-table tbody tr")).toHaveCount(1);
    await expect(sheet.locator(".pdt-slip-sheet-signs > div")).toContainText(["Người lập phiếu", "Khách hàng"]);
    expect(downloaded).toBe(false);
    await slipDialog.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(slipDialog).toBeHidden();
  });

  test("Thanh toán collects money against the slip and shows the receipt", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await openDetail(page);

    await tab(page, "Thanh toán").click();
    await expect(page).toHaveURL(/planTab=payment-v2/);
    await expect(tab(page, "Thanh toán")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "In hóa đơn tổng" })).toBeVisible();
    await expect(page.locator(".pdt-table thead th").filter({ hasText: /^Mã thanh toán$/ })).toBeVisible();
    await expect(page.locator(".pdt-table")).toContainText("Không có dữ liệu");

    await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
    await expect(dialog).toBeVisible();
    const line = dialog.locator(".pd-newpay-lines > li").first();
    await line.locator("input[type=checkbox]").check();
    const due = money(await line.locator(".pd-newpay-due").innerText());
    expect(due).toBeGreaterThan(0);
    // Leave part of the line unpaid so the refund below stays inside what it may take.
    paidAmount = Math.max(1, Math.floor(due / 2));

    const collected = page.waitForResponse((res) => res.url().includes(PAYMENTS_API) && res.request().method() === "POST");
    await dialog.locator(".pd-newpay-amount").fill(String(paidAmount));
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await collected).ok()).toBeTruthy();
    await expect(dialog).toBeHidden();

    // The receipt lands in the table and the head figures move.
    const row = page.locator(".pdt-table tbody tr.ant-table-row").first();
    await expect(row).toBeVisible();
    paymentCode = (await row.locator("td").first().innerText()).trim();
    expect(paymentCode.length).toBeGreaterThan(0);
    await expect(row.locator(".tp-pill")).toHaveText("Hoàn tất");
    await expect.poll(() => statValue(page, "Đã thanh toán")).toBe(paidAmount);

    await row.getByRole("button", { name: `Xem phiếu ${paymentCode}` }).click();
    const receipt = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await expect(receipt).toBeVisible();
    await expect(receipt.locator(".pdt-receipt-facts").first()).toContainText(paymentCode);
    await expect(receipt.getByText("Tổng thanh toán dịch vụ")).toBeVisible();
    await expect(receipt.locator(".pdt-receipt-table tbody tr.ant-table-row")).toHaveCount(1);
    await expect(receipt.getByRole("button", { name: "In Hoá Đơn" })).toBeVisible();
    await receipt.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(receipt).toBeHidden();

    // "In hóa đơn tổng" is the same layout for the whole slip.
    await page.getByRole("button", { name: "In hóa đơn tổng" }).click();
    await expect(receipt).toBeVisible();
    await expect(receipt.locator(".pdt-receipt-facts").first()).toContainText("Tổng hợp");
    await expect(receipt.locator(".pdt-receipt-totals")).toContainText("Doanh thu dự kiến");
    // What "In Hoá Đơn" sends to the printer is the off-screen receipt sheet,
    // not the dialog: letterhead, title, the sum in words, two signatures.
    const sheet = receipt.locator(".pdt-sheet");
    await expect(sheet).toHaveCount(1);
    await expect(sheet).toBeHidden();
    await expect(sheet.locator(".pdt-sheet-title")).toHaveText("Biên lai thu tiền");
    await expect(sheet.locator(".pdt-sheet-clinic strong")).not.toBeEmpty();
    await expect(sheet).toContainText("Số tiền bằng chữ");
    await expect(sheet).toContainText(/[A-ZĐ][a-zăâđêôơưáàảãạ].* đồng/);
    await expect(sheet.locator(".pdt-sheet-signs > div")).toContainText(["Người lập phiếu", "Khách hàng"]);
    await receipt.getByRole("button", { name: "Đóng", exact: true }).last().click();
  });

  test("Hoàn tiền files a refund on a paid line and lists it", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await openDetail(page, "refund");
    await expect(tab(page, "Hoàn tiền")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".pdt-table")).toContainText("Không có dữ liệu");

    await page.getByRole("button", { name: "Hoàn Tiền" }).click();
    const dialog = page.getByRole("dialog", { name: "Hoàn tiền" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Loại" })).toBeVisible();
    const method = dialog.getByRole("combobox", { name: "Hình thức" });
    await expect(method).toBeVisible();
    await method.click();
    const options = page.locator(".ant-select-dropdown:visible .ant-select-item-option");
    await expect(options).toHaveText(["Tiền mặt", "Chuyển khoản", "Quẹt thẻ"]);
    await options.nth(1).click();
    // The channel is a label only: no account picker follows a bank refund.
    await expect(dialog.getByRole("combobox", { name: /Tài khoản/ })).toHaveCount(0);
    const lines = dialog.locator(".pdt-refund-table tbody tr");
    await expect(lines).toHaveCount(1);
    expect(money(await lines.first().locator("td").nth(2).innerText())).toBe(paidAmount);

    // Over what was paid is refused before anything is sent.
    const input = dialog.getByRole("textbox", { name: /^Số tiền hoàn / });
    await input.fill(String(paidAmount + 1));
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Số tiền hoàn không được vượt quá số tiền đã thanh toán")).toBeVisible();

    const refund = Math.max(1, Math.floor(paidAmount / 2));
    const filed = page.waitForResponse((res) => res.url().includes(PAYMENTS_API) && res.request().method() === "POST");
    await input.fill(String(refund));
    await expect.poll(async () => money(await dialog.locator(".pdt-refund-total strong").innerText())).toBe(refund);
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await filed).ok()).toBeTruthy();
    await expect(page.getByText("Đã tạo phiếu hoàn tiền")).toBeVisible();
    await expect(dialog).toBeHidden();

    const row = page.locator(".pdt-table tbody tr.ant-table-row").first();
    await expect(row).toBeVisible();
    refundCode = (await row.locator("td").first().innerText()).trim();
    expect(refundCode.length).toBeGreaterThan(0);
    expect(money(await row.locator("td").nth(3).innerText())).toBe(refund);
    await expect.poll(() => statValue(page, "Đã hoàn")).toBe(refund);
  });

  test("a reload keeps the tab, Dư nợ answers, and the status menu completes the line", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await openDetail(page, "refund");
    await page.reload();
    await expect(page.locator(".pdt-crumb--current")).toHaveText(planCode);
    await expect(tab(page, "Hoàn tiền")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".pdt-table tbody tr.ant-table-row").first()).toContainText(refundCode);

    await tab(page, "Thanh toán").click();
    await expect(page.locator(".pdt-table tbody tr.ant-table-row").first()).toContainText(paymentCode);

    // Nothing on this slip was settled from the held balance.
    await tab(page, "Dư nợ").click();
    await expect(page).toHaveURL(/planTab=debt/);
    await expect(page.locator(".pdt-table thead th").filter({ hasText: /^Dư nợ$/ })).toBeVisible();
    await expect(page.locator(".pdt-table")).toContainText("Không có dữ liệu");

    await tab(page, "Chi tiết").click();
    const row = page.locator(".pdt-table tbody tr.ant-table-row").first();
    await row.locator(".pdt-status--menu").click();
    const done = page.waitForResponse((res) => res.url().includes("/complete") && res.request().method() === "POST");
    await page.getByRole("menuitem", { name: "Hoàn thành" }).click();
    expect((await done).ok()).toBeTruthy();
    await expect(page.getByText("Đã hoàn thành dịch vụ")).toBeVisible();
    await expect(row.locator(".pdt-status")).toHaveText("Hoàn thành");
    await page.reload();
    await expect(page.locator(".pdt-table tbody tr.ant-table-row").first().locator(".pdt-status")).toHaveText("Hoàn thành");

    // The back arrow returns to the plan tab of the record.
    await page.getByRole("button", { name: "Quay lại" }).click();
    await expect(page).toHaveURL(/tab=treatment-plan/);
    await expect(page.locator(".tp-table .tp-code", { hasText: planCode })).toBeVisible();
  });

  test("under 640px every tab folds into cards with the shared pager", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await login(page);
    await openDetail(page);

    await expect(page.locator(".pdt-table")).toHaveCount(0);
    const cards = page.locator(".bd-rc-card");
    await expect(cards).toHaveCount(1);
    await expect(cards.first().locator(".bd-rc-title")).toHaveText("1");
    await expect(page.locator(".tp-card-pager .ant-pagination-total-text")).toHaveText(PAGER_TOTAL);
    await expect(page.locator(".pdt-stat")).toHaveCount(5);

    await tab(page, "Thanh toán").click();
    await expect(page.locator(".bd-rc-card", { hasText: paymentCode })).toBeVisible();
    await tab(page, "Hoàn tiền").click();
    await expect(page.locator(".bd-rc-card", { hasText: refundCode })).toBeVisible();

    // The refund dialog folds its service table the same way: numbered head,
    // "Đã hoàn" and the amount box behind "Xem thêm", the box the card's width.
    await page.getByRole("button", { name: "Hoàn Tiền" }).click();
    const dialog = page.locator(".pdt-refund-dialog");
    await expect(dialog.locator(".pdt-refund-table")).toHaveCount(0);
    const lineCard = dialog.locator(".bd-rc-card").first();
    await expect(lineCard.locator(".bd-rc-title")).toHaveText("1");
    await expect(dialog.locator(".tp-card-pager .ant-pagination-total-text")).toHaveText(PAGER_TOTAL);
    const note = dialog.getByRole("textbox", { name: "Nội dung" });
    expect((await note.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(120);
    await lineCard.getByRole("button", { name: "Xem thêm" }).click();
    const amountBox = lineCard.getByRole("textbox", { name: /^Số tiền hoàn / });
    await expect(amountBox).toBeVisible();
    const boxWidth = (await amountBox.boundingBox())?.width ?? 0;
    const bodyWidth = (await lineCard.locator(".bd-rc-body").boundingBox())?.width ?? 0;
    expect(boxWidth).toBeGreaterThanOrEqual(bodyWidth - 32);
  });

  test("another branch is refused the slip", async ({ browser }) => {
    const page = await freshPage(browser);
    await login(page, BRANCH2_USER);

    const planId = detailUrl.split("/").pop() ?? "";
    const refused = await page.evaluate(async (url) => {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      return res.status;
    }, `${PLANS_API}/${planId}`);
    expect([403, 404]).toContain(refused);

    await page.goto(detailUrl);
    await expect(page.getByText("Không tìm thấy kế hoạch điều trị")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
    await page.close();
  });
});
