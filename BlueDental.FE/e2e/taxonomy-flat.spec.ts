import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: the three "Danh mục" sub-routes the reference draws as one flat
 * table instead of a group panel plus a table.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL.
 */
test.describe("Danh mục — màn hình phẳng", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Đơn thuốc mẫu has no group panel and no group column", async ({ page }) => {
    await page.goto("/taxonomy/prescription-template");
    await assertRealApiTraffic(page, "group=prescription_template");

    await expect(page.getByRole("heading", { name: "Đơn thuốc mẫu" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Tên đơn thuốc mẫu" })).toBeVisible();

    // The group panel and its column are exactly what this sub-route drops.
    await expect(page.getByRole("columnheader", { name: "Nhóm phân loại" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: /^Nhóm / })).toHaveCount(0);

    // Its sibling keeps them, so this is per-catalog and not a global change.
    await page.goto("/taxonomy/medical-record-template");
    await expect(page.getByRole("columnheader", { name: "Nhóm phân loại" })).toBeVisible();
  });

  test("creates a coloured Thẻ hồ sơ that survives a reload", async ({ page }) => {
    const name = `Thẻ E2E ${runId()}`;

    await page.goto("/taxonomy/tags");
    await assertRealApiTraffic(page, "/api/v1/app/patient-tags");

    await expect(page.getByRole("heading", { name: "Quản lý Thẻ hồ sơ" })).toBeVisible();

    await page.getByRole("button", { name: "Thêm tag" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên thẻ hồ sơ/).fill(name);
    await dialog.getByRole("button", { name: "Chọn màu #10B981" }).click();
    await dialog.getByRole("button", { name: "Lưu" }).click();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("#10B981");

    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("#10B981");
  });

  test("keeps MoMo and bank payment accounts on their own tabs", async ({ page }) => {
    const id = runId();
    const bankHolder = `CHU TK ${id}`;
    const momoHolder = `MOMO ${id}`;

    await page.goto("/taxonomy/payment-method");
    await assertRealApiTraffic(page, "/api/v1/app/payment-accounts");

    // ── MoMo ───────────────────────────────────────────────────────────────
    await expect(page.getByRole("columnheader", { name: "Số điện thoại" })).toBeVisible();
    await page.getByRole("button", { name: "Thêm phương thức" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Số điện thoại/).fill(`09${id.slice(0, 8)}`);
    await dialog.getByLabel(/Tên chủ tài khoản/).fill(momoHolder);
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByRole("row", { name: new RegExp(momoHolder) })).toBeVisible();

    // ── Ngân hàng ──────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Ngân hàng", exact: true }).click();
    await expect(page.getByRole("columnheader", { name: "Số tài khoản" })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(momoHolder) })).toHaveCount(0);

    await page.getByRole("button", { name: "Thêm phương thức" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên ngân hàng/).fill("Vietcombank");
    await dialog.getByLabel(/Tên chủ tài khoản/).fill(bankHolder);
    await dialog.getByLabel(/Số tài khoản/).fill(`00710${id}`);
    await dialog.getByRole("button", { name: "Lưu" }).click();

    const bankRow = page.getByRole("row", { name: new RegExp(bankHolder) });
    await expect(bankRow).toBeVisible();
    await expect(bankRow).toContainText("Vietcombank");

    // The MoMo account stays on its own tab after a reload.
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(momoHolder) })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(bankHolder) })).toHaveCount(0);
  });

  test("refuses a payment account with no holder", async ({ page }) => {
    await page.goto("/taxonomy/payment-method");

    await page.getByRole("button", { name: "Thêm phương thức" }).click();
    const dialog = page.getByRole("dialog");
    const save = dialog.getByRole("button", { name: "Lưu", exact: true });

    // The reference keeps its single "Lưu" disabled until the form is complete,
    // so an incomplete account cannot be submitted at all.
    await dialog.getByLabel(/Số điện thoại/).fill("0900000000");
    await expect(save).toBeDisabled();

    await dialog.getByLabel(/Tên chủ tài khoản/).fill("NGUOI NHAN");
    await expect(save).toBeEnabled();
  });
});
