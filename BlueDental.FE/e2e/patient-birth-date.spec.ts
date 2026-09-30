import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Hồ sơ bệnh nhân → Ngày sinh typed as bare digits (BA request
 * 2026-09-30).
 *
 * Typing "ddmmyyyy" with no separators is formatted as dd/mm/yyyy while it is
 * typed, and the open calendar jumps to and selects that day — nobody has to
 * page back through decades with «. The record saves with that birth date.
 *
 * Real login, real API, real database; nothing is intercepted.
 */

const PATIENTS = "/api/v1/app/patients";

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
