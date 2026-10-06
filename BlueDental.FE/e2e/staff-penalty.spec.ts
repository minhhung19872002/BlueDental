import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Nhân viên → Chế tài (F-49), through the screen.
 * BlueDental-local; see docs/clone/pages/staff-penalty.md.
 *
 * Real stack: login screen, real API, real PostgreSQL. Each step is read back
 * after a reload, so what the table shows is what the server kept.
 */

async function pick(page: Page, field: Locator, option: string | RegExp) {
  await field.click();
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: option }).first().click();
}

function rowWith(page: Page, text: string) {
  return page.locator("tbody tr.ant-table-row").filter({ hasText: text });
}

test.describe("Chế tài nhân viên", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
  });

  test("a type pre-fills the fine; a draft is approved, locked, then cancelled with a reason", async ({ page }) => {
    const id = runId();
    const typeName = `Đi trễ ${id}`;
    const description = `Đến trễ ${id}`;

    // ── The tab lives beside the staff list, as its own route ───────────
    await page.goto("/staff");
    await page.getByRole("link", { name: "Chế tài" }).click();
    await expect(page).toHaveURL(/\/staff\/penalties/);
    await assertRealApiTraffic(page, "/api/v1/app/staff-penalties");

    // ── Loại vi phạm with a default fine ───────────────────────────────
    await page.getByRole("button", { name: /Loại vi phạm/ }).click();
    const types = page.getByRole("dialog", { name: "Loại vi phạm" });
    await types.getByRole("textbox", { name: /Tên loại vi phạm/ }).fill(typeName);
    await types.getByRole("textbox", { name: /Mức phạt mặc định/ }).fill("75000");
    await types.getByRole("button", { name: /Thêm loại/ }).click();
    await expect(types.getByRole("row", { name: new RegExp(typeName) })).toContainText("75.000 đ");
    await types.getByRole("button", { name: "Đóng" }).first().click();
    await expect(types).toBeHidden();

    // ── Lập phiếu: empty save is refused on the form ───────────────────
    await page.getByRole("button", { name: /Lập phiếu chế tài/ }).click();
    const dialog = page.getByRole("dialog", { name: "Lập phiếu chế tài" });
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    await expect(dialog.getByText("Vui lòng chọn nhân viên")).toBeVisible();
    await expect(dialog.getByText("Vui lòng chọn hình thức xử lý")).toBeVisible();

    await pick(page, dialog.getByRole("combobox", { name: /Nhân viên/ }), /./);
    await pick(page, dialog.getByRole("combobox", { name: /Loại vi phạm/ }), typeName);
    // Picking the type switched the action to Phạt tiền and filled its fine.
    await expect(dialog.getByText("Phạt tiền")).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: /Số tiền phạt/ })).toHaveValue("75.000");
    await dialog.getByRole("textbox", { name: /Nội dung vi phạm/ }).fill(description);
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    await expect(page.getByText("Đã lập phiếu chế tài")).toBeVisible();
    await expect(dialog).toBeHidden();

    const row = rowWith(page, description);
    await expect(row).toContainText("Nháp");
    await expect(row).toContainText("75.000 đ");
    await expect(row).toContainText(typeName);

    // ── Duyệt: the row keeps only Huỷ phiếu ────────────────────────────
    await row.getByRole("button", { name: "Duyệt", exact: true }).click();
    await page.getByRole("dialog", { name: "Duyệt" }).getByRole("button", { name: /Có/ }).click();
    await expect(page.getByText("Đã duyệt phiếu chế tài")).toBeVisible();

    await page.reload();
    await assertRealApiTraffic(page, "/api/v1/app/staff-penalties");
    await expect(row).toContainText("Đã duyệt");
    await expect(row.getByRole("button", { name: "Chỉnh sửa" })).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Xoá" })).toHaveCount(0);

    // ── Huỷ: refused without a reason, kept with one ───────────────────
    await row.getByRole("button", { name: "Huỷ phiếu", exact: true }).click();
    const cancel = page.getByRole("dialog", { name: /Huỷ phiếu chế tài/ });
    await cancel.getByRole("button", { name: /Huỷ phiếu/ }).click();
    await expect(cancel.getByText("Vui lòng nhập lý do huỷ")).toBeVisible();
    await cancel.getByRole("textbox", { name: /Lý do huỷ/ }).fill("Nhầm ngày");
    await cancel.getByRole("button", { name: /Huỷ phiếu/ }).click();
    await expect(page.getByText("Đã huỷ phiếu chế tài")).toBeVisible();

    await page.reload();
    await assertRealApiTraffic(page, "/api/v1/app/staff-penalties");
    await expect(row).toContainText("Đã huỷ");
    // A cancelled record is final: Xem chi tiết is the only button left, and
    // it names who approved it and why it was cancelled.
    await expect(row.getByRole("button")).toHaveCount(1);
    await row.getByRole("button", { name: "Xem chi tiết" }).click();
    const detail = page.getByRole("dialog", { name: "Chi tiết phiếu chế tài" });
    await expect(detail).toContainText(description);
    await expect(detail).toContainText("Người duyệt");
    await expect(detail).toContainText("Nhầm ngày");
    await detail.getByRole("button", { name: "Đóng" }).last().click();
    await expect(detail).toBeHidden();

    // ── The Đã huỷ pill narrows the list on the server ─────────────────
    await page.getByRole("button", { name: "Nháp", exact: true }).click();
    await expect(row).toHaveCount(0);
    await page.getByRole("button", { name: "Đã huỷ", exact: true }).click();
    await expect(row).toHaveCount(1);
  });
});
