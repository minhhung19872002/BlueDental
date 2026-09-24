import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";
import { cardQr } from "./fixtures/cccdQr";
import {
  BRANCH_ONE,
  freshNationalId,
  getJson,
  NEW_ADDRESS,
  OLD_ADDRESS,
  OLD_ADDRESS_HCM,
  PATIENTS,
  preview,
  recordOf,
  saveWithPhone,
  scanPhoto,
} from "./fixtures/scanId";

/**
 * Feature: Danh sách bệnh nhân → "Quét CCCD", from a photo of the card.
 *
 * This browser has no camera, so the dialog's camera comes up "not found" and
 * "Tải ảnh" is the way in — which is also the fallback a desk without a
 * camera has. The photo holds a real QR the app's own decoder reads. A new
 * card is previewed; "Tạo hồ sơ" opens filled from it, the card's pre-2025
 * address kept in "Địa chỉ cũ" and converted to today's Tỉnh / Xã. The camera
 * path is covered by patient-scan-id-camera.spec.ts. Login, API and PostgreSQL
 * are real; nothing is intercepted.
 */

test.describe("Quét CCCD from a photo (real stack)", () => {
  test("a photo of the QR is read, and an old HCM address converts to today's ward", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    const id = runId();
    const cccd = freshNationalId(id, "41");
    const name = `NGUYỄN VĂN ẢNH ${id}`;

    const dialog = await scanPhoto(page, cardQr(cccd, name, OLD_ADDRESS_HCM));

    const card = preview(dialog);
    await expect(card.getByText(cccd)).toBeVisible({ timeout: 20_000 });
    await expect(card.getByText("Phường Bến Thành, Thành phố Hồ Chí Minh")).toBeVisible();
    await dialog.getByRole("button", { name: "Tạo hồ sơ" }).click();
    await saveWithPhone(page, `07${id}0041`.slice(0, 10));

    expect(await recordOf(page, cccd)).toMatchObject({
      address: "12 Lê Lợi",
      provinceCode: "79",
      wardCode: "26743",
      oldAddress: OLD_ADDRESS_HCM,
    });
  });

  test("a new-shape address fills Tỉnh / Xã and leaves Địa chỉ cũ empty", async ({ page }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    const id = runId();
    const cccd = freshNationalId(id, "51");
    const name = `HUỲNH VĂN ĐỊNH ${id}`;

    const dialog = await scanPhoto(page, cardQr(cccd, name, NEW_ADDRESS));
    const card = preview(dialog);
    await expect(card.getByText("Nơi thường trú", { exact: true })).toBeVisible();
    await expect(card.getByText("Xã Hòa Long, Tỉnh Đồng Tháp")).toBeVisible();

    await dialog.getByRole("button", { name: "Tạo hồ sơ" }).click();
    const form = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    await expect(form.getByRole("textbox", { name: "Số nhà/ Đường" })).toHaveValue(
      "180b/4 Ấp Long Hưng 2",
    );
    await expect(form.getByRole("textbox", { name: "Địa chỉ cũ" })).toHaveValue("");
    await saveWithPhone(page, `07${id}0051`.slice(0, 10));

    const record = await recordOf(page, cccd);
    expect(record).toMatchObject({ provinceCode: "82", wardCode: "30208", oldAddress: null });
  });

  test("something that is not a card is refused in the dialog", async ({ page }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    const dialog = await scanPhoto(page, "https://example.com/not-a-card");

    await expect(dialog.getByText(/Mã QR này không phải CCCD/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Tạo hồ sơ" })).toBeDisabled();
    await expect(page.getByRole("dialog", { name: "Tạo hồ sơ" })).toBeHidden();
  });

  test("the lookup answers yes/no only, per branch", async ({ browser }) => {
    const id = runId();
    const cccd = freshNationalId(id, "22");

    const adminPage = await browser.newPage();
    await login(adminPage);
    await adminPage.goto("/patient");
    await assertRealApiTraffic(adminPage, PATIENTS);

    const before = await getJson<Record<string, unknown>>(
      adminPage,
      `${PATIENTS}/by-national-id?nationalId=${cccd}`,
      BRANCH_ONE,
    );
    expect(before.status).toBe(200);
    expect(before.body).toEqual({ exists: false });

    const dialog = await scanPhoto(adminPage, cardQr(cccd, `TRẦN THỊ TRA ${id}`, OLD_ADDRESS));
    await dialog.getByRole("button", { name: "Tạo hồ sơ" }).click();
    await saveWithPhone(adminPage, `07${id}0022`.slice(0, 10));

    // Found — and nothing about the holder comes back with it (R-564).
    const after = await getJson<Record<string, unknown>>(
      adminPage,
      `${PATIENTS}/by-national-id?nationalId=${cccd}`,
      BRANCH_ONE,
    );
    expect(after.body).toEqual({ exists: true });
    await adminPage.close();

    // The other branch does not see branch one's record.
    const branchPage = await browser.newPage();
    await login(branchPage, BRANCH2_USER);
    await branchPage.goto("/patient");
    const elsewhere = await getJson<Record<string, unknown>>(
      branchPage,
      `${PATIENTS}/by-national-id?nationalId=${cccd}`,
    );
    expect(elsewhere.status).toBe(200);
    expect(elsewhere.body).toEqual({ exists: false });
    await branchPage.close();
  });
});
