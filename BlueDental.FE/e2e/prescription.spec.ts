import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";

/**
 * Feature: Đơn thuốc — the patient's prescription tab.
 *
 * The tab lists the patient's slips on this branch with Sửa and Xóa on each
 * row; "Tạo đơn thuốc" opens the dialog (which rides in the URL as
 * `create=true`), and ticking "Lưu đơn thuốc mẫu" files the lines back into
 * the Đơn thuốc mẫu catalog under the name typed for it.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL. The
 * tests run in order and hand the slip they made down the line, so the
 * branch-isolation check has something to be refused, and the last one
 * cleans up.
 */

const PRESCRIPTIONS_API = "/api/v1/app/prescriptions";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

async function createGroup(page: Page, name: string) {
  await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Tên phân loại/).fill(name);
  await dialog.getByRole("button", { name: /Lưu$/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

/** The line picker reads the branch's thuốc catalog, so seed one the test knows by name. */
async function createMedicine(page: Page, id: string, name: string) {
  await page.goto("/taxonomy/medicine");
  await createGroup(page, `NHOM RX ${id}`);
  await page.getByRole("button", { name: /Thêm loại thuốc$/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Tên thuốc/).fill(name);
  await dialog.getByRole("button", { name: /Lưu$/ }).click();
  await expect(dialog).toBeHidden();
}

/** Opens the first patient of the list and returns its record URL. */
async function openFirstPatient(page: Page): Promise<string> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
  await expect(firstName).toBeVisible();
  await firstName.click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  return page.url().split("?")[0];
}

async function openPrescriptionTab(page: Page) {
  const listed = page.waitForResponse(
    (res) => res.url().includes(PRESCRIPTIONS_API) && res.request().method() === "GET",
  );
  await page.getByRole("link", { name: "Đơn thuốc" }).click();
  await expect(page).toHaveURL(/tab=prescription/);
  expect((await listed).ok()).toBeTruthy();
}

function saved(page: Page, method: "POST" | "PUT" | "DELETE") {
  return page.waitForResponse(
    (res) => res.url().includes(PRESCRIPTIONS_API) && res.request().method() === method,
  );
}

/** A field of the medicine line the desktop table is showing. */
function lineField(dialog: Locator, label: string): Locator {
  return dialog.getByLabel(label, { exact: true });
}

async function pickOption(page: Page, text: string | RegExp) {
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: text })
    .first()
    .click();
}

