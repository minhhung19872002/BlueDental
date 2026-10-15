import { expect, type Locator, type Page } from "@playwright/test";

export interface SlipRef {
  patientId: string;
  planId: string;
  branchId: string;
}

/**
 * BROKEN since R-956 (2026-10-15): the row "+" is now part of the "Số phiếu
 * điều trị" link and opens the slip page, not this dialog. The dialog moves
 * onto the slip page in a follow-up task — repoint both helpers there.
 *
 * "Chi tiết phiếu" for one slip, from the "+" on its row in Kế hoạch điều trị.
 * The slip page's toolbar no longer carries "Thêm công đoạn" (owner
 * 2026-10-15), so this row button is where the whole-slip dialog opens now.
 *
 * At least 900 tall: at Playwright's 720 a patient with "Dịch vụ đang điều trị"
 * cards leaves the slip table's scroller no rows' height, and its sticky header
 * takes the click.
 */
export async function openStageDialog(page: Page, slip: SlipRef): Promise<Locator> {
  const size = page.viewportSize();
  if (size && size.height < 900) await page.setViewportSize({ width: size.width, height: 900 });
  await page.goto(`/patient/${slip.patientId}?branchId=${slip.branchId}&tab=treatment-plan`);
  return reopenStageDialog(page, slip);
}

/** The same, on the plan list already loaded — after a `page.reload()`. */
export async function reopenStageDialog(page: Page, slip: SlipRef): Promise<Locator> {
  const row = page.locator(`.tp-table tr[data-row-key="${slip.planId}"]`);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole("button", { name: /^Thêm công đoạn / }).click();
  const dialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
  await expect(dialog).toBeVisible();
  return dialog;
}
