import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { call, STAGES } from "./fixtures/laboApi";
import { openStageDialog, reopenStageDialog } from "./fixtures/stageDialog";
import { clinicDay, freshLine, postDated } from "./fixtures/stageDateLock";

/**
 * F-88 on screen (BA 2026-11-02): in LỊCH SỬ ĐIỀU TRỊ only the công đoạn of
 * the line's newest Ngày điều trị can be ticked or have a Labo order raised;
 * an older row says why and keeps Tải ảnh. An admin's "Xóa công đoạn" takes a
 * row out after a red confirm, and the older row opens again.
 *
 * Seeded over real HTTP, driven through the real slip page; nothing is
 * intercepted, and the outcome is read back after a reload.
 */

function stageRow(page: Page, stageId: string) {
  return page.locator(`.pd-stage-histrow[data-stage-id="${stageId}"]`);
}

test.describe("Stage date lock on the slip page (F-88)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    await login(page);
  });

  test("the older row is locked with a note; Xóa công đoạn on the newer one unlocks it", async ({ page }) => {
    const line = await freshLine(page, { teeth: [36, 37] });
    const older = await postDated(page, line, [36], clinicDay(-2));
    const newer = await postDated(page, line, [37], clinicDay(-1));

    await openStageDialog(page, line);
    const lockedRow = stageRow(page, older);
    const openRow = stageRow(page, newer);
    await expect(lockedRow).toBeVisible();

    await expect(lockedRow.getByRole("checkbox", { name: "Hoàn thành" })).toBeDisabled();
    await expect(lockedRow.locator(".pd-stage-date-lock")).toContainText(
      "Khoá: dịch vụ đã có công đoạn ngày mới hơn",
    );
    await expect(lockedRow.getByRole("button", { name: "Tạo Labo" })).toHaveCount(0);
    // Tải ảnh, Nội dung and Ghi chú stay with the row.
    await expect(lockedRow.getByRole("button", { name: "Tải ảnh" })).toBeEnabled();

    await expect(openRow.getByRole("checkbox", { name: "Hoàn thành" })).toBeEnabled();
    await expect(openRow.locator(".pd-stage-date-lock")).toHaveCount(0);
    await expect(openRow.getByRole("button", { name: "Tạo Labo" })).toBeVisible();

    await openRow.getByRole("button", { name: "Xóa công đoạn" }).click();
    const confirm = page.getByRole("dialog", { name: "Xóa công đoạn" });
    await expect(confirm).toContainText("Răng của nó trả về công đoạn trước.");
    // The shared red confirm is spelled "Xoá" (Common:Delete).
    await confirm.getByRole("button", { name: /Xoá$/ }).click();
    await expect(confirm).toBeHidden();
    await expect(openRow).toHaveCount(0);

    await page.reload();
    await reopenStageDialog(page, line);
    await expect(stageRow(page, older)).toBeVisible();
    await expect(stageRow(page, newer)).toHaveCount(0);
    await expect(stageRow(page, older).getByRole("checkbox", { name: "Hoàn thành" })).toBeEnabled();
    await expect(stageRow(page, older).locator(".pd-stage-date-lock")).toHaveCount(0);

    const gone = await call(page, `${STAGES}/${newer}`, { branchId: line.branchId });
    expect(gone.status).toBe(404);
  });
});
