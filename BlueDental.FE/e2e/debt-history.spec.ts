import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login } from "./fixtures/auth";

/**
 * Feature: tab "Lịch sử dư nợ" của hồ sơ bệnh nhân (F-40), `?tab=debt-history`.
 *
 * Five columns, no toolbar and no column picker; money onto the account reads
 * green with a "+", money off it red with a "-". The feed is derived, so the
 * test earns its rows the long way: it opens a slip, collects money on it and
 * files a refund, then expects that refund to show up as "Hoàn trả dư nợ".
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL.
 */

const PAYMENTS_API = "/api/v1/app/patient-payments";
const DEBT_API = "/api/v1/app/patient-payments/debt-history";
const PAGER_TOTAL = /^Hiển thị \d+–\d+ trên \d+ giao dịch$/;

function money(text: string): number {
  return Number(text.replace(/[^\d]/g, ""));
}

function openDropdown(page: Page, panel = ".ant-select-dropdown:not(.tp-service-dropdown)") {
  return page.locator(`${panel}:not(.ant-select-dropdown-hidden)`).last();
}

async function pickFirstOption(page: Page, name: RegExp) {
  await page.getByRole("combobox", { name }).click();
  const option = openDropdown(page).locator(".ant-select-item-option").first();
  await expect(option).toBeVisible();
  await option.click();
}

/**
 * The first option that is actually worth something. The catalog collects
 * zero-priced junk from earlier runs, and a slip built on one of those reports
 * no revenue at all, which reads exactly like a broken rollup.
 */
async function pickPricedService(page: Page, dropdown: Locator): Promise<void> {
  const options = dropdown.locator(".ant-select-item-option:has(.tp-opt-service)");
  await expect(options.first()).toBeVisible();
  const count = await options.count();
  for (let index = 0; index < count; index++) {
    const option = options.nth(index);
    const price = Number((await option.locator(".tp-opt-price").innerText()).replace(/[^\d]/g, ""));
    if (price > 0) {
      await option.click();
      return;
    }
  }
  throw new Error("Danh mục dịch vụ không có mục nào còn giá");
}

/** A fresh slip on the first patient, with one line, paid and partly refunded. */
async function refundOnANewSlip(page: Page): Promise<{ patientUrl: string; refunded: number }> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
  await expect(firstName).toBeVisible();
  await firstName.click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  const patientUrl = page.url().split("?")[0];

  await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
  const before = await page.locator(".tp-table .tp-code").allTextContents();
  await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu dịch vụ" });
  await expect(dialog).toBeVisible();

  await pickFirstOption(page, /Nhân sự tư vấn 1/);
  await dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
  await pickPricedService(page, openDropdown(page, ".tp-service-dropdown"));
  await dialog.locator(".tp-tooth-btn").click();
  const picker = page.getByRole("dialog", { name: "Chọn răng" });
  await picker.getByRole("button", { name: "Răng 14", exact: true }).click();
  await picker.locator(".tp-teeth-foot button").click();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(dialog).toBeHidden();

  const unseen = async () =>
    (await page.locator(".tp-table .tp-code").allTextContents()).find((c) => !before.includes(c)) ?? "";
  await expect.poll(unseen, { timeout: 15_000 }).toMatch(/^DT\d+$/);
  await page.locator(".tp-table .tp-code", { hasText: await unseen() }).click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}\/treatment-plan\/[0-9a-f-]{36}/);

  // Collect the line in full, then hand part of it back.
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
  const payDialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
  const payLine = payDialog.locator(".pd-newpay-lines > li").first();
  await payLine.locator("input[type=checkbox]").check();
  const due = money(await payLine.locator(".pd-newpay-due").innerText());
  const collected = page.waitForResponse(
    (res) => res.url().includes(PAYMENTS_API) && res.request().method() === "POST",
  );
  // Half, the way the plan-detail spec does it: the whole "Còn nợ" is more than
  // the server will take in one receipt.
  const paid = Math.max(2, Math.floor(due / 2));
  await payDialog.locator(".pd-newpay-amount").fill(String(paid));
  await payDialog.getByRole("button", { name: "Lưu" }).click();
  expect((await collected).ok()).toBeTruthy();

  // The refund is capped at what the line actually holds, so wait for the slip
  // to have taken the money in before asking for any of it back.
  await expect
    .poll(async () => {
      const stat = page.locator(".pdt-stat", { has: page.locator("dt", { hasText: "Đã thanh toán" }) });
      return money(await stat.locator("dd").innerText());
    })
    .toBe(paid);

  const refunded = Math.max(1, Math.floor(paid / 2));
  await page.getByRole("tab", { name: "Hoàn tiền", exact: true }).click();
  await page.getByRole("button", { name: "Hoàn Tiền" }).click();
  const refundDialog = page.getByRole("dialog", { name: "Hoàn tiền" });
  await expect(refundDialog).toBeVisible();
  // The channel is required before the dialog will save.
  await refundDialog.getByRole("combobox", { name: "Hình thức" }).click();
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
  await refundDialog.getByRole("textbox", { name: /^Số tiền hoàn / }).fill(String(refunded));
  const filed = page.waitForResponse(
    (res) => res.url().includes(PAYMENTS_API) && res.request().method() === "POST",
  );
  await refundDialog.getByRole("button", { name: "Lưu" }).click();
  expect((await filed).ok()).toBeTruthy();
  await expect(refundDialog).toBeHidden();

  return { patientUrl, refunded };
}

test.describe.configure({ mode: "serial" });