test.describe.serial("Đơn thuốc", () => {
  const id = runId();
  const medicine = `THUOC RX ${id}`;
  const template = `DON BN ${id}`;
  const diagnosis = `Chẩn đoán e2e ${id}`;
  const revised = `Chẩn đoán sửa ${id}`;
  let patientUrl = "";

  test("the tab lists the columns of the reference and opens the dialog from the URL", async ({
    page,
  }) => {
    await login(page);
    patientUrl = await openFirstPatient(page);
    await openPrescriptionTab(page);

    await expect(page.getByRole("button", { name: "Tạo đơn thuốc" })).toBeVisible();
    for (const header of ["Mã đơn thuốc", "Bác sĩ", "Chẩn đoán", "Tái khám", "Ngày tạo", "Thao tác"]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    }
    await expect(page.locator(".ant-pagination-total-text")).toHaveText(/Hiển thị \d+ trên \d+/);

    // The dialog is URL-driven, as on the reference: the button writes the flag…
    await page.getByRole("button", { name: "Tạo đơn thuốc" }).click();
    await expect(page).toHaveURL(/create=true/);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Thêm đơn thuốc")).toBeVisible();

    // …and nothing can be saved before a doctor and a medicine are picked.
    await expect(dialog.getByRole("button", { name: /Lưu$/ })).toBeDisabled();
    await dialog.getByRole("button", { name: /Hủy$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/create=true/);

    // Reaching the URL directly opens it, and the other tabs' links do not
    // carry the flag along — the dialog belongs to this tab only.
    await page.goto(`${patientUrl}?tab=prescription&create=true`);
    await expect(page.getByRole("dialog").getByText("Thêm đơn thuốc")).toBeVisible();
    await expect(page.getByRole("link", { name: "Lịch hẹn" })).toHaveAttribute(
      "href",
      /tab=appointment/,
    );
    await expect(page.getByRole("link", { name: "Lịch hẹn" })).not.toHaveAttribute(
      "href",
      /create=true/,
    );
  });

  test("a slip is created with its lines, and filed as a template when asked", async ({ page }) => {
    await login(page);
    await createMedicine(page, id, medicine);

    await page.goto(`${patientUrl}?tab=prescription`);
    await assertRealApiTraffic(page, PRESCRIPTIONS_API);
    await page.getByRole("button", { name: "Tạo đơn thuốc" }).click();
    const dialog = page.getByRole("dialog");
    const save = dialog.getByRole("button", { name: /Lưu$/ });

    await dialog.getByLabel("Chọn bác sĩ").click();
    await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
    await expect(save).toBeDisabled();

    await dialog.getByLabel("Nhập chẩn đoán").fill(diagnosis);
    await dialog.getByLabel("Nhập lời dặn").fill(`Lời dặn e2e ${id}`);

    await lineField(dialog, "Tên thuốc").fill(medicine);
    await pickOption(page, medicine);
    await lineField(dialog, "Ngày uống").fill("2");
    await lineField(dialog, "Mỗi lần").fill("1");
    await lineField(dialog, "Số ngày").fill("3");

    // "Số lượng" is derived and shown disabled, as on the reference.
    const quantity = lineField(dialog, "Số lượng");
    await expect(quantity).toBeDisabled();
    await expect(quantity).toHaveValue("6");
    await expect(save).toBeEnabled();

    // Ticking "Lưu đơn thuốc mẫu" asks for the template's name before saving.
    await dialog.getByLabel("Lưu đơn thuốc mẫu").check();
    const templateName = dialog.getByLabel(/Tên đơn thuốc mẫu/);
    await expect(templateName).toBeVisible();
    await expect(save).toBeDisabled();
    await templateName.fill(template);
    await expect(save).toBeEnabled();

    const created = saved(page, "POST");
    await save.click();
    expect((await created).ok()).toBeTruthy();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/create=true/);

    const row = page.getByRole("row", { name: new RegExp(diagnosis) });
    await expect(row).toBeVisible();
    await expect(row).toContainText(/DT\d{2}-\d{4}/);

    await page.reload();
    await assertRealApiTraffic(page, PRESCRIPTIONS_API);
    await expect(page.getByRole("row", { name: new RegExp(diagnosis) })).toBeVisible();

    // The template the tick made is offered on the next slip, lines and advice included.
    await page.getByRole("button", { name: "Tạo đơn thuốc" }).click();
    const next = page.getByRole("dialog");
    await next.getByLabel("Chọn đơn thuốc mẫu").fill(template);
    await pickOption(page, template);
    await expect(lineField(next, "Số lượng")).toHaveValue("6");
    await expect(next.getByLabel("Nhập lời dặn")).toHaveValue(`Lời dặn e2e ${id}`);
    await next.getByRole("button", { name: /Hủy$/ }).click();
    await expect(next).toBeHidden();
  });

  test("Sửa reopens the slip filled in and persists the change", async ({ page }) => {
    await login(page);
    await page.goto(`${patientUrl}?tab=prescription`);
    await assertRealApiTraffic(page, PRESCRIPTIONS_API);

    await page
      .getByRole("row", { name: new RegExp(diagnosis) })
      .getByRole("button", { name: "Sửa" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Cập nhật đơn thuốc")).toBeVisible();
    await expect(dialog.getByLabel("Nhập chẩn đoán")).toHaveValue(diagnosis);
    await expect(lineField(dialog, "Số lượng")).toHaveValue("6");
    await expect(lineField(dialog, "Tên thuốc")).toBeVisible();

    await dialog.getByLabel("Nhập chẩn đoán").fill(revised);
    const updated = saved(page, "PUT");
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    expect((await updated).ok()).toBeTruthy();
    await expect(dialog).toBeHidden();

    await page.reload();
    await assertRealApiTraffic(page, PRESCRIPTIONS_API);
    await expect(page.getByRole("row", { name: new RegExp(revised) })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(diagnosis) })).toHaveCount(0);
  });

  test("an account limited to another branch is refused the slip", async ({ browser }) => {
    const page = await freshPage(browser);
    await login(page, BRANCH2_USER);

    const patientId = patientUrl.split("/").pop() ?? "";
    const refused = await page.evaluate(async (url) => {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, items: (json.items ?? []) as unknown[] };
    }, `${PRESCRIPTIONS_API}?patientId=${patientId}&clinicBranchId=${BRANCH_ONE}`);
    expect(refused.status).toBe(403);
    expect(refused.items).toHaveLength(0);

    await page.goto(`${patientUrl}?tab=prescription`);
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
    await expect(page.getByRole("row", { name: new RegExp(revised) })).toHaveCount(0);
    await page.close();
  });

  test("Xóa asks first, then removes the slip for good", async ({ page }) => {
    await login(page);
    await page.goto(`${patientUrl}?tab=prescription`);
    await assertRealApiTraffic(page, PRESCRIPTIONS_API);

    const row = page.getByRole("row", { name: new RegExp(revised) });
    await row.getByRole("button", { name: "Xóa" }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toContainText(/DT\d{2}-\d{4}/);

    const deleted = saved(page, "DELETE");
    await confirm.getByRole("button", { name: /Xoá$/ }).click();
    expect((await deleted).ok()).toBeTruthy();
    await expect(confirm).toBeHidden();
    await expect(row).toHaveCount(0);

    await page.reload();
    await assertRealApiTraffic(page, PRESCRIPTIONS_API);
    await expect(page.getByRole("row", { name: new RegExp(revised) })).toHaveCount(0);
  });
});

async function freshPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}
