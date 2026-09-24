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

/** Makes a slip with one line on the first patient and returns its code. */
async function createSlip(page: Page, teeth: number[] = [14]): Promise<string> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
  await expect(firstName).toBeVisible();
  await firstName.click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  patientUrl = page.url().split("?")[0];

  const listed = page.waitForResponse(
    (res) => res.url().includes(PLANS_API) && res.request().method() === "GET",
  );
  await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
  expect((await listed).ok()).toBeTruthy();

  const before = await page.locator(".tp-table .tp-code").allTextContents();
  await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu dịch vụ" });
  await expect(dialog).toBeVisible();

  await pickFirstOption(page, dialog.getByRole("combobox", { name: /Nhân sự tư vấn 1/ }));
  await dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
  await pickPricedService(page, openDropdown(page, ".tp-service-dropdown"));
  await dialog.locator(".tp-tooth-btn").click();
  const picker = page.getByRole("dialog", { name: "Chọn răng" });
  await expect(picker).toBeVisible();
  for (const tooth of teeth) {
    await picker.getByRole("button", { name: `Răng ${tooth}`, exact: true }).click();
  }
  await picker.locator(".tp-teeth-foot button").click();
  await expect(picker).toBeHidden();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã tạo kế hoạch điều trị")).toBeVisible();
  await expect(dialog).toBeHidden();

  // Newest first, so the new code lands on page one whatever the page count is.
  const unseen = async () =>
    (await page.locator(".tp-table .tp-code").allTextContents()).find((c) => !before.includes(c)) ??
    "";
  await expect.poll(unseen, { timeout: 15_000 }).toMatch(CODE);
  return unseen();
}

async function openDetail(page: Page, tab?: string) {
  const slip = page.waitForResponse(
    (res) => res.url().includes(`${PLANS_API}/`) && res.request().method() === "GET",
  );
  await page.goto(tab ? `${detailUrl}?planTab=${tab}` : detailUrl);
  expect((await slip).ok()).toBeTruthy();
  await expect(page.locator(".pdt-crumb--current")).toHaveText(planCode);
}

function tab(page: Page, name: string) {
  return page.getByRole("tab", { name, exact: true });
}

/**
 * Raises one Đặt mới labo order on the slip's first service line, the way the
 * plan row's "Tạo phiếu Labo" posts it — with the cookie the login left, no
 * interception. The supplier is created only when the branch has none.
 */
