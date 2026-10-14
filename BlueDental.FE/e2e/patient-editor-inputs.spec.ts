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

/**
 * BA request 2026-10-13: the Tỉnh / Xã pickers are worked from the keyboard —
 * type a few letters and Enter takes the top hit, ↑ / ↓ walk the list, and
 * focus comes back to the field so Tab carries on.
 */
test.describe("address pickers from the keyboard", () => {
  test("Enter picks the top hit, arrows walk the list, and the record saves", async ({ page }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    await expect(dialog).toBeVisible();

    const id = runId();
    const name = `E2E ${id} Kbd`;
    await dialog.getByRole("textbox", { name: "Họ và tên *" }).fill(name);
    await dialog.getByRole("textbox", { name: "Điện thoại *" }).fill(`09${id}0078`.slice(0, 10));

    const picker = (label: RegExp) =>
      dialog.locator(".floating-field").filter({ hasText: label }).locator(".ss-trigger");
    const province = picker(/Tỉnh/);
    const ward = picker(/Phường|Xã/);
    const listbox = page.locator("#ss-portal-dropdown");

    // A few letters, then Enter: the top hit is taken and focus returns.
    await province.click();
    await expect(listbox.locator(".ss-search-input")).toBeFocused();
    await page.keyboard.type("Hồ Chí");
    await expect(listbox.getByRole("option").first()).toHaveClass(/ss-option--active/);
    await page.keyboard.press("Enter");
    await expect(listbox).toBeHidden();
    await expect(province).toContainText("Thành phố Hồ Chí Minh");
    await expect(province).toBeFocused();

    // Tab to Xã / Phường, ↓ opens it on the first row, two more ↓ and Enter.
    await page.keyboard.press("Tab");
    await expect(ward).toBeFocused();
    // Reached by Tab, the field shows it has focus.
    await expect(ward).not.toHaveCSS("box-shadow", "none");
    await page.keyboard.press("ArrowDown");
    await expect(listbox).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    const third = listbox.getByRole("option").nth(2);
    await expect(third).toHaveClass(/ss-option--active/);
    const wardName = (await third.textContent()) ?? "";
    await page.keyboard.press("Enter");
    await expect(ward).toContainText(wardName);

    // The picked codes reach the API and the record is created.
    const created = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().endsWith(PATIENTS)
    );
    await dialog.getByRole("button", { name: "Lưu" }).click();
    const response = await created;
    expect(response.ok(), await response.text()).toBe(true);
    const body: { provinceCode?: string; wardCode?: string } = response.request().postDataJSON();
    expect(body.provinceCode).toBeTruthy();
    expect(body.wardCode).toBeTruthy();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  });

  test("Escape closes the list without picking and keeps focus on the field", async ({ page }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    const province = dialog.locator(".floating-field").filter({ hasText: /Tỉnh/ }).locator(".ss-trigger");
    const listbox = page.locator("#ss-portal-dropdown");

    await province.click();
    await expect(listbox.locator(".ss-search-input")).toBeFocused();
    // ↑ from the first row wraps to the last one.
    await page.keyboard.press("ArrowUp");
    await expect(listbox.getByRole("option").last()).toHaveClass(/ss-option--active/);
    await page.keyboard.press("Escape");
    await expect(listbox).toBeHidden();
    await expect(province).toBeFocused();
    await expect(province.locator(".ss-value--selected")).toHaveCount(0);
    await expect(dialog).toBeVisible();
  });
});