test.describe("Lịch sử dư nợ", () => {
  let patientUrl = "";
  let refunded = 0;

  test("a refund lands on the account history as a credit", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    ({ patientUrl, refunded } = await refundOnANewSlip(page));

    const listed = page.waitForResponse(
      (res) => res.url().includes(DEBT_API) && res.request().method() === "GET",
    );
    await page.goto(`${patientUrl}?tab=debt-history`);
    expect((await listed).ok()).toBeTruthy();

    // Five columns, in the reference's order and its sentence case.
    const headers = await page.locator(".pd-debt-table thead th").allInnerTexts();
    expect(headers.map((h) => h.trim())).toEqual([
      "Ngày giao dịch", "Loại", "Số tiền", "Nhân viên", "Ghi chú",
    ]);
    // Nothing else: this table has no toolbar and no column picker.
    await expect(page.getByRole("button", { name: "Cột hiển thị" })).toHaveCount(0);

    const row = page.locator(".pd-debt-table tbody tr.ant-table-row").first();
    await expect(row).toBeVisible();
    await expect(row.locator("td").nth(0)).toHaveText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    await expect(row.locator("td").nth(1)).toHaveText("Hoàn trả dư nợ");

    // Money onto the account: a "+" in the reference's green.
    const amount = row.locator(".pd-debt-amount");
    await expect(amount).toHaveText(`+${refunded.toLocaleString("vi-VN")} đ`);
    await expect(amount).toHaveClass(/pd-debt-amount--in/);
    expect(await amount.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(31, 146, 84)");

    await expect(page.locator(".ant-pagination-total-text")).toHaveText(PAGER_TOTAL);
  });

  test("the history survives a reload and folds into cards under 769px", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await page.goto(`${patientUrl}?tab=debt-history`);
    await expect(page.locator(".pd-debt-table tbody tr.ant-table-row").first()).toContainText(
      "Hoàn trả dư nợ",
    );

    await page.setViewportSize({ width: 700, height: 900 });
    await expect(page.locator(".pd-debt-table")).toHaveCount(0);
    const card = page.locator(".bd-rc-card").first();
    await expect(card).toBeVisible();
    await expect(card.locator(".bd-rc-title")).toHaveText("1");
    // Four rows on the face, the note behind "Xem thêm".
    await expect(card.locator(".bd-rc-row")).toHaveCount(4);
    await card.getByRole("button", { name: "Xem thêm" }).click();
    await expect(card.locator(".bd-rc-row")).toHaveCount(5);
    await expect(page.locator(".tp-card-pager .ant-pagination-total-text")).toHaveText(PAGER_TOTAL);
  });

  test("a line paid in full can still be refunded", async ({ page }) => {
    // The cap on a refund is what the line has collected, not what it still
    // owes — capping by "Còn nợ" refused every refund on a line paid in full.
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await page.goto(`${patientUrl}?tab=treatment-plan`);
    await page.locator(".tp-table .tp-code").first().click();
    await expect(page).toHaveURL(/\/treatment-plan\/[0-9a-f-]{36}/);

    // Settle whatever is left, so the line owes nothing at all.
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
    const payDialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
    const payLine = payDialog.locator(".pd-newpay-lines > li").first();
    await payLine.locator("input[type=checkbox]").check();
    const owed = money(await payLine.locator(".pd-newpay-due").innerText());
    const settled = page.waitForResponse(
      (res) => res.url().includes(PAYMENTS_API) && res.request().method() === "POST",
    );
    await payDialog.locator(".pd-newpay-amount").fill(String(owed));
    await payDialog.getByRole("button", { name: "Lưu" }).click();
    expect((await settled).ok()).toBeTruthy();
    await expect(payDialog).toBeHidden();

    await page.getByRole("tab", { name: "Hoàn tiền", exact: true }).click();
    await page.getByRole("button", { name: "Hoàn Tiền" }).click();
    const refundDialog = page.getByRole("dialog", { name: "Hoàn tiền" });
    await expect(refundDialog).toBeVisible();
    // The line reads as owing nothing — exactly the state that used to fail.
    const lineRow = refundDialog.locator(".pdt-refund-table tbody tr").first();
    expect(money(await lineRow.locator("td").nth(3).innerText())).toBe(0);

    await refundDialog.getByRole("combobox", { name: "Hình thức" }).click();
    await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
    await refundDialog.getByRole("textbox", { name: /^Số tiền hoàn / }).first().fill("1");
    const filed = page.waitForResponse(
      (res) => res.url().includes(PAYMENTS_API) && res.request().method() === "POST",
    );
    await refundDialog.getByRole("button", { name: "Lưu" }).click();
    expect((await filed).ok()).toBeTruthy();
    await expect(page.getByText("Đã tạo phiếu hoàn tiền")).toBeVisible();

    // One toast, not two: the screen's own message and the global handler share
    // a sonner id, so the same failure can never stack.
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(1);
  });

  test("an account limited to another branch is refused the history", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, BRANCH2_USER);

    const patientId = patientUrl.split("/").pop() ?? "";
    const rows = await page.evaluate(async (url) => {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) return { status: res.status, total: -1 };
      const body = await res.json();
      return { status: res.status, total: body.totalCount as number };
    }, `${DEBT_API}?patientId=${patientId}&skipCount=0&maxResultCount=20`);

    // Either refused outright or scoped to nothing — never another branch's money.
    expect(rows.status === 403 || rows.total === 0).toBeTruthy();
    await page.close();
  });
});
