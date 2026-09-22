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

/** "2.500.000 đ" → 2500000. */
function money(text: string): number {
  return Number(text.replace(/[^\d]/g, ""));
}

/** 2500000 → "2.500.000", the way the app prints it. */
function vnd(value: number): string {
  return value.toLocaleString("vi-VN");
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

    // "Nhân sự tư vấn 1" is the one field the dialog opens with, and it is
    // required before anything else can be saved.
    await pickFirstOption(page, dialog.getByRole("combobox", { name: /Nhân sự tư vấn 1/ }));

    // The service picker: a group row opens the group, a service row is the value.
    await dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
    const service = openDropdown(page, ".tp-service-dropdown")
      .locator(".ant-select-item-option:has(.tp-opt-service)")
      .first();
    await expect(service).toBeVisible();
    pickedService = (await service.locator(".tp-opt-name").innerText()).trim();
    await service.click();

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

  test("the form says what is missing under the field, and the price is the catalog's", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${patientUrl}?tab=treatment-plan`);
    await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo phiếu dịch vụ" });
    await expect(dialog).toBeVisible();

    await pickFirstOption(page, dialog.getByRole("combobox", { name: /Nhân sự tư vấn 1/ }));
    await dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
    const service = openDropdown(page, ".tp-service-dropdown")
      .locator(".ant-select-item-option:has(.tp-opt-service)")
      .first();
    await expect(service).toBeVisible();
    const listed = (await service.locator(".tp-opt-price").innerText()).trim();
    await service.click();

    // The service sets the money, and neither figure can be typed over.
    const price = dialog.getByRole("textbox", { name: "Đơn giá" });
    const quantity = dialog.getByRole("spinbutton", { name: "Số lượng" });
    await expect(price).toBeDisabled();
    await expect(quantity).toBeDisabled();
    expect(`${await price.inputValue()} đ`).toBe(listed);
    await expect(quantity).toHaveValue("1");

    // Neither diagnosis field can be touched: a slip raised here files no
    // chẩn đoán, so there is nothing to pick and nothing to require.
    await expect(dialog.getByRole("combobox", { name: "Bác sĩ chẩn đoán 1" })).toBeDisabled();
    await expect(dialog.getByRole("combobox", { name: "Chẩn đoán 2" })).toBeDisabled();
    await expect(dialog.locator(".floating-field", { hasText: "Chẩn đoán 2" })).not.toContainText(
      "*",
    );

    // Saving with no teeth says so **under the field**, not in a toast.
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog.locator(".tp-create-error")).toHaveText("Vui lòng chọn ít nhất 1 răng");
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    await expect(dialog).toBeVisible();

    // Picking teeth clears it again.
    await dialog.locator(".tp-tooth-btn").click();
    const picker = page.getByRole("dialog", { name: "Chọn răng" });
    await picker.getByRole("button", { name: "Răng 14", exact: true }).click();
    await picker.locator(".tp-teeth-foot button").click();
    await expect(dialog.locator(".tp-create-error")).toHaveCount(0);

    await dialog.getByRole("button", { name: "Đóng" }).last().click();
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
     * Printing from here goes the same way as from the Bệnh án tab: the sheet
     * is copied into the page's own document and that copy is printed. The
     * preview's frame cannot be: to a printer an iframe is one box, and four
     * modal layers of fixed-height boxes sit between it and the paper.
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

    const copy = page.locator(".mr-print-copy");
    await expect(copy.locator(".nfc-tpl")).toHaveCount(1);
    // The sheet the picker is showing, not some other one.
    await expect(copy).toContainText("BỆNH ÁN NGOẠI TRÚ");

    await page.emulateMedia({ media: "print" });
    const paper = await page.evaluate(() => {
      const holder = document.querySelector<HTMLElement>(".mr-print-copy")!;
      return {
        // Only the copy is on the paper — the dialog and the app are not.
        shown: [...document.body.children]
          .filter((node) => getComputedStyle(node).display !== "none")
          .map((node) => node.className || node.tagName),
        // And it prints at its own size, whatever the preview was zoomed to.
        zoom: getComputedStyle(holder.querySelector(".nfc-tpl")!).zoom,
      };
    });
    await page.emulateMedia({ media: null });

    expect(paper.shown).toEqual(["mr-print-copy"]);
    expect(paper.zoom).toBe("1");

    // Scoped to the footer: the modal's own X is labelled "Đóng" as well.
    await print.locator(".pmr-foot").getByRole("button", { name: "Đóng" }).click();
    await expect(print).toBeHidden();

    // The receipt action opens the invoice for this slip. It bills the slip as
    // one line — "Kế hoạch điều trị DT…", a single unit of "Răng" — not the
    // services inside it, which is how the reference hands the dialog its items.
    await row.getByRole("button", { name: `Phiếu thu ${createdCode}` }).click();
    const invoice = page.getByRole("dialog", { name: "Hóa đơn" });
    await expect(invoice).toBeVisible();
    const invoiceLine = invoice.locator("tbody tr.ant-table-row");
    await expect(invoiceLine).toHaveCount(1);
    await expect(invoiceLine).toContainText(`Kế hoạch điều trị ${createdCode}`);
    await expect(invoiceLine).toContainText("Răng");
    await expect(invoice).not.toContainText(pickedService);
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

    await pickFirstOption(page, dialog.getByRole("combobox", { name: /Nhân sự tư vấn 1/ }));

    await dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
    // The price is the catalog's now — it cannot be typed — so the figures
    // below are read off the service rather than dictated to it. A service
    // worth more than the discount, or there would be nothing left to check.
    const DISCOUNT = 100_000;
    const options = openDropdown(page, ".tp-service-dropdown").locator(
      ".ant-select-item-option:has(.tp-opt-service)",
    );
    await expect(options.first()).toBeVisible();
    let service = options.first();
    let gross = 0;
    for (let index = 0; index < (await options.count()); index++) {
      const price = money(await options.nth(index).locator(".tp-opt-price").innerText());
      if (price > DISCOUNT) {
        service = options.nth(index);
        gross = price;
        break;
      }
    }
    expect(gross).toBeGreaterThan(DISCOUNT);
    const lineName = (await service.locator(".tp-opt-name").innerText()).trim();
    await service.click();

    await dialog.locator(".tp-tooth-btn").click();
    const picker = page.getByRole("dialog", { name: "Chọn răng" });
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Răng 14", exact: true }).click();
    await picker.locator(".tp-teeth-foot button").click();
    await expect(picker).toBeHidden();

    const net = gross - DISCOUNT;
    await dialog.locator(".tp-toggle button", { hasText: "VNĐ" }).click();
    await dialog.locator(".tp-create-discount input:visible").fill(String(DISCOUNT));
    await expect(dialog.locator(".tp-create-summary")).toContainText(vnd(net));

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
    await expect(cells.nth(0)).toHaveText(`${vnd(gross)} đ`); // Tổng phiếu — gross
    await expect(cells.nth(1)).toHaveText(`${vnd(DISCOUNT)} đ`); // Giảm giá
    await expect(cells.nth(2)).toHaveText(`${vnd(net)} đ`); // Thành tiền

    // The line the row rolls up. "Đơn giá" in this list is the reference's
    // net unit price — what the line is worth divided by its quantity — so on a
    // single unit it reads the same as "Thành tiền", discount already taken off.
    await page
      .locator(".tp-table tr.ant-table-row", { hasText: code })
      .getByRole("button", { name: `Danh sách dịch vụ - ${code}` })
      .click();
    const services = page.getByRole("dialog", { name: `Danh sách dịch vụ - ${code}` });
    const line = services.locator("tr.ant-table-row", { hasText: lineName }).first();
    await expect(line.locator(".tp-cell-money").nth(0)).toHaveText(`${vnd(net)} đ`);
    await expect(line.locator(".tp-cell-money").nth(1)).toHaveText(`${vnd(net)} đ`);
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

  /**
   * Leaving the stàge dialog with something written asks first.
   *
   * Measured on the reference 2026-09-22 out of its published stage chunk: one
   * guarded close sits behind both the ✕ and the form's "Hủy", and only the
   * treatment content and the pictures make it dirty — not the doctor pickers.
   */
  test("leaving Công đoạn with something written asks before it throws it away", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${patientUrl}?tab=treatment-plan`);
    await assertRealApiTraffic(page, PLANS_API);

    const row = page.locator(".tp-table tr.ant-table-row", { hasText: createdCode });
    const stage = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    const ask = page.getByRole("dialog", { name: "Hủy thay đổi" });

    const openForm = async () => {
      await row.getByRole("button", { name: `Thêm công đoạn ${createdCode}` }).click();
      await expect(stage).toBeVisible();
      await stage.locator(".pd-stage-picks button").first().click();
      await expect(stage.locator(".pd-stage-form")).toBeVisible();
    };

    // Nothing written: "Hủy" leaves straight away, and it leaves the whole
    // dialog rather than only dropping the picked line.
    await openForm();
    await expect(stage.getByRole("button", { name: /Lưu công đoạn/ })).toBeVisible();
    await stage.getByRole("button", { name: "Hủy", exact: true }).click();
    await expect(ask).toBeHidden();
    await expect(stage).toBeHidden();

    // Something written: the same button asks, and answering "Tiếp tục chỉnh
    // sửa" hands the text back untouched.
    await openForm();
    const note = stage.locator(".pd-stage-form textarea");
    await note.fill("Đã lấy cao răng hàm trên");
    await stage.getByRole("button", { name: "Hủy", exact: true }).click();
    await expect(ask).toBeVisible();
    await expect(ask).toContainText("Bạn có chắc muốn hủy? Dữ liệu vừa nhập sẽ không được lưu.");
    await ask.getByRole("button", { name: "Tiếp tục chỉnh sửa" }).click();
    await expect(ask).toBeHidden();
    await expect(stage).toBeVisible();
    await expect(note).toHaveValue("Đã lấy cao răng hàm trên");

    // The ✕ is guarded by the very same close.
    await stage.locator(".ant-modal-close").click();
    await expect(ask).toBeVisible();
    // The confirm's name carries its icon: "delete Xác nhận hủy".
    await ask.getByRole("button", { name: /Xác nhận hủy/ }).click();
    await expect(ask).toBeHidden();
    await expect(stage).toBeHidden();

    // And nothing was written to the slip — no công đoạn was created.
    await row.getByRole("button", { name: `Thêm công đoạn ${createdCode}` }).click();
    await expect(stage).toBeVisible();
    await expect(stage).toContainText("Chưa có dữ liệu công đoạn");
    await page.keyboard.press("Escape");
    await expect(stage).toBeHidden();
  });

  /**
   * The slip table either fits or scrolls — never a sliver in between.
   *
   * "Thao tác" is pinned, so at rest it floats over whatever is under it and you
   * scroll to reveal that. That is fine while there is a real amount to scroll.
   * It stops being fine when the table overflows by a handful of pixels: the
   * pinned column then sits on "Phải thu" and no amount of dragging can move a
   * scrollbar that short. A global `min-width: 100px` on every header used to
   * cause exactly that — it blew the 48px eye column up to 100 and, because Ant
   * Design 6 renamed `…-fix-right` to `…-fix-end`, the pinned column escaped its
   * own exemption too (R-462).
   */
  test("the slip table either fits or leaves enough to scroll, never a few pixels", async ({
    page,
  }) => {
    await login(page);

    for (const width of [1280, 1728, 1860]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${patientUrl}?tab=treatment-plan`);
      const content = page.locator(".tp-table .ant-table-content");
      await expect(content).toBeVisible();
      await expect(page.locator(".tp-table tbody tr.ant-table-row").first()).toBeVisible();

      const overflow = await content.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow === 0 || overflow > 20).toBe(true);

      // Scrolled to the end, the pinned cell clears the last money column.
      await content.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      const overlap = await content.evaluate((el) => {
        const row = [...el.querySelectorAll("tbody tr.ant-table-row")].at(-1)!;
        const tds = [...row.querySelectorAll("td")];
        const money = tds[tds.length - 2].getBoundingClientRect();
        const pinned = tds[tds.length - 1].getBoundingClientRect();
        return Math.round(money.right - pinned.x);
      });
      expect(overlap).toBeLessThanOrEqual(0);

      // The eye column keeps the narrow width it declares.
      const eye = await page
        .locator(".tp-table thead th")
        .nth(2)
        .evaluate((el) => Math.round(el.getBoundingClientRect().width));
      expect(eye).toBeLessThan(60);
    }
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
