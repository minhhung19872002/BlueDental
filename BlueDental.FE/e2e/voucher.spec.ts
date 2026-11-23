import { expect, test, type Locator } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/** The "Không giới hạn" box that sits under the field labelled `fieldLabel`. */
function unlimitedBox(dialog: Locator, fieldLabel: string): Locator {
  return dialog
    .locator(".voucher-unlimited-field")
    .filter({ has: dialog.page().getByLabel(fieldLabel) })
    .getByRole("checkbox", { name: "Không giới hạn" });
}

/**
 * Feature: Voucher khuyến mãi.
 *
 * A voucher is created unpublished. The publish toggle makes it live.
 * The table shows 8 columns matching the reference layout.
 */
test.describe("Voucher", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("creates a voucher via single tab, publishes it, then unpublishes", async ({ page }) => {
    const id = runId();
    const code = `E2E-${id}`;
    const name = `Voucher E2E ${id}`;

    await page.goto("/voucher");
    await assertRealApiTraffic(page, "/api/v1/app/vouchers");

    await page.getByRole("button", { name: /Tạo voucher/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // exact: the shuffle button's aria-label "Tạo mã ngẫu nhiên" also contains this text.
    await dialog.getByLabel("Mã ngẫu nhiên", { exact: true }).fill(code);
    await dialog.getByLabel("Nhập tên voucher").fill(name);
    await dialog.getByLabel("Nhập số lượt tối đa").fill("50");
    await dialog.getByLabel("Mức giảm").fill("10");

    await dialog.getByRole("button", { name: "Tạo voucher" }).click();

    const row = page.getByRole("row", { name: new RegExp(code) });
    await expect(row).toBeVisible();

    await expect(row).toContainText("10%");
    await expect(row).toContainText("0 / 50");

    // Publish the voucher via the toggle
    const toggle = row.getByRole("switch");
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(row.getByText("Đang hoạt động")).toBeVisible();

    // Unpublish
    await toggle.click();

    // Verify persistence
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(code) })).toBeVisible();
  });

  test("rejects a percentage above 100", async ({ page }) => {
    await page.goto("/voucher");

    await page.getByRole("button", { name: /Tạo voucher/ }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("Mã ngẫu nhiên", { exact: true }).fill(`BAD${runId()}`);
    await dialog.getByLabel("Nhập tên voucher").fill("Quá tay");
    await dialog.getByLabel("Nhập số lượt tối đa").fill("10");
    await dialog.getByLabel("Mức giảm").fill("150");
    await dialog.getByRole("button", { name: "Tạo voucher" }).click();

    await expect(dialog.getByText("Phần trăm tối đa là 100")).toBeVisible();
  });

  test("filters by status", async ({ page }) => {
    await page.goto("/voucher");
    await assertRealApiTraffic(page, "/api/v1/app/vouchers");

    const statusSelect = page.locator(".voucher-toolbar .ant-select");
    await statusSelect.click();
    // antd v6 renders dropdown items without role="option", so target by class.
    await page
      .locator(".ant-select-dropdown .ant-select-item-option")
      .filter({ hasText: "Đang hoạt động" })
      .click();

    await assertRealApiTraffic(page, "/api/v1/app/vouchers");
  });

  test("creates a batch with shared config; card #1 mirrors the single-tab code", async ({ page }) => {
    const id = runId();

    await page.goto("/voucher");
    await assertRealApiTraffic(page, "/api/v1/app/vouchers");

    await page.getByRole("button", { name: /Tạo voucher/ }).click();
    const dialog = page.getByRole("dialog");

    // The single tab opens with a server-minted code (async fetch); wait for
    // it before reading — the batch tab's card #1 must carry the same one.
    const codeInput = dialog.getByLabel("Mã ngẫu nhiên", { exact: true });
    await expect(codeInput).not.toHaveValue("");
    const singleCode = await codeInput.inputValue();

    await dialog.getByRole("tab", { name: "Tạo một lượt" }).click();
    await expect(dialog.getByText(`HN-${singleCode}`)).toBeVisible();

    await dialog.getByLabel(/Nhập số lượng mã/).fill("3");
    await expect(dialog.getByText("#3")).toBeVisible();

    for (const n of [1, 2, 3]) {
      await dialog.getByLabel(`Tên voucher #${n}`).fill(`Batch ${id} số ${n}`);
    }
    await dialog.getByLabel("Nhập số lượt tối đa").fill("40");

    await dialog.getByRole("button", { name: "Tạo voucher" }).click();

    for (const n of [1, 2, 3]) {
      const row = page.getByRole("row", { name: new RegExp(`Batch ${id} số ${n}`) });
      await expect(row).toBeVisible();
      await expect(row).toContainText("0 / 40");
    }

    // Card #1 was created under the code shown on the single tab.
    await expect(
      page.getByRole("row", { name: new RegExp(`Batch ${id} số 1`) }),
    ).toContainText(singleCode);
  });

  test("configures one batch voucher individually", async ({ page }) => {
    const id = runId();

    await page.goto("/voucher");
    await page.getByRole("button", { name: /Tạo voucher/ }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("tab", { name: "Tạo một lượt" }).click();
    await dialog.getByLabel(/Nhập số lượng mã/).fill("2");

    await dialog.getByLabel("Tên voucher #1").fill(`Riêng ${id} A`);
    await dialog.getByLabel("Tên voucher #2").fill(`Riêng ${id} B`);

    // Shared value first, then pick card #2 for its own configuration —
    // clicking a card leaves "Cấu hình tất cả" and keeps card #1 at 30.
    await dialog.getByLabel("Nhập số lượt tối đa").fill("30");
    await dialog.getByText("#2").click();
    await expect(dialog.getByRole("checkbox", { name: "Cấu hình tất cả" })).not.toBeChecked();

    await dialog.getByLabel("Nhập số lượt tối đa").fill("70");
    await dialog.getByLabel("Mã ngẫu nhiên", { exact: true }).fill(`RIENG-${id}`);

    await dialog.getByRole("button", { name: "Tạo voucher" }).click();

    const rowA = page.getByRole("row", { name: new RegExp(`Riêng ${id} A`) });
    const rowB = page.getByRole("row", { name: new RegExp(`Riêng ${id} B`) });
    await expect(rowA).toContainText("0 / 30");
    await expect(rowB).toContainText("0 / 70");
    await expect(rowB).toContainText(`RIENG-${id}`);

    // Persisted, not just rendered.
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(`Riêng ${id} B`) })).toContainText(
      "0 / 70",
    );
  });

  test("refuses a batch when a voucher name is missing", async ({ page }) => {
    await page.goto("/voucher");
    await page.getByRole("button", { name: /Tạo voucher/ }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("tab", { name: "Tạo một lượt" }).click();
    await dialog.getByLabel(/Nhập số lượng mã/).fill("2");
    await dialog.getByLabel("Tên voucher #1").fill("Chỉ có một tên");
    await dialog.getByLabel("Nhập số lượt tối đa").fill("10");

    await dialog.getByRole("button", { name: "Tạo voucher" }).click();

    await expect(page.getByText("Vui lòng nhập tên cho tất cả voucher")).toBeVisible();
    // The offending card is highlighted and nothing was created.
    await expect(dialog).toBeVisible();
  });

  // R-1279: "không giới hạn lượt, với không giới hạn thời gian".
  test("creates a voucher with no use limit and no end date, then sets both back", async ({ page }) => {
    const id = runId();
    const code = `VOH-${id}`;
    const name = `Vô hạn E2E ${id}`;

    await page.goto("/voucher");
    await assertRealApiTraffic(page, "/api/v1/app/vouchers");

    await page.getByRole("button", { name: /Tạo voucher/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Mã ngẫu nhiên", { exact: true }).fill(code);
    await dialog.getByLabel("Nhập tên voucher").fill(name);
    await dialog.getByLabel("Mức giảm").fill("10");

    // Both boxes start unticked, so the fields stay required.
    const usageBox = unlimitedBox(dialog, "Nhập số lượt tối đa");
    const endBox = unlimitedBox(dialog, "Ngày hết hạn");
    await expect(usageBox).not.toBeChecked();
    await expect(endBox).not.toBeChecked();

    await usageBox.check();
    await endBox.check();
    await expect(dialog.getByLabel("Nhập số lượt tối đa")).toBeDisabled();
    await expect(dialog.getByLabel("Ngày hết hạn")).toBeDisabled();

    await dialog.getByRole("button", { name: "Tạo voucher" }).click();

    const row = page.getByRole("row", { name: new RegExp(code) });
    await expect(row).toContainText("0 / ∞");
    await expect(row).toContainText("— Không giới hạn");

    // Persisted as open-ended, and the edit dialog reopens with both ticked.
    await page.reload();
    const persisted = page.getByRole("row", { name: new RegExp(code) });
    await expect(persisted).toContainText("0 / ∞");
    await expect(persisted).toContainText("— Không giới hạn");

    // Where vouchers get used — the plan and payment pickers read
    // vouchers/available — a published open-ended voucher is still offered
    // decades on.
    await persisted.getByRole("switch").click();
    await expect(persisted.getByText("Đang hiển thị")).toBeVisible();
    const offered = await page.evaluate(async (wanted) => {
      const res = await fetch("/api/v1/app/vouchers/available?orderAmount=1000000&onDate=2099-12-31", {
        credentials: "include",
      });
      const list = (await res.json()) as { code: string; endDate: string | null; usageLimit: number | null }[];
      return list.find((v) => v.code.endsWith(wanted)) ?? null;
    }, code);
    expect(offered, `${code} should still be offered in 2099`).toMatchObject({ endDate: null, usageLimit: null });

    await persisted.locator(".voucher-actions button").first().click();
    const edit = page.getByRole("dialog").filter({ hasText: "Chỉnh sửa voucher" });
    await expect(unlimitedBox(edit, "Nhập số lượt tối đa")).toBeChecked();
    await expect(unlimitedBox(edit, "Ngày hết hạn")).toBeChecked();

    // Unticking makes the field required again.
    await unlimitedBox(edit, "Nhập số lượt tối đa").uncheck();
    await edit.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(edit.getByText("Vui lòng nhập số lượt")).toBeVisible();

    await edit.getByLabel("Nhập số lượt tối đa").fill("20");
    await edit.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("0 / 20");

    await page.reload();
    const edited = page.getByRole("row", { name: new RegExp(code) });
    await expect(edited).toContainText("0 / 20");
    await expect(edited).toContainText("— Không giới hạn");
  });

  test("a batch card configured on its own can be unlimited while the others keep a limit", async ({ page }) => {
    const id = runId();

    await page.goto("/voucher");
    await page.getByRole("button", { name: /Tạo voucher/ }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("tab", { name: "Tạo một lượt" }).click();
    await dialog.getByLabel(/Nhập số lượng mã/).fill("2");
    await dialog.getByLabel("Tên voucher #1").fill(`Lô vô hạn ${id} A`);
    await dialog.getByLabel("Tên voucher #2").fill(`Lô vô hạn ${id} B`);

    await dialog.getByLabel("Nhập số lượt tối đa").fill("30");
    await dialog.getByText("#2").click();
    await unlimitedBox(dialog, "Nhập số lượt tối đa").check();
    await unlimitedBox(dialog, "Ngày hết hạn").check();

    // Card #1 keeps its own 30 uses and date when shown again.
    await dialog.getByText("#1").click();
    await expect(unlimitedBox(dialog, "Nhập số lượt tối đa")).not.toBeChecked();
    await expect(dialog.getByLabel("Nhập số lượt tối đa")).toHaveValue("30");

    await dialog.getByRole("button", { name: "Tạo voucher" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row", { name: new RegExp(`Lô vô hạn ${id} B`) })).toContainText("0 / ∞");

    await page.reload();
    const rowA = page.getByRole("row", { name: new RegExp(`Lô vô hạn ${id} A`) });
    const rowB = page.getByRole("row", { name: new RegExp(`Lô vô hạn ${id} B`) });
    await expect(rowA).toContainText("0 / 30");
    await expect(rowA).not.toContainText("Không giới hạn");
    await expect(rowB).toContainText("0 / ∞");
    await expect(rowB).toContainText("— Không giới hạn");
  });

  test("edits every field of a voucher through the edit dialog", async ({ page }) => {
    const id = runId();
    const code = `EDT-${id}`;
    const name = `Sửa E2E ${id}`;
    const newName = `Đã sửa E2E ${id}`;

    await page.goto("/voucher");
    await assertRealApiTraffic(page, "/api/v1/app/vouchers");

    // Create the voucher this test will edit.
    await page.getByRole("button", { name: /Tạo voucher/ }).click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByLabel("Mã ngẫu nhiên", { exact: true }).fill(code);
    await createDialog.getByLabel("Nhập tên voucher").fill(name);
    await createDialog.getByLabel("Nhập số lượt tối đa").fill("50");
    await createDialog.getByLabel("Mức giảm").fill("10");
    await createDialog.getByRole("button", { name: "Tạo voucher" }).click();

    const row = page.getByRole("row", { name: new RegExp(code) });
    await expect(row).toBeVisible();

    // The pencil opens the edit dialog — the same single-voucher form as create.
    await row.locator(".voucher-actions button").first().click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Chỉnh sửa voucher" });
    await expect(dialog).toBeVisible();

    // Prefilled with the voucher's own values, and every field is editable.
    await expect(dialog.getByLabel("Mã ngẫu nhiên", { exact: true })).toHaveValue(code);
    await expect(dialog.getByLabel("Nhập tên voucher")).toHaveValue(name);

    await dialog.getByLabel("Nhập tên voucher").fill(newName);
    await dialog.getByLabel("Mức giảm").fill("25");
    await dialog.getByLabel("Nhập số lượt tối đa").fill("99");

    await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();

    const editedRow = page.getByRole("row", { name: new RegExp(newName) });
    await expect(editedRow).toBeVisible();
    await expect(editedRow).toContainText("25%");
    await expect(editedRow).toContainText("0 / 99");
    await expect(editedRow).toContainText(code);

    // Persisted, not just rendered.
    await page.reload();
    const persisted = page.getByRole("row", { name: new RegExp(newName) });
    await expect(persisted).toBeVisible();
    await expect(persisted).toContainText("25%");
    await expect(persisted).toContainText("0 / 99");
  });
});
