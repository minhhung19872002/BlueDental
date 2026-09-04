import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Bệnh án — the record's second view, behind the header's
 * Chi tiết hồ sơ / Bệnh án switch.
 *
 * Real stack throughout: adding a sheet POSTs, saving PUTs, and everything is
 * read back from PostgreSQL after a reload. Nothing is intercepted.
 */

/** Opens a patient's record and switches to Bệnh án. */
async function openMedicalRecord(page: Page) {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  await page
    .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
    .first()
    .click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

  // The tab mounts only when the view opens, so its list request goes out on
  // this click. Counting cards before it lands reads zero on a patient who
  // already has sheets.
  const listed = page.waitForResponse(
    (res) =>
      res.url().includes("/api/v1/app/patient-medical-records") &&
      res.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Bệnh án" }).click();
  await expect(page).toHaveURL(/view=medical-record/);
  expect((await listed).ok()).toBeTruthy();
}

/** The sheet cards nested under one form's row in the index. */
function cardsUnder(page: Page, form: string) {
  return page.locator(".pd-medical-form", { hasText: form }).locator(".pd-sheet-card");
}

const outpatientCards = (page: Page) => cardsUnder(page, "Bệnh án ngoại trú Răng Hàm Mặt");
const orthodonticCards = (page: Page) => cardsUnder(page, "Bệnh án chỉnh nha");

test.describe("Bệnh án", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("the index lists the reference's nine forms and the view rides in the URL", async ({
    page,
  }) => {
    await openMedicalRecord(page);

    // The index, in the reference's own order and wording.
    const forms = [
      "1. Bìa hồ sơ bệnh án",
      "2. Bệnh án ngoại trú Răng Hàm Mặt",
      "3. Bệnh án chỉnh nha",
      "4. Phiếu Tư Vấn Tổng Quát",
      "5. Phiếu tư vấn và xác nhận đồng ý điều trị",
      "6. Giấy đồng ý thực hiện phẫu thuật/thủ thuật",
      "7. Phiếu phẫu thuật/thủ thuật",
      "8. Phiếu theo dõi điều trị",
      "9. Phiếu chăm sóc",
    ];
    await expect(page.locator(".pd-medical-form")).toHaveCount(forms.length);
    for (const label of forms) {
      await expect(page.locator(".pd-medical-form").getByText(label, { exact: true })).toBeVisible();
    }

    // The bar the reference floats along the bottom.
    for (const command of ["Từng phiếu", "Toàn bộ", "In biểu mẫu", "Lưu"]) {
      await expect(page.locator(".pd-medical-bar").getByText(command, { exact: true })).toBeVisible();
    }
    await expect(page.locator(".pd-medical-zoom")).toContainText("100%");

    // Switching back to the tabbed view drops the parameter again.
    await page.getByRole("button", { name: "Chi tiết hồ sơ" }).click();
    await expect(page).not.toHaveURL(/view=/);
    await expect(page.locator(".pd-profile-card")).toBeVisible();
  });

  test("a form without a printed layout still gives a sheet that can be written on", async ({
    page,
  }) => {
    const note = `E2E chinh nha ${runId()}`;

    await openMedicalRecord(page);

    // "Bệnh án chỉnh nha" is one of the eight whose printed layout was never
    // observed; it opens the clinic's own plain sheet instead of nothing.
    await page
      .locator(".pd-medical-form", { hasText: "Bệnh án chỉnh nha" })
      .getByRole("button", { name: "Thêm" })
      .click();

    const sheet = page.locator(".pd-a4-free-page").last();
    await expect(sheet.getByText("BỆNH ÁN CHỈNH NHA")).toBeVisible();
    await expect(sheet.getByText("Bắt đầu từ mẫu")).toBeVisible();

    const body = sheet.locator(".pd-a4-free-body");
    await body.fill(note);

    const saved = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/patient-medical-records") &&
        res.request().method() === "PUT",
    );
    await page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" }).click();
    expect((await saved).ok()).toBeTruthy();

    await page.reload();
    await orthodonticCards(page).last().click();
    await expect(page.locator(".pd-a4-free-body").last()).toHaveValue(note);
  });

  test("a sheet is added, filled and survives a reload", async ({ page }) => {
    const kin = `E2E nguoi nha ${runId()}`;

    await openMedicalRecord(page);

    // Every card under this form carries the same title, so waiting on "the
    // last card says X" proves nothing — it already did. Count from a baseline
    // taken before the POST instead.
    const before = await outpatientCards(page).count();

    const added = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/patient-medical-records") &&
        res.request().method() === "POST",
    );
    await page
      .locator(".pd-medical-form", { hasText: "Bệnh án ngoại trú Răng Hàm Mặt" })
      .getByRole("button", { name: "Thêm" })
      .click();
    expect((await added).ok()).toBeTruthy();

    // The sheet joins its own form's row in the index and the printed form is
    // drawn. CreateAsync appends, so the new one is the last card under it.
    const cardCount = before + 1;
    const cards = outpatientCards(page);
    await expect(cards).toHaveCount(cardCount);
    await expect(cards.last()).toContainText("Bệnh án ngoại trú Răng Hàm Mặt");
    // Each card carries its own `Bản NN`, numbered within its own form.
    await expect(cards.last()).toContainText(`Bản ${String(cardCount).padStart(2, "0")}`);
    await expect(page.locator(".bd-a4-page")).toHaveCount(3);

    // Fill one of the sheet's own cells and save it.
    const cell = page.locator(".bd-a4-cellinput").first();
    await cell.fill(kin);

    const saved = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/patient-medical-records") &&
        res.request().method() === "PUT",
    );
    await page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" }).click();
    expect((await saved).ok()).toBeTruthy();

    // Reload: the cell came back from PostgreSQL.
    await page.reload();
    await outpatientCards(page).last().click();
    await expect(page.locator(".bd-a4-cellinput").first()).toHaveValue(kin);

    // And the sheet can be taken off the record again.
    await page.locator(".pd-medical-bar").getByRole("button", { name: "Xoá phiếu" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Xoá$/ }).click();

    await expect(outpatientCards(page)).toHaveCount(cardCount - 1);
  });

  test("the cover form draws the ministry sheet, and a tick survives a reload", async ({ page }) => {
    await openMedicalRecord(page);

    const before = await cardsUnder(page, "Bìa hồ sơ bệnh án").count();
    await page
      .locator(".pd-medical-form", { hasText: "Bìa hồ sơ bệnh án" })
      .getByRole("button", { name: "Thêm" })
      .click();
    await expect(cardsUnder(page, "Bìa hồ sơ bệnh án")).toHaveCount(before + 1);

    // Two sides: the cover, then the two control tables and the signatures.
    await expect(page.locator(".pd-a4-cover .bd-a4-page")).toHaveCount(2);
    await expect(page.getByText("SỞ Y TẾ THÀNH PHỐ HỒ CHÍ MINH")).toBeVisible();
    await expect(
      page.getByText("Thành phần và thứ tự sắp xếp các mẫu giấy, phiếu trong hồ sơ bệnh án"),
    ).toBeVisible();
    await expect(
      page.getByText("Phần kiểm soát của đơn vị nhận và lưu trữ hồ sơ bệnh án"),
    ).toBeVisible();
    // Eight numbered content rows, and the twenty tick boxes the reference
    // draws: two for the sex, fifteen down the control table, three on the
    // outcome lines.
    await expect(page.locator(".pd-cover-table").first().locator("tbody tr")).toHaveCount(8);
    await expect(page.locator(".bd-a4-checkbox")).toHaveCount(20);

    // The patient's identity is seeded from their record but stays editable,
    // as the reference leaves it — so the name cell already carries a value.
    await expect(page.locator(".pd-cover-identity")).toContainText("HỌ VÀ TÊN (In hoa)");
    await expect(page.locator('.pd-cover-identity input[aria-label="fullName"]')).not.toHaveValue(
      "",
    );

    const tick = page.locator(".pd-cover-tick .bd-a4-checkbox").first();
    await tick.check();
    const saved = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/patient-medical-records") &&
        res.request().method() === "PUT",
    );
    await page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" }).click();
    expect((await saved).ok()).toBeTruthy();

    await page.reload();
    await cardsUnder(page, "Bìa hồ sơ bệnh án").last().click();
    await expect(page.locator(".pd-cover-tick .bd-a4-checkbox").first()).toBeChecked();
  });

  test("the consultation form is print-only, so there is nothing to save", async ({ page }) => {
    await openMedicalRecord(page);

    await page
      .locator(".pd-medical-form", { hasText: "Phiếu Tư Vấn Tổng Quát" })
      .getByRole("button", { name: "Thêm" })
      .click();

    const sheet = page.locator(".pd-a4-consult");
    await expect(sheet.getByText("PHIẾU TƯ VẤN", { exact: true })).toBeVisible();
    await expect(sheet.getByText("NỘI DUNG TIẾP XÚC - TƯ VẤN – GIẢI THÍCH")).toBeVisible();

    // The reference's sheet carries no input at all — it is filled in by hand
    // after printing — so Lưu has nothing to write and stays disabled.
    await expect(sheet.locator("input, textarea")).toHaveCount(0);
    await expect(page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" })).toBeDisabled();
  });

  test("a sheet can be renamed from its card", async ({ page }) => {
    const renamed = `E2E doi ten ${runId()}`;

    await openMedicalRecord(page);
    const before = await cardsUnder(page, "Phiếu chăm sóc").count();
    await page
      .locator(".pd-medical-form", { hasText: "Phiếu chăm sóc" })
      .getByRole("button", { name: "Thêm" })
      .click();
    // Wait for the new card, or the rename lands on the previous last one.
    await expect(cardsUnder(page, "Phiếu chăm sóc")).toHaveCount(before + 1);

    const card = cardsUnder(page, "Phiếu chăm sóc").last();
    await card.getByRole("button", { name: "Đổi tên phiếu" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tên phiếu").fill(renamed);
    await dialog.getByRole("button", { name: "Lưu" }).click();

    await expect(cardsUnder(page, "Phiếu chăm sóc").last()).toContainText(renamed);

    await page.reload();
    await expect(cardsUnder(page, "Phiếu chăm sóc").last()).toContainText(renamed);
  });

  test("renaming a sheet keeps what is written on it", async ({ page }) => {
    const note = `E2E giu noi dung ${runId()}`;

    await openMedicalRecord(page);
    const before = await cardsUnder(page, "Bệnh án chỉnh nha").count();
    await page
      .locator(".pd-medical-form", { hasText: "Bệnh án chỉnh nha" })
      .getByRole("button", { name: "Thêm" })
      .click();
    await expect(cardsUnder(page, "Bệnh án chỉnh nha")).toHaveCount(before + 1);

    // Write on it and save.
    await page.locator(".pd-a4-free-body").last().fill(note);
    await page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã lưu phiếu bệnh án")).toBeVisible();

    // Rename it. The rename sends only the title, and the sheet's content used
    // to be wiped by that — the update filled unconditionally.
    const card = cardsUnder(page, "Bệnh án chỉnh nha").last();
    await card.getByRole("button", { name: "Đổi tên phiếu" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tên phiếu").fill(`${note} (đổi tên)`);
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await cardsUnder(page, "Bệnh án chỉnh nha").last().click();
    await expect(page.locator(".pd-a4-free-body").last()).toHaveValue(note);
  });
});
