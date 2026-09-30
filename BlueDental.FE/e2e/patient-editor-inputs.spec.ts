import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Hồ sơ bệnh nhân dialog inputs (BA requests 2026-09-30).
 *
 * - The "Tiểu sử bệnh" pill carries the number of ticked entries, readable
 *   from either pill, and shows no tag while nothing is ticked.
 * - Ngày sinh typed as bare digits ("ddmmyyyy") is formatted as dd/mm/yyyy
 *   while it is typed, and the open calendar jumps to and selects that day.
 *   The record saves with that birth date.
 *
 * Real login, real API, real database; nothing is intercepted.
 */

const PATIENTS = "/api/v1/app/patients";

test.describe("disease history pill count", () => {
  test("the Tiểu sử bệnh pill counts ticked entries and hides at zero", async ({ page }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    const pill = dialog.getByRole("tab", { name: /Tiểu sử bệnh/ });
    const count = pill.locator(".bd-patient-subtab-count");
    await expect(count).toHaveCount(0);

    // Tick up to two entries, across groups, from the seeded Lịch sử bệnh catalog.
    await pill.click();
    const heads = dialog.locator(".bd-patient-history-head");
    await expect(heads.first()).toBeVisible();
    let ticked = 0;
    for (let i = 0; i < (await heads.count()) && ticked < 2; i += 1) {
      await heads.nth(i).click();
      const boxes = dialog.locator(".bd-patient-history-body").getByRole("checkbox");
      for (let j = 0; j < (await boxes.count()) && ticked < 2; j += 1) {
        await boxes.nth(j).check();
        ticked += 1;
        await expect(count).toHaveText(String(ticked));
      }
    }
    expect(ticked, "the local seed needs at least one Lịch sử bệnh entry").toBeGreaterThan(0);

    // Still readable from the other pill.
    await dialog.getByRole("tab", { name: "Thông tin cơ bản" }).click();
    await expect(count).toHaveText(String(ticked));

    // Unticking everything removes the tag.
    await pill.click();
    const checked = dialog.locator(".bd-patient-history-body").getByRole("checkbox", { checked: true });
    while ((await checked.count()) > 0) await checked.first().uncheck();
    // Earlier groups are collapsed; reopen each and clear anything still ticked.
    for (let i = 0; i < (await heads.count()); i += 1) {
      if ((await heads.nth(i).locator(".bd-patient-history-count").count()) === 0) continue;
      await heads.nth(i).click();
      while ((await checked.count()) > 0) await checked.first().uncheck();
    }
    await expect(count).toHaveCount(0);
  });
});

test.describe("patient birth date typed as digits", () => {
  test("24081997 becomes 24/08/1997, is picked on the calendar and saves", async ({ page }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    await expect(dialog).toBeVisible();

    const id = runId();
    const name = `E2E ${id} Dob`;
    await dialog.getByRole("textbox", { name: "Họ và tên *" }).fill(name);
    await dialog.getByRole("textbox", { name: "Điện thoại *" }).fill(`09${id}0077`.slice(0, 10));

    const dob = dialog.getByRole("textbox", { name: "Ngày sinh" });
    await dob.click();
    await page.keyboard.type("24081997");
    await expect(dob).toHaveValue("24/08/1997");

    // The calendar has moved to August 1997 with the 24th selected.
    const panel = page.locator(".ant-picker-dropdown:visible");
    await expect(panel.locator(".ant-picker-header-view")).toContainText("1997");
    await expect(panel.locator('td[title="1997-08-24"]')).toHaveClass(/ant-picker-cell-selected/);

    // Close the panel on a neutral spot, then save.
    await dialog.getByRole("textbox", { name: "Họ và tên *" }).click();
    await expect(dob).toHaveValue("24/08/1997");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // After a reload the list still shows the saved birth date on that row.
    await page.reload();
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toContainText("24/08/1997");
  });

  test("an impossible day is not accepted", async ({ page }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    const dob = dialog.getByRole("textbox", { name: "Ngày sinh" });
    await dob.click();
    await page.keyboard.type("31022000");

    // 31/02 is no date: nothing is selected, and leaving the box clears it.
    await expect(page.locator(".ant-picker-dropdown:visible .ant-picker-cell-selected")).toHaveCount(0);
    await dialog.getByRole("textbox", { name: "Họ và tên *" }).click();
    await expect(dob).toHaveValue("");
  });
});
