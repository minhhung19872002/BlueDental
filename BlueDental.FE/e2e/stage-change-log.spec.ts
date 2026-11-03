import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call, STAGES } from "./fixtures/laboApi";
import { openStageDialog, reopenStageDialog } from "./fixtures/stageDialog";
import { clinicDay, freshLine, postDated } from "./fixtures/stageDateLock";

/**
 * "Lịch sử chỉnh sửa" on the slip page (F-88, BA 2026-11-02: "hiển thị lịch sử
 * chỉnh sửa để admin có thể coi"): the admin opens the slip's log from the
 * LỊCH SỬ ĐIỀU TRỊ header, narrows it to one row or one action, and reads who
 * changed what, before and after — a deleted row's too.
 *
 * The edit is made through the real pencil, the delete through the real
 * confirm; nothing is intercepted, and the log is read again after a reload.
 */

function stageRow(page: Page, stageId: string) {
  return page.locator(`.pd-stage-histrow[data-stage-id="${stageId}"]`);
}

function logDialog(page: Page) {
  return page.getByRole("dialog", { name: "Lịch sử chỉnh sửa" });
}

test.describe("Lịch sử chỉnh sửa of LỊCH SỬ ĐIỀU TRỊ (F-88)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    await login(page);
  });

  test("the admin reads a note edit and a deleted row, slip-wide and per row", async ({ page }) => {
    const id = runId();
    const edited = `- sửa nội dung ${id}`;
    const line = await freshLine(page, { teeth: [36, 37] });
    const older = await postDated(page, line, [36], clinicDay(-2));
    const newer = await postDated(page, line, [37], clinicDay(-1));

    await openStageDialog(page, line);

    // Nội dung điều trị on the date-locked row, through its pencil.
    const oldRow = stageRow(page, older);
    await oldRow.locator(".pd-stage-noteblock").getByRole("button", { name: "Sửa ghi chú" }).click();
    await oldRow.locator(".pd-stage-noteedit textarea").fill(edited);
    await oldRow.locator(".pd-stage-noteedit").getByRole("button", { name: "Lưu" }).click();
    await expect(oldRow.locator(".pd-stage-note")).toContainText(`sửa nội dung ${id}`);

    // The newer row goes.
    await stageRow(page, newer).getByRole("button", { name: "Xóa công đoạn" }).click();
    const confirm = page.getByRole("dialog", { name: "Xóa công đoạn" });
    await confirm.getByRole("button", { name: /Xoá$/ }).click();
    await expect(confirm).toBeHidden();
    await expect(stageRow(page, newer)).toHaveCount(0);

    await page.reload();
    await reopenStageDialog(page, line);

    // Slip-wide, from the header: newest first, the deleted row named and tagged.
    await page.locator(".pd-stage-history > header").getByRole("button", { name: "Lịch sử chỉnh sửa" }).click();
    const dialog = logDialog(page);
    await expect(dialog).toBeVisible();
    const rows = dialog.locator(".ant-table-tbody > tr.ant-table-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Xóa công đoạn");
    await expect(rows.nth(0)).toContainText("Đã xóa");
    await expect(rows.nth(0)).toContainText(line.serviceName);
    await expect(rows.nth(1)).toContainText("Sửa nội dung điều trị");
    await expect(rows.nth(1)).toContainText("Nội dung điều trị");

    // Opened, the note edit shows what it was and what it became.
    await rows.nth(1).getByRole("button", { name: /expand|mở rộng/i }).click();
    const diff = dialog.locator(".stage-log-diff");
    await expect(diff.locator(".stage-log-diff__box--before")).toContainText("e2e khoá ngày");
    await expect(diff.locator(".stage-log-diff__box--after")).toContainText(`sửa nội dung ${id}`);

    // Thao tác filter.
    const action = dialog.getByRole("combobox", { name: "Thao tác" });
    await action.click();
    await page.locator(".ant-select-dropdown:visible").getByText("Xóa công đoạn", { exact: true }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Đã xóa");
    await dialog.locator(".stage-log__action .ant-select-clear").click();
    await expect(rows).toHaveCount(2);

    // Công đoạn filter: one row's changes — the only per-row way in (owner,
    // 2026-11-02: the log lives in the header, not on every row).
    await expect(oldRow.getByRole("button", { name: "Lịch sử chỉnh sửa" })).toHaveCount(0);
    // Options read "DD/MM/YYYY · dịch vụ", a deleted one "(Đã xóa)" after it.
    const olderDay = clinicDay(-2).split("-").reverse().join("/");
    await dialog.getByRole("combobox", { name: "Công đoạn" }).click();
    await page.locator(`.ant-select-item-option[title^="${olderDay}"]`).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Sửa nội dung điều trị");

    await dialog.getByRole("button", { name: /close|đóng/i }).click();
    await expect(dialog).toBeHidden();

    // The server holds the same.
    const log = await call<{ action: number }[]>(page, `${STAGES}/change-logs?treatmentId=${line.planId}`, {
      branchId: line.branchId,
    });
    expect(log.status).toBe(200);
    expect((log.body as { action: number }[]).map((one) => one.action)).toEqual([8, 1]);
  });
});