async function raiseLaboOrderOnFirstLine(page: Page, slipUrl: string): Promise<string> {
  const planId = slipUrl.match(/treatment-plan\/([0-9a-f-]{36})/)![1];
  return page.evaluate(
    async ({ planId, plans }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const plan = (await (
        await fetch(`${plans}/${planId}`, { credentials: "include" })
      ).json()) as { patientId: string; branchId: string; services: { id: string }[] };
      const headers = {
        "content-type": "application/json",
        "X-Clinic-Branch-Id": plan.branchId,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      const post = async (url: string, body: unknown) => {
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${url} → ${res.status} ${await res.text()}`);
        return (await res.json()) as { id: string; name: string; orderCode: string };
      };
      const suppliers = (await (
        await fetch(
          `/api/v1/app/labo-suppliers?ClinicBranchId=${plan.branchId}&IsActive=true&MaxResultCount=1`,
          { credentials: "include", headers },
        )
      ).json()) as { items: { name: string }[] };
      const supplierName =
        suppliers.items[0]?.name ??
        (
          await post("/api/v1/app/labo-suppliers", {
            name: `Labo e2e ${Date.now()}`,
            email: `labo-${Date.now()}@example.com`,
            clinicBranchId: plan.branchId,
          })
        ).name;
      const order = await post("/api/v1/app/labo-orders", {
        patientId: plan.patientId,
        branchId: plan.branchId,
        labProviderName: supplierName,
        kind: 1,
        quantity: 1,
        toothNumbers: "14",
        workDescription: "Phiếu Labo chặn chuyển đổi (kiểm thử)",
        sentAt: new Date().toISOString(),
        treatmentServiceId: plan.services[0].id,
      });
      return order.orderCode;
    },
    { planId, plans: PLANS_API },
  );
}

test.describe.configure({ mode: "serial" });

test.describe("Chi tiết kế hoạch điều trị", () => {
  test("the slip code opens the detail page with breadcrumb, tabs, stats and the service table", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    planCode = await createSlip(page);

    const slip = page.waitForResponse(
      (res) => res.url().includes(`${PLANS_API}/`) && res.request().method() === "GET",
    );
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

    // Four pill tabs, "Chi tiết" selected, and the six money figures.
    await expect(page.getByRole("tab")).toHaveText([
      "Chi tiết",
      "Thanh toán",
      "Hoàn tiền",
      "Dư nợ",
    ]);
    await expect(tab(page, "Chi tiết")).toHaveAttribute("aria-selected", "true");
    const labels = page.locator(".pdt-stat dt");
    await expect(labels).toHaveText([
      "Doanh thu dự kiến",
      "Đã thanh toán",
      "Công nợ",
      "Đã hoàn",
      "Tạm ứng",
      "Dư nợ",
    ]);
    for (const value of await page.locator(".pdt-stat dd").allInnerTexts())
      expect(value.trim()).toMatch(MONEY);
    expect(await statValue(page, "Doanh thu dự kiến")).toBeGreaterThan(0);
    expect(await statValue(page, "Đã thanh toán")).toBe(0);

    // The toolbar and the 16-column table with one line, in the reference's order.
    await expect(page.getByRole("combobox", { name: /Thêm dịch vụ mới/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Thêm công đoạn" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tạo Đơn Thuốc" })).toBeVisible();
    await expect(page.getByRole("button", { name: "In Hóa Đơn" })).toBeVisible();
    const headers = await page.locator(".pdt-table thead th").allInnerTexts();
    expect(headers.map((h) => h.trim())).toEqual([
      "",
      "Dịch vụ",
      "Chẩn đoán",
      "Bác sĩ điều trị",
      "Răng",
      "Số lượng",
      "Đơn giá",
      "Tổng giảm giá",
      "Thành tiền",
      "Tạm ứng",
      "Ghi chú",
      "Bác sĩ chẩn đoán 1",
      "Chẩn đoán 2",
      "Nhân sự tư vấn 1",
      "Nhân sự tư vấn 2",
      "Thao tác",
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
      "Chi tiết kế hoạch",
      "Thông tin khách hàng",
      "Thông tin nhân viên",
      "Thông tin thanh toán",
    ]);
    await detail.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(detail).toBeHidden();

    // The printer icon opens the slip's "Chi tiết phiếu" — a dialog, not a
    // download — with the clinic, the customer, the line and the money; what
    // "In Phiếu" sends to the printer is the hidden "Phiếu điều trị" sheet.
    let downloaded = false;
    page.once("download", () => {
      downloaded = true;
    });
    await page.getByRole("button", { name: "In phiếu điều trị" }).click();
    const slipDialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await expect(slipDialog).toBeVisible();
    await expect(slipDialog.locator(".pdt-receipt-section h3")).toHaveText([
      "Thông tin chi nhánh",
      "Thông tin khách hàng",
      "Chi tiết dịch vụ",
      "Tổng thanh toán dịch vụ",
    ]);
    await expect(
      slipDialog.locator(".pdt-receipt-fact", { hasText: "Phòng khám" }),
    ).not.toContainText("—");
    await expect(slipDialog.locator(".pdt-receipt-fact", { hasText: "Mã KH" })).toContainText(/\w/);
    await expect(slipDialog.locator(".pdt-receipt-table tbody tr.ant-table-row")).toHaveCount(1);
    await expect(slipDialog.locator(".pdt-receipt-totals dt")).toHaveText([
      "Tổng phí",
      "Đã trả trước đó",
      "Tổng còn nợ",
    ]);
    await expect(slipDialog.getByRole("button", { name: "In Phiếu" })).toBeVisible();
    const sheet = slipDialog.locator(".pdt-sheet");
    await expect(sheet).toHaveCount(1);
    await expect(sheet).toBeHidden();
    await expect(sheet.locator(".pdt-slip-sheet-title h2")).toHaveText("Phiếu điều trị");
    await expect(sheet.locator(".pdt-slip-sheet-table tbody tr")).toHaveCount(1);
    await expect(sheet.locator(".pdt-slip-sheet-signs > div")).toContainText([
      "Người lập phiếu",
      "Khách hàng",
    ]);
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
    await expect(
      page.locator(".pdt-table thead th").filter({ hasText: /^Mã thanh toán$/ }),
    ).toBeVisible();
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

    const collected = page.waitForResponse(
      (res) => res.url().includes(PAYMENTS_API) && res.request().method() === "POST",
    );
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
    await expect(sheet.locator(".pdt-sheet-signs > div")).toContainText([
      "Người lập phiếu",
      "Khách hàng",
    ]);
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
    await expect(
      page.getByText("Số tiền hoàn không được vượt quá số tiền đã thanh toán"),
    ).toBeVisible();

    const refund = Math.max(1, Math.floor(paidAmount / 2));
    const filed = page.waitForResponse(
      (res) => res.url().includes(PAYMENTS_API) && res.request().method() === "POST",
    );
    await input.fill(String(refund));
    await expect
      .poll(async () => money(await dialog.locator(".pdt-refund-total strong").innerText()))
      .toBe(refund);
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

  test("a reload keeps the tab, Dư nợ answers, and the status menu completes the line", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await openDetail(page, "refund");
    await page.reload();
    await expect(page.locator(".pdt-crumb--current")).toHaveText(planCode);
    await expect(tab(page, "Hoàn tiền")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".pdt-table tbody tr.ant-table-row").first()).toContainText(
      refundCode,
    );

    await tab(page, "Thanh toán").click();
    await expect(page.locator(".pdt-table tbody tr.ant-table-row").first()).toContainText(
      paymentCode,
    );

    // Nothing on this slip was settled from the held balance.
    await tab(page, "Dư nợ").click();
    await expect(page).toHaveURL(/planTab=debt/);
    await expect(page.locator(".pdt-table thead th").filter({ hasText: /^Dư nợ$/ })).toBeVisible();
    await expect(page.locator(".pdt-table")).toContainText("Không có dữ liệu");

    await tab(page, "Chi tiết").click();
    const row = page.locator(".pdt-table tbody tr.ant-table-row").first();
    await row.locator(".pdt-status--menu").click();
    const done = page.waitForResponse(
      (res) => res.url().includes("/complete") && res.request().method() === "POST",
    );
    await page.getByRole("menuitem", { name: "Hoàn thành" }).click();
    expect((await done).ok()).toBeTruthy();
    await expect(page.getByText("Đã hoàn thành dịch vụ")).toBeVisible();
    await expect(row.locator(".pdt-status")).toHaveText("Hoàn thành");
    await page.reload();
    await expect(
      page.locator(".pdt-table tbody tr.ant-table-row").first().locator(".pdt-status"),
    ).toHaveText("Hoàn thành");

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
    await expect(page.locator(".pdt-stat")).toHaveCount(6);

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
    await expect(dialog.locator(".tp-card-pager .ant-pagination-total-text")).toHaveText(
      PAGER_TOTAL,
    );
    // Polled, not read once: the dialog opens with antd's zoom, which scales
    // every box down for the first frames, and a single read lands inside it
    // and reports a box a fifth of its settled height.
    const note = dialog.getByRole("textbox", { name: "Nội dung" });
    await expect
      .poll(async () => (await note.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(120);
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

  test("a service row can be dragged into another slot and the order sticks", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    planCode = await createSlip(page);
    await page.locator(".tp-table .tp-code", { hasText: planCode }).click();
    await expect(page).toHaveURL(DETAIL_URL);
    const slipUrl = page.url().split("?")[0];

    // A second line, written through the toolbar's inline row.
    await page.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
    const option = openDropdown(page, ".tp-service-dropdown")
      .locator(".ant-select-item-option:has(.tp-opt-service)")
      .nth(1);
    await expect(option).toBeVisible();
    await option.click();

    /*
     * Every picker on the new row fills its column.
     *
     * AntD's Select sizes to its own content, so an empty one collapses to the
     * search icon and the caret — 71px inside a 200px cell, with the dropdown
     * cropped to match and the option names cut to "Sai …". The wrapper being
     * 100% wide is not enough; the control itself has to stretch.
     */
    const draft = page.locator(".pdt-row--draft");
    const pickers = draft.locator(".pdt-draft-select");
    await expect(pickers).toHaveCount(6);
    for (let index = 0; index < 6; index += 1) {
      const picker = pickers.nth(index);
      const cell = (await picker.locator("xpath=ancestor::td[1]").boundingBox())!;
      const select = (await picker.locator(".ant-select").boundingBox())!;
      // Its cell less the table's 16px side padding, give or take a subpixel.
      expect(Math.abs(select.width - (cell.width - 32))).toBeLessThanOrEqual(2);
    }

    const added = page.waitForResponse(
      (res) => res.url().includes("/services") && res.request().method() === "POST",
    );
    await draft.getByRole("button", { name: "Lưu" }).click();
    expect((await added).ok()).toBeTruthy();

    const names = () =>
      page.locator(".pdt-table tbody tr.ant-table-row .pdt-service-name").allInnerTexts();
    // Captured by the poll itself: reading the list again afterwards can catch
    // the table mid-refetch and come back one row short.
    let before: string[] = [];
    await expect
      .poll(async () => {
        before = await names();
        return before.length;
      })
      .toBe(2);

    // A real pointer drag, walked in steps: the row follows the pointer and the
    // rows it passes move out of its way, so one jump would land nowhere. The
    // boxes are read once the table has settled — measuring while the slip is
    // still refetching grabs coordinates the rows have already left.
    const grips = page.locator(".pdt-table tbody tr.ant-table-row button.pdt-grip");
    await expect(grips).toHaveCount(2);
    const from = (await grips.first().boundingBox())!;
    const to = (await grips.last().boundingBox())!;
    const x = from.x + from.width / 2;
    const start = from.y + from.height / 2;
    // Past the far row's bottom edge, so the pointer certainly crosses it.
    const finish = to.y + to.height;

    const saved = page.waitForResponse(
      (res) => res.url().includes("/services/reorder") && res.request().method() === "POST",
    );
    await page.mouse.move(x, start);
    await page.mouse.down();
    const swapped = async () => (await names())[0] === before[1];
    for (let pass = 0; pass < 3 && !(await swapped()); pass++) {
      for (let step = 1; step <= 10; step++) {
        await page.mouse.move(x, start + ((finish - start) * step) / 10);
        await page.waitForTimeout(20);
      }
    }
    expect(await swapped()).toBe(true);
    await page.mouse.up();
    expect((await saved).ok()).toBeTruthy();

    await expect.poll(names).toEqual([before[1], before[0]]);
    await page.goto(slipUrl);
    await expect.poll(names).toEqual([before[1], before[0]]);
  });

  test("Chuyển đổi closes a line and writes the service that replaces it", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    planCode = await createSlip(page);
    await page.locator(".tp-table .tp-code", { hasText: planCode }).click();
    await expect(page).toHaveURL(DETAIL_URL);
    const slipUrl = page.url().split("?")[0];

    const row = page.locator(".pdt-table tbody tr.ant-table-row").first();
    const oldName = await row.locator(".pdt-service-name").innerText();
    await row.locator(".pdt-status--menu").click();
    await page.getByRole("menuitem", { name: "Chuyển đổi" }).click();

    const dialog = page.getByRole("dialog", { name: "Chuyển đổi dịch vụ" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".cvt-head")).toHaveText([
      "Dịch vụ hiện tại",
      "Thông tin thanh toán hiện tại",
      "Dịch vụ mới",
      "Thông tin thanh toán",
    ]);
    // "Thay thế" is the conversion the dialog opens on, its label centred in
    // the card rather than sitting on the baseline.
    await expect(dialog.getByRole("radio", { name: "Thay thế" })).toBeChecked();
    const offCentre = await dialog
      .locator(".cvt-kind .ant-radio-wrapper")
      .first()
      .evaluate((el) => {
        const label = el.querySelector("span:last-child")!;
        const card = el.getBoundingClientRect();
        const text = label.getBoundingClientRect();
        return Math.abs(text.top + text.height / 2 - (card.top + card.height / 2));
      });
    expect(offCentre).toBeLessThanOrEqual(1);

    // The dialog carries all of its content: it has no scroller of its own.
    const body = dialog.locator(".ant-modal-body");
    expect(await body.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);

    // Nothing saves until the dialog has a service, a note and its two staff.
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog.locator(".cvt-error").first()).toBeVisible();
    await expect(dialog).toBeVisible();

    await dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
    const service = openDropdown(page, ".tp-service-dropdown")
      .locator(".ant-select-item-option:has(.tp-opt-service)")
      .nth(1);
    await expect(service).toBeVisible();
    await service.click();
    await dialog.getByRole("textbox", { name: /Ghi chú/ }).fill("Chuyển đổi trong kiểm thử");
    await pickFirstOption(page, dialog.getByRole("combobox", { name: "Bác sĩ chẩn đoán 1" }));
    await pickFirstOption(page, dialog.getByRole("combobox", { name: "Nhân sự tư vấn 1" }));

    const converted = page.waitForResponse(
      (res) => res.url().includes("/convert") && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await converted).ok()).toBeTruthy();
    await expect(page.getByText("Đã chuyển đổi dịch vụ")).toBeVisible();
    await expect(dialog).toBeHidden();

    const rows = page.locator(".pdt-table tbody tr.ant-table-row");
    await expect.poll(async () => rows.count()).toBe(2);
    // Newest first, so the line that replaces it reads above the closed one.
    const closed = rows.filter({ hasText: oldName }).first();
    await expect(closed.locator(".pdt-status")).toHaveText("Chuyển đổi");
    // A closed line offers no menu any more.
    await expect(closed.locator(".pdt-status--menu")).toHaveCount(0);
    await expect(rows.locator(".pdt-status")).toHaveText(["Đã tạo", "Chuyển đổi"]);
    await expect(rows.first()).toContainText("Chuyển đổi trong kiểm thử");

    await page.goto(slipUrl);
    await expect(page.locator(".pdt-table tbody tr.ant-table-row")).toHaveCount(2);
    await expect(page.locator(".pdt-table")).toContainText("Chuyển đổi");
  });

  /**
   * The reference's statusClinic (staging, 2026-09-24): while a Labo slip of
   * the line is still with the labo, the Chuyển đổi dialog carries a block at
   * the foot of its left column and Lưu is disabled; Hủy phiếu Labo asks for
   * confirmation, cancels every open slip and the block goes — no toast.
   */
  test("a line with an open Labo slip must cancel it before it converts", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    planCode = await createSlip(page);
    await page.locator(".tp-table .tp-code", { hasText: planCode }).click();
    await expect(page).toHaveURL(DETAIL_URL);
    const slipUrl = page.url().split("?")[0];
    const orderCode = await raiseLaboOrderOnFirstLine(page, slipUrl);

    // The row read before the order was raised: reload so the slip carries it.
    await page.goto(slipUrl);
    const row = page.locator(".pdt-table tbody tr.ant-table-row").first();
    await row.locator(".pdt-status--menu").click();
    await page.getByRole("menuitem", { name: "Chuyển đổi" }).click();

    const dialog = page.getByRole("dialog", { name: "Chuyển đổi dịch vụ" });
    await expect(dialog).toBeVisible();
    const block = dialog.locator(".cvt-labo-block");
    await expect(block).toContainText(
      "Dịch vụ đang có phiếu Labo, vui lòng hủy phiếu Labo trước khi thay đổi dịch vụ.",
    );
    await expect(block.locator("strong")).toHaveText(["phiếu Labo", "hủy phiếu Labo"]);
    await expect(dialog.getByRole("button", { name: "Lưu" })).toBeDisabled();

    await block.getByRole("button", { name: "Hủy phiếu Labo" }).click();
    const confirm = page.getByRole("dialog", { name: "Xác nhận hủy phiếu Labo" });
    await expect(confirm).toBeVisible();
    await expect(confirm.locator(".pdt-confirm-text")).toHaveText([
      "Tất cả Phiếu Labo liên quan sẽ chuyển sang trạng thái 'Hủy'",
      "Hành động này không thể hoàn tác.",
    ]);
    // Đóng backs out; nothing changes.
    await confirm.locator(".pdt-confirm-foot").getByRole("button", { name: "Đóng" }).click();
    await expect(confirm).toBeHidden();
    await expect(block).toBeVisible();

    await block.getByRole("button", { name: "Hủy phiếu Labo" }).click();
    const cleared = page.waitForResponse(
      (res) => res.url().includes("/cancel-labo-orders") && res.request().method() === "POST",
    );
    await confirm.getByRole("button", { name: "Xác nhận" }).click();
    expect((await cleared).ok()).toBeTruthy();
    await expect(confirm).toBeHidden();
    await expect(block).toBeHidden();
    await expect(dialog.getByRole("button", { name: "Lưu" })).toBeEnabled();
    await expect(page.locator(".ant-message, [data-sonner-toast]")).toHaveCount(0);

    // Persisted: the patient's Labo tab now files the slip as Đã huỷ on both pills.
    await page.goto(`${patientUrl}?tab=labo`);
    const laboRow = page.locator("tr.ant-table-row", { hasText: orderCode }).first();
    await expect(laboRow).toBeVisible();
    await expect(laboRow).toContainText("Đã huỷ");
    // And the dialog no longer carries the block once reopened.
    await page.goto(slipUrl);
    await page
      .locator(".pdt-table tbody tr.ant-table-row")
      .first()
      .locator(".pdt-status--menu")
      .click();
    await page.getByRole("menuitem", { name: "Chuyển đổi" }).click();
    await expect(page.getByRole("dialog", { name: "Chuyển đổi dịch vụ" })).toBeVisible();
    await expect(page.locator(".cvt-labo-block")).toHaveCount(0);
  });

  /**
   * A line whose work is already finished stays where it is.
   *
   * The reference words two separate refusals, read off its published bundle
   * 2026-09-22 — `treatment.validation.convertNotAllowed`
   * ("Dịch vụ đã hoàn thành/huỷ không được phép chuyển đổi.") for a closed
   * line. BlueDental adds the owner's rule beside it: a line that carries a
   * **finished công đoạn** is refused even while its own status is still open,
   * because that work was done and charged against this very service.
   */
  test("a line with a finished công đoạn refuses to be converted, and says why", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    // Two teeth: since 2026-09-24 a công đoạn holds its own teeth, so two
    // separate công đoạn on one line need a tooth each.
    planCode = await createSlip(page, [14, 15]);
    await page.locator(".tp-table .tp-code", { hasText: planCode }).click();
    await expect(page).toHaveURL(DETAIL_URL);

    /*
     * Two công đoạn, only the first finished. That is the case under test: the
     * line itself is still Đang điều trị — so it keeps its status menu and the
     * dialog can still be opened — while one piece of its work is already done.
     * Finishing the only công đoạn would close the line instead, and a closed
     * line offers no menu at all.
     */
    const planId = page.url().split("?")[0].split("/").pop()!;
    const done = await page.evaluate(async (id) => {
      const branchId = new URLSearchParams(location.search).get("branchId")!;
      const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branchId };
      const plan = await (
        await fetch(`/api/v1/app/patient-treatments/${id}`, { credentials: "include", headers })
      ).json();
      const line = plan.services[0];
      const staff = await (
        await fetch("/api/v1/app/staff?MaxResultCount=1", { credentials: "include" })
      ).json();
      const add = async (note: string, teeth: unknown[]) => {
        const res = await fetch("/api/v1/app/treatment-stages", {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            patientId: plan.patientId,
            clinicBranchId: branchId,
            treatmentId: id,
            treatmentServiceId: line.id,
            serviceId: line.serviceId,
            name: line.serviceName ?? line.code,
            note,
            staffId: staff.items[0].id,
            teeth,
          }),
        });
        return { status: res.status, id: res.ok ? (await res.json()).id : null };
      };
      const first = await add("e2e công đoạn đã xong", line.teeth.slice(0, 1));
      const second = await add("e2e công đoạn còn lại", line.teeth.slice(1));
      const finished = await fetch(`/api/v1/app/treatment-stages/${first.id}/complete`, {
        method: "POST",
        credentials: "include",
        headers,
      });
      return {
        first: first.status,
        second: second.status,
        finished: finished.status,
        lineId: line.id,
      };
    }, planId);
    expect(done.first, "the first công đoạn should have been created").toBe(200);
    expect(done.second, "the second công đoạn should have been created").toBe(200);
    expect(done.finished, "the first công đoạn should have been finished").toBe(200);

    await page.reload();
    const row = page.locator(".pdt-table tbody tr.ant-table-row").first();
    await expect(row).toBeVisible();
    // Still open, so the menu is there and the dialog can be reached.
    await expect(row.locator(".pdt-status")).toHaveText("Đang điều trị");
    const menu = row.locator(".pdt-status--menu");
    await expect(menu).toHaveCount(1);

    await menu.click();
    await page.getByRole("menuitem", { name: "Chuyển đổi" }).click();
    const dialog = page.getByRole("dialog", { name: "Chuyển đổi dịch vụ" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
    const service = openDropdown(page, ".tp-service-dropdown")
      .locator(".ant-select-item-option:has(.tp-opt-service)")
      .nth(1);
    await expect(service).toBeVisible();
    await service.click();
    await dialog.getByRole("textbox", { name: /Ghi chú/ }).fill("e2e thử chuyển đổi");
    await pickFirstOption(page, dialog.getByRole("combobox", { name: "Bác sĩ chẩn đoán 1" }));
    await pickFirstOption(page, dialog.getByRole("combobox", { name: "Nhân sự tư vấn 1" }));

    const answered = page.waitForResponse(
      (res) => res.url().includes("/convert") && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await answered).ok(), "the server should refuse this conversion").toBe(false);

    // The reason reaches the screen — not a generic internal error.
    await expect(page.getByText(/công đoạn hoàn thành|đã hoàn thành\/huỷ/)).toBeVisible();
    await expect(page.getByText(/lỗi nội bộ/i)).toHaveCount(0);

    // And nothing was converted: the line is still the only one on the slip.
    await page.reload();
    await expect(page.locator(".pdt-table tbody tr.ant-table-row")).toHaveCount(1);
  });

  test("a conversion carries the money across and refunds what is left over", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    planCode = await createSlip(page);
    await page.locator(".tp-table .tp-code", { hasText: planCode }).click();
    await expect(page).toHaveURL(DETAIL_URL);
    const slipUrl = page.url().split("?")[0];

    // Collect the whole line first, so the conversion has money to move.
    await tab(page, "Thanh toán").click();
    await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
    const payDialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
    const payLine = payDialog.locator(".pd-newpay-lines > li").first();
    await payLine.locator("input[type=checkbox]").check();
    const due = money(await payLine.locator(".pd-newpay-due").innerText());
    expect(due).toBeGreaterThan(1);
    const collected = page.waitForResponse(
      (res) => res.url().includes(PAYMENTS_API) && res.request().method() === "POST",
    );
    await payDialog.locator(".pd-newpay-amount").fill(String(due));
    await payDialog.getByRole("button", { name: "Lưu" }).click();
    expect((await collected).ok()).toBeTruthy();
    await expect.poll(() => statValue(page, "Đã thanh toán")).toBe(due);

    // Convert it, charging 1 đ, so almost everything collected is left over.
    await tab(page, "Chi tiết").click();
    const row = page.locator(".pdt-table tbody tr.ant-table-row").first();
    await expect.poll(async () => money(await row.locator("td").nth(9).innerText())).toBe(due);
    await row.locator(".pdt-status--menu").click();
    await page.getByRole("menuitem", { name: "Chuyển đổi" }).click();
    const dialog = page.getByRole("dialog", { name: "Chuyển đổi dịch vụ" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".cvt-col").first()).toContainText("Đã thanh toán");

    // "Dịch vụ cũ" re-issues the same service at the price it was sold for, so
    // the new total is known here without depending on what the catalog holds.
    await dialog.getByRole("radio", { name: "Dịch vụ cũ" }).check();
    await expect(dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ })).toHaveCount(0);
    await expect
      .poll(async () =>
        money(await dialog.locator(".cvt-col").last().locator(".cvt-fact").first().innerText()),
      )
      .toBe(due);

    // Typed rather than filled: the currency field only takes what a real
    // keystroke produces (react-number-format ignores a programmatic set).
    await dialog.getByRole("textbox", { name: "Thanh toán" }).pressSequentially("1");
    await dialog.getByRole("textbox", { name: /Ghi chú/ }).fill("Chuyển đổi rẻ hơn trong kiểm thử");
    await pickFirstOption(page, dialog.getByRole("combobox", { name: "Bác sĩ chẩn đoán 1" }));
    await pickFirstOption(page, dialog.getByRole("combobox", { name: "Nhân sự tư vấn 1" }));

    // Now that the new service costs less than what was collected, the dialog
    // asks what to do with the difference and prints it.
    await expect(dialog.getByText("Xử lý chênh lệch")).toBeVisible();
    const refundRow = dialog.locator(".cvt-fact", { hasText: "Hoàn trả chênh lệch" });
    await expect.poll(async () => money(await refundRow.innerText())).toBe(due - 1);
    await dialog.getByRole("radio", { name: "Hoàn tiền" }).check();

    const converted = page.waitForResponse(
      (res) => res.url().includes("/convert") && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await converted).ok()).toBeTruthy();
    await expect(dialog).toBeHidden();

    // 1 đ followed the patient onto the new line; the rest came back as a refund.
    const rows = page.locator(".pdt-table tbody tr.ant-table-row");
    await expect.poll(async () => rows.count()).toBe(2);
    // Newest first: the new line is the one on top.
    await expect
      .poll(async () => money(await rows.first().locator("td").nth(9).innerText()))
      .toBe(1);
    await expect.poll(() => statValue(page, "Đã hoàn")).toBe(due - 1);

    await tab(page, "Hoàn tiền").click();
    await expect(page.locator(".pdt-table tbody tr.ant-table-row")).toHaveCount(1);
    await expect(page.locator(".pdt-table")).toContainText(
      "Hoàn trả chênh lệch chuyển đổi dịch vụ",
    );

    await page.goto(`${slipUrl}?planTab=refund`);
    await expect(page.locator(".pdt-table tbody tr.ant-table-row")).toHaveCount(1);
  });
});
