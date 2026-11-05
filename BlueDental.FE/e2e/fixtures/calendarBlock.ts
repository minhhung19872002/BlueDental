import type { Locator, Page } from "@playwright/test";

/**
 * Opens a view-Ngày booking's editor. A click on the block opens the patient
 * since R-1149 (BA 2026-11-05); editing goes through ⋮ → "Cập nhật".
 */
export async function openBlockEditor(page: Page, block: Locator): Promise<void> {
  await block.hover();
  await block.locator(".dtl-block-menu").click();
  await page.getByRole("menuitem", { name: "Cập nhật" }).click();
}
