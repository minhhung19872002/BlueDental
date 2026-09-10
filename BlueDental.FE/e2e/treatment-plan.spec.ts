import { expect, test, type Browser, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login } from "./fixtures/auth";

/**
 * Feature: Kế hoạch điều trị (F-21), the patient's treatment-plan tab.
 *
 * "Tạo kế hoạch mới" opens the slip dialog: pick a service, the dentist and
 * the diagnosis, choose teeth on the chart, save. The tab then lists the slip
 * with its money columns (every cell carries " đ"), the derived "Đã tạo"
 * pill, and the app's shared pager (page-size select, "Hiển thị a-b/n"). Under
 * 640px the table folds into grouped cards.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL. The
 * tests run in order and hand the slip they made down the line, so the later
 * ones have a row to open and the isolation check has something to refuse.
 */

const PLANS_API = "/api/v1/app/patient-treatments";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const CODE = /^DT\d+$/;
const PAGER_TOTAL = /^Hiển thị \d+-\d+\/\d+$/;

let patientUrl = "";
let createdCode = "";
let pickedService = "";

async function freshPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

async function openFirstPatient(page: Page): Promise<string> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
  await expect(firstName).toBeVisible();
  await firstName.click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  return page.url().split("?")[0];
}

async function openPlanTab(page: Page) {
  const listed = page.waitForResponse(
    (res) => res.url().includes(PLANS_API) && res.request().method() === "GET",
  );
  await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
  expect((await listed).ok()).toBeTruthy();
  await expect(page.getByRole("button", { name: "Tạo kế hoạch mới" })).toBeVisible();
}

function planCodes(page: Page) {
  return page.locator(".tp-table .tp-code").allTextContents();
}

/**
 * The AntD dropdown that is actually open. Closed ones stay in the DOM, and
 * the service picker's own panel keeps its box for a beat after a pick, so
 * plain fields look past it to the newest panel.
 */
function openDropdown(page: Page, panel = ".ant-select-dropdown:not(.tp-service-dropdown)") {
  return page.locator(`${panel}:not(.ant-select-dropdown-hidden)`).last();
}

async function pickFirstOption(page: Page, combobox: ReturnType<Page["getByRole"]>) {
  await combobox.click();
  const option = openDropdown(page).locator(".ant-select-item-option").first();
  await expect(option).toBeVisible();
  await option.click();
}

test.describe.configure({ mode: "serial" });

