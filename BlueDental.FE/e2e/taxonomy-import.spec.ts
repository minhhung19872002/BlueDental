import { expect, test, type Locator, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Danh mục — nhập từ Excel, through the real screen. The importer
 * itself is covered request by request in taxonomy-import-api.spec.ts; this
 * file checks the dialog the user sees: file → check → import, the preview
 * that names the bad rows, the error file, and what is (and is not) saved.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL.
 */

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const SOURCE_HEADER = ["Nhóm phân loại *", "Tên nguồn đến *", "Mức độ ưu tiên"];

function sourceFile(name: string, rows: (string | number | null)[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([SOURCE_HEADER, ...rows]), "Nguồn đến");
  const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  return { name, mimeType: XLSX_MIME, buffer };
}

async function openImport(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: /^upload Nhập$/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Nhập nguồn đến từ Excel" })).toBeVisible();
  return dialog;
}

async function checkFile(page: Page, dialog: Locator, file: ReturnType<typeof sourceFile>) {
  await dialog.locator('input[type="file"]').setInputFiles(file);
  await expect(dialog.getByText(file.name)).toBeVisible();
  await dialog.getByRole("button", { name: /Kiểm tra file$/ }).click();
  await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 20_000 });
}

test.describe("Danh mục — nhập từ Excel (màn hình)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/taxonomy/source");
    await assertRealApiTraffic(page, "/api/v1/app/catalog-entries");
  });

  test("a good file is previewed, imported, and comes back after a reload", async ({ page }) => {
    const id = runId();
    const groupName = `NHOM NHAP ${id}`;
    const nameA = `Nguon A ${id}`;
    const nameB = `Nguon B ${id}`;

    const dialog = await openImport(page);
    await checkFile(page, dialog, sourceFile("nguon-den.xlsx", [[groupName, nameA, null], [groupName, nameB, 5]]));

    // The preview is exact: two new rows into a group that does not exist yet.
    await expect(dialog.getByRole("alert")).toContainText("2 dòng: 2 thêm mới, 0 cập nhật, 0 khôi phục, 0 bỏ qua, 0 lỗi");
    await expect(dialog.getByText(`Nhóm sẽ được tạo mới: ${groupName}`)).toBeVisible();
    await expect(dialog.locator(".ant-tag", { hasText: "Thêm mới" })).toHaveCount(2);
    await expect(dialog.getByRole("button", { name: /Tải file lỗi$/ })).toBeHidden();

    await dialog.getByRole("button", { name: /Nhập 2 dòng$/ }).click();
    await expect(dialog.getByText("Nhập thành công")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`Đã nhập 2 dòng vào Nguồn đến`)).toBeVisible();
    await dialog.locator(".bd-modal-foot").getByRole("button", { name: "Đóng" }).click();
    await expect(dialog).toBeHidden();

    // The new group is in the panel and its rows are in the table — after a reload too.
    await page.reload();
    await page.locator(".bd-group-panel").getByRole("button", { name: groupName }).click();
    await expect(page.getByRole("heading", { name: groupName })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(nameA) })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(nameB) })).toBeVisible();

    // The same file again changes nothing: every row is skipped, so there is nothing to import.
    const again = await openImport(page);
    await checkFile(page, again, sourceFile("nguon-den-lai.xlsx", [[groupName, nameA, null], [groupName, nameB, 5]]));
    await expect(again.getByRole("alert")).toContainText("2 dòng: 0 thêm mới, 0 cập nhật, 0 khôi phục, 2 bỏ qua, 0 lỗi");
    await expect(again.locator(".ant-tag", { hasText: "Bỏ qua (không thay đổi)" })).toHaveCount(2);
    await expect(again.getByRole("button", { name: /Nhập 0 dòng$/ })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(again).toBeHidden();

    // One row now differs in another column: that row is updated, the other skipped.
    const changed = await openImport(page);
    await checkFile(page, changed, sourceFile("nguon-den-doi.xlsx", [[groupName, nameA, 42], [groupName, nameB, 5]]));
    await expect(changed.getByRole("alert")).toContainText("2 dòng: 0 thêm mới, 1 cập nhật, 0 khôi phục, 1 bỏ qua, 0 lỗi");
    await expect(changed.locator(".ant-tag", { hasText: "Cập nhật" })).toHaveCount(1);
    await expect(changed.locator(".ant-tag", { hasText: "Bỏ qua (không thay đổi)" })).toHaveCount(1);
    await changed.getByRole("button", { name: /Nhập 1 dòng$/ }).click();
    await expect(changed.getByText("Nhập thành công")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`Đã nhập 1 dòng vào Nguồn đến`)).toBeVisible();
    await changed.locator(".bd-modal-foot").getByRole("button", { name: "Đóng" }).click();
    await expect(changed).toBeHidden();

    // Still two rows: the update went into the existing one.
    await page.reload();
    await page.locator(".bd-group-panel").getByRole("button", { name: groupName }).click();
    await expect(page.getByRole("row", { name: new RegExp(nameA) })).toHaveCount(1);
    await expect(page.getByRole("row", { name: new RegExp(nameB) })).toHaveCount(1);
  });

  test("a file with a bad row is refused, the row is named, the error file downloads, nothing is saved", async ({
    page,
  }) => {
    const id = runId();
    const groupName = `NHOM LOI ${id}`;
    const dup = `Nguon trung ${id}`;

    const dialog = await openImport(page);
    await checkFile(
      page,
      dialog,
      sourceFile("loi.xlsx", [[groupName, dup, null], [groupName, dup, null], [groupName, null, "abc"]]),
    );

    await expect(dialog.getByRole("alert")).toContainText("3 dòng: 1 thêm mới, 0 cập nhật, 0 khôi phục, 0 bỏ qua, 2 lỗi");
    await expect(dialog.getByRole("alert")).toContainText("chưa có dữ liệu nào được lưu");
    await expect(dialog.getByText("Trùng tên với dòng 2")).toBeVisible();
    await expect(dialog.getByText('Thiếu "Tên nguồn đến"')).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Nhập 1 dòng$/ })).toBeDisabled();

    // "Only errors" narrows the table to the two bad rows.
    await expect(dialog.locator(".bd-import-table .ant-table-row")).toHaveCount(3);
    await dialog.getByRole("checkbox", { name: "Chỉ hiện dòng lỗi" }).check();
    await expect(dialog.locator(".bd-import-table .ant-table-row")).toHaveCount(2);

    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: /Tải file lỗi$/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);

    // Back to the file step; the group was never created.
    await dialog.getByRole("button", { name: "Chọn file khác" }).click();
    await expect(dialog.getByRole("button", { name: /Kiểm tra file$/ })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.locator(".bd-group-panel").getByRole("button", { name: groupName })).toHaveCount(0);
  });

  test("a wide sheet scrolls sideways by grabbing the table, like every other table", async ({ page }) => {
    // Dịch vụ has 20 columns, far wider than the dialog. The preview used to
    // be a virtual table, which the app-wide grab-to-scroll cannot drive, so
    // the right-hand columns looked cut off with no way to reach them (R-562).
    await page.goto("/taxonomy/service");
    await page.getByRole("button", { name: /^upload Nhập$/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Nhập dịch vụ từ Excel" })).toBeVisible();
    const id = runId();
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([["Nhóm phân loại", "Tên dịch vụ"], [`NHOM DV ${id}`, `Dich vu ${id}`]]),
      "Dịch vụ",
    );
    const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    await checkFile(page, dialog, { name: "dich-vu.xlsx", mimeType: XLSX_MIME, buffer });
    await expect(dialog.getByRole("alert")).toContainText("1 dòng: 1 thêm mới");

    // The body is a real scroll container the grab handler recognises.
    const body = dialog.locator(".bd-import-table .ant-table-body");
    await expect(body).toHaveClass(/has-horizontal-scroll/);
    const errorsHeader = dialog.locator(".ant-table-thead th", { hasText: "Lỗi" });
    const before = (await errorsHeader.boundingBox())!.x;
    const resultX = Math.round(
      (await dialog.locator(".ant-table-thead th", { hasText: "Kết quả" }).boundingBox())!.x,
    );

    // Grab a plain value cell (not a tag or button) and pull it to the left.
    const cell = dialog.locator(".bd-import-table .ant-table-row .ant-table-cell").nth(2);
    const box = (await cell.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 400, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();

    // Header and body moved together: the errors column came into view.
    await expect.poll(async () => (await errorsHeader.boundingBox())!.x).toBeLessThan(before - 200);
    expect(await body.evaluate((el) => el.scrollLeft)).toBeGreaterThan(200);

    // "Kết quả" is pinned: it was on screen before the drag and did not move.
    const resultHeader = dialog.locator(".ant-table-thead th", { hasText: "Kết quả" });
    await expect(resultHeader).toHaveClass(/ant-table-cell-fix-(end|right)/);
    expect(Math.round((await resultHeader.boundingBox())!.x)).toBe(resultX);
    await expect(dialog.locator(".ant-tag", { hasText: "Thêm mới" })).toBeInViewport();
    await page.keyboard.press("Escape");
  });

  test("the template downloads, and the catalogs without import show no button", async ({ page }) => {
    const dialog = await openImport(page);
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: /Tải file mẫu$/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    await page.keyboard.press("Escape");

    for (const route of ["/taxonomy/medical-record-template", "/taxonomy/tags", "/taxonomy/payment-method"]) {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("button", { name: /^upload Nhập$/ })).toHaveCount(0);
    }
  });
});
