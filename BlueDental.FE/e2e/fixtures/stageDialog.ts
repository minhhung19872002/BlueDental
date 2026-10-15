import { expect, type Locator, type Page } from "@playwright/test";

export interface SlipRef {
  patientId: string;
  planId: string;
  branchId: string;
}

/**
 * "Chi tiết phiếu" laid into the slip page under its service table (R-957,
 * BA 2026-10-15) — no longer a dialog. It is always open: no row picked shows
 * every line of the slip.
 */
export function stagePanel(page: Page): Locator {
  return page.getByRole("region", { name: "Chi tiết phiếu" });
}

/**
 * Opens the slip page on Chi tiết điều trị and returns its "Chi tiết phiếu"
 * section. The helpers keep their dialog-era names so the specs read as before.
 *
 * At least 900 tall so the service table and the panel's cards both fit.
 */
export async function openStageDialog(page: Page, slip: SlipRef): Promise<Locator> {
  const size = page.viewportSize();
  if (size && size.height < 900) await page.setViewportSize({ width: size.width, height: 900 });
  await page.goto(`/patient/${slip.patientId}/treatment-plan/${slip.planId}?branchId=${slip.branchId}&planTab=detail`);
  return reopenStageDialog(page, slip);
}

/** The same, on the slip page already loaded — after a `page.reload()`. */
export async function reopenStageDialog(page: Page, _slip: SlipRef): Promise<Locator> {
  const panel = stagePanel(page);
  await expect(panel).toBeVisible({ timeout: 20_000 });
  // The cards come with the slip's stages; wait for the tab counts to settle.
  await expect(panel.getByRole("tab").first()).toBeVisible();
  return panel;
}
