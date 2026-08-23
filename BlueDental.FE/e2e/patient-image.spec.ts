import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Feature: Hình ảnh bệnh nhân.
 *
 * The bytes go to MinIO and only the reference is stored, so this exercises the
 * whole path: real multipart upload, real object storage, real fetch back.
 */
test.describe("Hình ảnh bệnh nhân", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  /** A 1×1 PNG, small enough to inline. */
  const PNG_BYTES = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  async function openImageTab(page: Page): Promise<string> {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await page.locator("tr.ant-table-row").first().click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
    const url = page.url();

    await page.getByRole("tab", { name: "Hình ảnh" }).click();
    await assertRealApiTraffic(page, "/api/v1/app/patient-images");

    return url;
  }

  test("an uploaded image is stored, listed and served back", async ({ page }) => {
    const profileUrl = await openImageTab(page);

    const before = await page.getByTestId("patient-image-grid").locator("img").count();

    await page.getByTestId("patient-image-input").setInputFiles({
      name: "xray-e2e.png",
      mimeType: "image/png",
      buffer: PNG_BYTES,
    });

    const grid = page.getByTestId("patient-image-grid");
    await expect.poll(() => grid.locator("img").count()).toBe(before + 1);
    await expect(grid.getByText("xray-e2e.png").first()).toBeVisible();

    // The bytes come back from object storage through the API, not from a data URL.
    const src = await grid.locator("img").first().getAttribute("src");
    expect(src).toContain("/api/v1/app/patient-images/");

    const stored = await page.request.get(new URL(src!, page.url()).toString());
    expect(stored.ok()).toBeTruthy();
    expect((await stored.body()).length).toBeGreaterThan(0);

    // It survives a reload, so the record really reached PostgreSQL.
    await page.goto(`${profileUrl}?tab=image`);
    await expect(
      page.getByTestId("patient-image-grid").getByText("xray-e2e.png").first(),
    ).toBeVisible();
  });

  test("a file that is not an image is refused", async ({ page }) => {
    await openImageTab(page);

    await page.getByTestId("patient-image-input").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("khong phai anh"),
    });

    await expect(page.getByText("Định dạng ảnh không được hỗ trợ.").first()).toBeVisible();
  });
});