test.describe("Kế hoạch điều trị", () => {
  test("Tạo kế hoạch mới saves a slip with teeth and lists it with its money columns", async ({
    page,
  }) => {
    await login(page);
    patientUrl = await openFirstPatient(page);
    await openPlanTab(page);

    const before = await planCodes(page);

    await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo phiếu dịch vụ" });
    await expect(dialog).toBeVisible();

    // The service picker: a group row opens the group, a service row is the value.
    await dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
    const service = openDropdown(page, ".tp-service-dropdown")
      .locator(".ant-select-item-option:has(.tp-opt-service)")
      .first();
    await expect(service).toBeVisible();
    pickedService = (await service.locator(".tp-opt-name").innerText()).trim();
    await service.click();

    await pickFirstOption(page, dialog.getByRole("combobox", { name: /Bác sĩ chẩn đoán/ }));
    await pickFirstOption(page, dialog.getByRole("combobox", { name: /^Chẩn đoán/ }));

    // Teeth come from the chart dialog; the pick lands on the slip as "Răng: 14".
    await dialog.locator(".tp-tooth-btn").click();
    const picker = page.getByRole("dialog", { name: "Chọn răng" });
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Răng 14", exact: true }).click();
    await picker.locator(".tp-teeth-foot button").click();
    await expect(picker).toBeHidden();
    await expect(dialog.locator(".tp-create-teeth")).toContainText("14");

    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã tạo kế hoạch điều trị")).toBeVisible();
    await expect(dialog).toBeHidden();

    // A slip that was not there before, with the reference's number format.
    // Looked for by code rather than by count: the list is paged at 20, so a
    // record that already fills a page cannot grow by one.
    await expect
      .poll(async () => (await planCodes(page)).find((code) => !before.includes(code)) ?? "", {
        timeout: 15_000,
      })
      .toMatch(CODE);
    const after = await planCodes(page);
    createdCode = after.find((code) => !before.includes(code)) ?? "";

    const row = page.locator(".tp-table tr.ant-table-row", { hasText: createdCode });
    await expect(row.locator(".tp-pill")).toHaveText("Đã tạo");
    const money = await row.locator(".tp-cell-money").allInnerTexts();
    expect(money.length).toBeGreaterThanOrEqual(5);
    for (const cell of money) expect(cell.trim()).toMatch(/\d đ$/);

    // The app's shared pager: page-size select, "Hiển thị a-b/n", prev/next.
    const pager = page.locator(".tp-table .ant-table-pagination");
    await expect(pager.locator(".ant-pagination-options .ant-select")).toContainText("20 / trang");
    await expect(pager.locator(".ant-pagination-total-text")).toHaveText(PAGER_TOTAL);
    await expect(pager.locator(".ant-pagination-prev")).toBeVisible();
    await expect(pager.locator(".ant-pagination-next")).toBeVisible();
  });

  test("the slip survives a reload and opens its service list and actions", async ({ page }) => {
    await login(page);
    await page.goto(`${patientUrl}?tab=treatment-plan`);
    await assertRealApiTraffic(page, PLANS_API);

    const row = page.locator(".tp-table tr.ant-table-row", { hasText: createdCode });
    await expect(row).toBeVisible();

    // Eye: the slip's own service list, teeth above the service name.
    await row.getByRole("button", { name: `Danh sách dịch vụ - ${createdCode}` }).click();
    const services = page.getByRole("dialog", { name: `Danh sách dịch vụ - ${createdCode}` });
    await expect(services).toBeVisible();
    await expect(services).toContainText(pickedService);
    await expect(services).toContainText("14");
    await expect(services.locator(".tp-pill").first()).toHaveText("Đã tạo");
    await page.keyboard.press("Escape");
    await expect(services).toBeHidden();

    // "+" opens the stage dialog for this slip.
    await row.getByRole("button", { name: `Thêm công đoạn ${createdCode}` }).click();
    const stage = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await expect(stage).toBeVisible();
    await expect(stage).toContainText(pickedService);
    await page.keyboard.press("Escape");
    await expect(stage).toBeHidden();

    // The clipboard action opens "In bệnh án": the record files, the patient's
    // identity filled from their record, and the reference's zoom control.
    await row.getByRole("button", { name: `In bệnh án ${createdCode}` }).click();
    const print = page.getByRole("dialog", { name: "In bệnh án" });
    await expect(print).toBeVisible();
    // Opens on "Bìa hồ sơ bệnh án" at 85%, as the reference does. The sheet is
    // its own document, so the assertions reach into it.
    await expect(print.locator(".pmr-zoom-value")).toHaveText("85%");
    const sheet = page.frameLocator(".pmr-scale .mr-doc-frame");
    await expect(sheet.locator(".nfc-tpl")).toContainText("BỆNH ÁN");
    await expect(
      sheet.locator('[data-medical-record-field="cover.patient.code"]'),
    ).not.toBeEmpty();
    // Zoom steps 5% and "Fit" resets to 85%, both measured on the reference.
    await print.getByRole("button", { name: "Phóng to bản xem trước" }).click();
    await expect(print.locator(".pmr-zoom-value")).toHaveText("90%");
    await print.getByRole("button", { name: "Fit" }).click();
    await expect(print.locator(".pmr-zoom-value")).toHaveText("85%");
    // The picker carries the nine printed forms; choosing one redraws the sheet.
    await print.locator(".pmr-file .ant-select").click();
    await openDropdown(page).getByText("Bệnh án ngoại trú Răng Hàm Mặt").click();
    await expect(
      page.frameLocator(".pmr-scale .mr-doc-frame").locator(".nfc-tpl"),
    ).toContainText("BỆNH ÁN NGOẠI TRÚ");

    /*
     * Printing from here has four modal layers between the sheet and the page,
     * every one of them a fixed-height clipping box — a record longer than the
     * window came out as a single page. What goes on the paper is the record
     * alone, at its full length, whatever the preview was zoomed to.
     */
    await page.evaluate(() => {
      window.print = () => {
        (window as unknown as { __printed?: boolean }).__printed = true;
      };
    });
    await print.locator(".pmr-foot").getByRole("button", { name: "In bệnh án" }).click();
    expect(await page.evaluate(() => (window as unknown as { __printed?: boolean }).__printed)).toBe(
      true,
    );

    await page.emulateMedia({ media: "print" });
    const paper = await page.evaluate(() => {
      const doc = document.querySelector<HTMLElement>(".mr-doc")!;
      const box = doc.getBoundingClientRect();
      const clipping: string[] = [];
      for (let node = doc.parentElement; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.overflowY !== "visible" || style.overflowX !== "visible") {
          clipping.push(`${node.tagName}.${String(node.className).split(" ")[0]}`);
        }
      }
      return {
        top: Math.round(box.top + window.scrollY),
        height: Math.round(box.height),
        zoom: getComputedStyle(doc).zoom,
        rootHeight: Math.round(document.documentElement.getBoundingClientRect().height),
        clipping,
      };
    });
    await page.emulateMedia({ media: null });

    expect(paper.top).toBe(0);
    expect(paper.zoom).toBe("1");
    expect(paper.rootHeight).toBe(paper.height);
    expect(paper.clipping).toEqual([]);

    // Scoped to the footer: the modal's own X is labelled "Đóng" as well.
    await print.locator(".pmr-foot").getByRole("button", { name: "Đóng" }).click();
    await expect(print).toBeHidden();

    // The receipt action opens the invoice for this slip.
    await row.getByRole("button", { name: `Phiếu thu ${createdCode}` }).click();
    const invoice = page.getByRole("dialog", { name: "Hóa đơn" });
    await expect(invoice).toBeVisible();
    await expect(invoice).toContainText(pickedService);
    // Every field carries the app's floating label rather than a caption above
    // it: a filled one lifts the label onto the border, an empty one keeps it
    // resting inside as the placeholder.
    await expect(invoice.locator(".inv-field.floating-field")).toHaveCount(13);
    const customerName = invoice.locator(".inv-field").first();
    await expect(customerName).toHaveClass(/floating-field--floated/);
    await expect(customerName).toContainText("Tên khách hàng");
    await expect(invoice.locator(".inv-field", { hasText: "CMND/CCCD" })).not.toHaveClass(
      /floating-field--floated/,
    );
    await page.keyboard.press("Escape");
    await expect(invoice).toBeHidden();

    // Xem tất cả dịch vụ: every line on every slip, paged like the slip table.
    await page.getByRole("button", { name: "Xem tất cả dịch vụ" }).click();
    const all = page.getByRole("dialog", { name: "Danh sách dịch vụ" });
    await expect(all).toBeVisible();
    await expect(all).toContainText(pickedService);
    await expect(all.locator(".ant-pagination-total-text")).toHaveText(PAGER_TOTAL);
    await page.keyboard.press("Escape");
  });

  /**
   * Regression: the row reads "Tổng phiếu" − "Giảm giá" = "Thành tiền", but the
   * rollup the API answers with is already net of both discounts. Only a slip
   * that actually carries a discount catches the total being taken off twice,
   * so this one sets its own price and discount rather than taking the
   * catalogue's.
   */
  test("a discounted slip prints the gross, the discount and what is owed", async ({ page }) => {
    await login(page);
    // Runs inside the serial file, but stays runnable on its own with -g.
    const url = patientUrl || (await openFirstPatient(page));
    await page.goto(`${url}?tab=treatment-plan`);
    await assertRealApiTraffic(page, PLANS_API);

    const before = await planCodes(page);

    await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo phiếu dịch vụ" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
    const service = openDropdown(page, ".tp-service-dropdown")
      .locator(".ant-select-item-option:has(.tp-opt-service)")
      .first();
    await expect(service).toBeVisible();
    const lineName = (await service.locator(".tp-opt-name").innerText()).trim();
    await service.click();

    await pickFirstOption(page, dialog.getByRole("combobox", { name: /Bác sĩ chẩn đoán/ }));
    await pickFirstOption(page, dialog.getByRole("combobox", { name: /^Chẩn đoán/ }));

    await dialog.locator(".tp-tooth-btn").click();
    const picker = page.getByRole("dialog", { name: "Chọn răng" });
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Răng 14", exact: true }).click();
    await picker.locator(".tp-teeth-foot button").click();
    await expect(picker).toBeHidden();

    await dialog.getByRole("textbox", { name: "Đơn giá" }).fill("2500000");
    await dialog.locator(".tp-toggle button", { hasText: "VNĐ" }).click();
    await dialog.locator(".tp-create-discount input:visible").fill("100000");
    await expect(dialog.locator(".tp-create-summary")).toContainText("2.400.000");

    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã tạo kế hoạch điều trị")).toBeVisible();
    await expect(dialog).toBeHidden();

    await expect
      .poll(async () => (await planCodes(page)).find((code) => !before.includes(code)) ?? "", {
        timeout: 15_000,
      })
      .toMatch(CODE);
    const code = (await planCodes(page)).find((item) => !before.includes(item)) ?? "";

    const cells = page.locator(".tp-table tr.ant-table-row", { hasText: code }).locator(".tp-cell-money");
    await expect(cells.nth(0)).toHaveText("2.500.000 đ"); // Tổng phiếu — gross
    await expect(cells.nth(1)).toHaveText("100.000 đ"); // Giảm giá
    await expect(cells.nth(2)).toHaveText("2.400.000 đ"); // Thành tiền

    // The line the row rolls up: the same gross, the same amount owed.
    await page
      .locator(".tp-table tr.ant-table-row", { hasText: code })
      .getByRole("button", { name: `Danh sách dịch vụ - ${code}` })
      .click();
    const services = page.getByRole("dialog", { name: `Danh sách dịch vụ - ${code}` });
    const line = services.locator("tr.ant-table-row", { hasText: lineName }).first();
    await expect(line.locator(".tp-cell-money").nth(0)).toHaveText("2.500.000 đ");
    await expect(line.locator(".tp-cell-money").nth(1)).toHaveText("2.400.000 đ");
    await page.keyboard.press("Escape");
    await expect(services).toBeHidden();
  });

  test("Cột hiển thị hides a column until the next reload", async ({ page }) => {
    await login(page);
    await page.goto(`${patientUrl}?tab=treatment-plan`);
    await assertRealApiTraffic(page, PLANS_API);

    await expect(page.getByRole("columnheader", { name: "Ngày tạo" })).toBeVisible();
    await page.getByRole("button", { name: "Cột hiển thị" }).click();
    await page.getByRole("switch", { name: "Ngày tạo" }).click();
    await page.locator(".tp-columns-save").click();
    await expect(page.getByRole("columnheader", { name: "Ngày tạo" })).toHaveCount(0);

    // The reference keeps the layout in memory only.
    await page.reload();
    await assertRealApiTraffic(page, PLANS_API);
    await expect(page.getByRole("columnheader", { name: "Ngày tạo" })).toBeVisible();
  });

  test("under 640px the table folds into grouped cards with their own pager", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    await login(page);
    await page.goto(`${patientUrl}?tab=treatment-plan`);
    await assertRealApiTraffic(page, PLANS_API);

    const card = page.locator(".bd-rc-card", { hasText: createdCode });
    await expect(card).toBeVisible();
    await expect(page.locator(".tp-table .ant-table")).toHaveCount(0);

    await card.getByRole("button", { name: "Xem thêm" }).click();
    await expect(card.getByRole("button", { name: "Rút gọn" })).toBeVisible();
    await expect(card).toContainText("Phải thu");

    const pager = page.locator(".tp-card-pager");
    await expect(pager).toBeVisible();
    await expect(pager.locator(".ant-pagination-total-text")).toHaveText(PAGER_TOTAL);
  });

  test("an account limited to another branch is refused the slips", async ({ browser }) => {
    const page = await freshPage(browser);
    await login(page, BRANCH2_USER);

    const patientId = patientUrl.split("/").pop() ?? "";
    const refused = await page.evaluate(async (url) => {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, items: (json.items ?? []) as unknown[] };
    }, `${PLANS_API}?patientId=${patientId}&clinicBranchId=${BRANCH_ONE}`);
    expect(refused.status).toBe(403);
    expect(refused.items).toHaveLength(0);

    await page.goto(`${patientUrl}?tab=treatment-plan`);
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
    await expect(page.locator(".tp-table .tp-code", { hasText: createdCode })).toHaveCount(0);
    await page.close();
  });
});
