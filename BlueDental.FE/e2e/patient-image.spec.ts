import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login } from "./fixtures/auth";

/**
 * Feature: Hình ảnh bệnh nhân.
 *
 * The tab is reached the way the screen offers it — every patient tab is its
 * own route, so the switcher is a set of links, not an ARIA tablist.
 */
test.describe("Hình ảnh bệnh nhân", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  async function openImageTab(page: Page): Promise<void> {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await page.locator("tr.ant-table-row .bd-patient-name").first().click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

    await page.getByRole("link", { name: "Hình ảnh" }).click();
    await expect(page).toHaveURL(/tab=image/);
  }

  test("the image tab shows the upload button, and the gallery reflects the record", async ({
    page,
  }) => {
    await openImageTab(page);

    await expect(page.getByRole("button", { name: "Tải ảnh" })).toBeVisible();

    // This used to assert the empty state outright, which only held while the
    // demo clinic had no photographs at all. Every seeded patient carries some
    // now, and the tab opens on whichever record is first — so assert on what
    // the gallery is actually showing rather than on one of the two outcomes.
    const grid = page.getByTestId("patient-image-grid");
    const empty = page.getByText("Không có ảnh trong bộ lọc đã chọn");
    await expect(grid.or(empty).first()).toBeVisible();

    if (await grid.isVisible()) {
      // A card names its file and shows the image the server stored, not a
      // broken thumbnail — the blob has to exist behind the row.
      const first = page.locator(".pd-image-item").first();
      await expect(first).toBeVisible();
      await expect(first.locator("img").first()).toHaveJSProperty("complete", true);
      await expect
        .poll(async () => first.locator("img").first().evaluate((i: HTMLImageElement) => i.naturalWidth))
        .toBeGreaterThan(0);
    }
  });

  test("the image tab filter controls are present", async ({ page }) => {
    await openImageTab(page);

    // The treatment phase filter should be visible.
    await expect(page.getByText("Giai đoạn điều trị")).toBeVisible();
  });

  test("the gallery fills the rest of the screen", async ({ page }) => {
    await openImageTab(page);

    const gallery = page.locator(".pd-image-gallery");
    const galleryBox = await gallery.boundingBox();
    const pageBox = await page.locator(".pd-page").boundingBox();

    expect(galleryBox).not.toBeNull();
    expect(pageBox).not.toBeNull();
    expect(galleryBox!.y + galleryBox!.height).toBeGreaterThan(pageBox!.y + pageBox!.height - 8);
  });
});
