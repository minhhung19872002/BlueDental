import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: "Tải ảnh QR" on Danh mục / Phương thức thanh toán.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL, and real
 * object storage — the preview in the dialog is fetched back from the API, so a
 * QR that never reached MinIO would fail these assertions.
 */

/** A 16×16 checkerboard PNG, inlined so the suite carries no binary fixture. */
const QR_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAAAAAA6mKC9AAAAGUlEQVR42mNgAIL/QIBMkypAqX4YGATuAADA/X+BdAueyAAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Phương thức thanh toán — ảnh QR", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/taxonomy/payment-method");
    await assertRealApiTraffic(page, "/api/v1/app/payment-accounts");
  });

  test("attaches a QR to a new MoMo account and keeps it after a reload", async ({ page }) => {
    const id = runId();
    const holder = `QR MOMO ${id}`;

    await page.getByRole("button", { name: "Thêm phương thức" }).click();
    let dialog = page.getByRole("dialog");

    await dialog.getByLabel(/Số điện thoại/).fill(`09${id.slice(0, 8)}`);
    await dialog.getByLabel(/Tên chủ tài khoản/).fill(holder);
    await dialog
      .getByTestId("payment-qr-input")
      .setInputFiles({ name: "qr-momo.png", mimeType: "image/png", buffer: QR_PNG });

    // The picked file previews before it is uploaded.
    await expect(dialog.getByTestId("payment-qr-preview")).toBeVisible();
    await dialog.getByRole("button", { name: "Lưu" }).click();

    // The dialog closes only once the account and its QR have both been saved,
    // so this is what says the upload finished.
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(holder) });
    await expect(row).toBeVisible();

    // Reopen after a reload: the preview now comes from the API, not from the
    // file the browser still had in memory.
    await page.reload();
    await page
      .getByRole("row", { name: new RegExp(holder) })
      .getByRole("button")
      .first()
      .click();

    dialog = page.getByRole("dialog");
    const preview = dialog.getByTestId("payment-qr-preview");
    await expect(preview).toBeVisible();

    const source = await preview.getAttribute("src");
    expect(source).toContain("/api/v1/app/payment-accounts/");
    expect(source).toContain("/qr-image");

    const served = await page.request.get(source!);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toContain("image/png");
  });

  test("removes a saved QR", async ({ page }) => {
    const id = runId();
    const holder = `QR XOA ${id}`;

    await page.getByRole("button", { name: "Thêm phương thức" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Số điện thoại/).fill(`09${id.slice(0, 8)}`);
    await dialog.getByLabel(/Tên chủ tài khoản/).fill(holder);
    await dialog
      .getByTestId("payment-qr-input")
      .setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: QR_PNG });
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(holder) });
    await expect(row).toBeVisible();

    await row.getByRole("button").first().click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("payment-qr-preview")).toBeVisible();
    await dialog.getByRole("button", { name: "Xoá ảnh" }).click();
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();

    // Gone for good: reopening the saved account offers the upload box again.
    await page.reload();
    await page
      .getByRole("row", { name: new RegExp(holder) })
      .getByRole("button")
      .first()
      .click();

    dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("payment-qr-preview")).toHaveCount(0);
    await expect(dialog.getByTestId("payment-qr-upload")).toBeVisible();
  });

  test("refuses a file that is not an image", async ({ page }) => {
    await page.getByRole("button", { name: "Thêm phương thức" }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByTestId("payment-qr-input").setInputFiles({
      name: "khong-phai-anh.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("khong phai anh"),
    });

    await expect(dialog.getByRole("alert")).toContainText(/PNG, JPG hoặc WEBP/);
    await expect(dialog.getByTestId("payment-qr-preview")).toHaveCount(0);
  });
});
