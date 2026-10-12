import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: xuất / nhập danh sách bệnh nhân (F-69) through the screen — the
 * admin buttons on /patient, the import dialog's check → preview → import,
 * then a reload that finds the new patient. Real backend, real database; the
 * rows are synthetic and the spec deletes its patient through the same import.
 */

const BRANCH_NAME = "Nha Khoa Đức Hạnh Premium";
const HEADER = ["Họ và tên *", "Số điện thoại *", "Mã khách hàng", "Chi nhánh *", "Action"];

function rosterFile(rows: (string | null)[][]): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ...rows]), "Bệnh nhân");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}

async function openImport(page: Page) {
  await page.getByRole("button", { name: "Nhập danh sách" }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Nhập danh sách bệnh nhân" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function upload(page: Page, name: string, body: Buffer) {
  const dialog = await openImport(page);
  await dialog.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: body,
  });
  await dialog.getByRole("button", { name: /Kiểm tra/ }).click();
  return dialog;
}

test.describe.configure({ mode: "serial" });

test.describe("F-69 patient roster — browser", () => {
  const run = runId();
  const name = `E2E Roster UI ${run}`;
  const phone = `08${run.padStart(8, "0")}`;
  let code = "";

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
  });

  test("Xuất danh sách downloads the roster file", async ({ page }) => {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Xuất danh sách" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test("a wrong row blocks the import and offers the error file", async ({ page }) => {
    const dialog = await upload(page, "loi.xlsx", rosterFile([[name, phone, null, BRANCH_NAME, "X"]]));

    await expect(dialog.getByText(/1 lỗi/)).toBeVisible();
    await expect(dialog.locator(".bd-roster-row--error")).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: /^upload Nhập/ })).toBeDisabled();

    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: /Tải file lỗi/ }).click();
    expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test("E adds the patient: check, preview, import, then it is on the list after a reload", async ({ page }) => {
    const dialog = await upload(page, "them.xlsx", rosterFile([[name, phone, null, BRANCH_NAME, "E"]]));

    const row = dialog.locator(".bd-roster-table .ant-table-row").filter({ hasText: name });
    await expect(row).toContainText("Thêm mới");
    code = (await row.locator("td").nth(1).innerText()).trim();
    expect(code).toMatch(/^DH\d{6}$/);

    await dialog.getByRole("button", { name: "upload Nhập 1 dòng" }).click();
    await expect(dialog.getByText("Nhập thành công")).toBeVisible();
    await dialog.locator(".bd-modal-foot").getByRole("button", { name: "Đóng" }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await page.getByRole("searchbox").fill(name);
    await expect(page.getByRole("row").filter({ hasText: name })).toContainText(code);
  });

  test("D deletes it again", async ({ page }) => {
    test.skip(!code, "the add step did not run");
    const dialog = await upload(page, "xoa.xlsx", rosterFile([[name, phone, code, BRANCH_NAME, "D"]]));
    await expect(dialog.locator(".bd-roster-table .ant-table-row").filter({ hasText: code })).toContainText("Xoá");
    await dialog.getByRole("button", { name: "upload Nhập 1 dòng" }).click();
    await expect(dialog.getByText("Nhập thành công")).toBeVisible();
    await dialog.locator(".bd-modal-foot").getByRole("button", { name: "Đóng" }).click();

    await page.reload();
    await page.getByRole("searchbox").fill(name);
    await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
  });
});
