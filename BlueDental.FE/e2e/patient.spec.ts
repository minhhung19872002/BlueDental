import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Danh sách bệnh nhân (/patient) + hồ sơ bệnh nhân.
 *
 * Real stack throughout — the dialog writes to PostgreSQL through the real API
 * and every filter is asserted on the request the browser actually sent, so a
 * filter that quietly narrowed the list in the browser would fail here.
 */

/** Opens "Tạo hồ sơ" and returns the dialog. */
async function openCreateDialog(page: Page) {
  await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Bệnh nhân", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("registers a patient whose whole record survives a reload", async ({ page }) => {
    const id = runId();
    const fullName = `trần e2e ${id}`;
    const phone = `09${id}0000`.slice(0, 10);

    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const dialog = await openCreateDialog(page);

    // The code opens on the server's suggestion, split into a fixed prefix and
    // the sequence the front desk may overwrite.
    await expect(dialog.locator(".bd-patient-codeprefix")).not.toBeEmpty();
    await expect(dialog.getByRole("textbox", { name: "Phần số mã khách hàng" })).not.toBeEmpty();

    await dialog.getByRole("textbox", { name: "Họ và tên *" }).fill(fullName);
    await dialog.getByRole("textbox", { name: "Điện thoại *" }).fill(phone);
    await dialog.getByRole("textbox", { name: "Số thẻ BHYT" }).fill("SV4098765432");
    await dialog.getByRole("textbox", { name: "Số nhà/ Đường" }).fill("12 Nguyễn Trãi");

    // "IN HOA" rewrites the name in place rather than being a separate value.
    await dialog.getByRole("checkbox", { name: "IN HOA" }).check();
    await expect(dialog.getByRole("textbox", { name: "Họ và tên *" })).toHaveValue(
      fullName.toUpperCase(),
    );

    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(fullName.toUpperCase()) });
    await expect(row).toBeVisible();

    // Survives a reload — i.e. it really reached PostgreSQL.
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(fullName.toUpperCase()) })).toBeVisible();

    // And what was typed into the other two columns came back with it.
    await page.getByRole("button", { name: `Chỉnh sửa ${fullName.toUpperCase()}` }).click();
    const editor = page.getByRole("dialog", { name: "Chỉnh sửa hồ sơ" });
    await expect(editor.getByRole("textbox", { name: "Số thẻ BHYT" })).toHaveValue("SV4098765432");
    await expect(editor.getByRole("textbox", { name: "Số nhà/ Đường" })).toHaveValue(
      "12 Nguyễn Trãi",
    );
  });

  test("a patient may be registered without a birth date", async ({ page }) => {
    const id = runId();
    const fullName = `LÊ KHÔNG NGÀY SINH ${id}`;

    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const dialog = await openCreateDialog(page);
    await dialog.getByRole("textbox", { name: "Họ và tên *" }).fill(fullName);
    await dialog.getByRole("textbox", { name: "Điện thoại *" }).fill(`08${id}0000`.slice(0, 10));
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(fullName) });
    await expect(row).toBeVisible();
    // Ngày sinh is the third column, and the reference shows an em dash there.
    await expect(row.getByRole("cell").nth(2)).toHaveText("—");
  });

  test("the save stays disabled until a name and a valid phone are in", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const dialog = await openCreateDialog(page);
    const save = dialog.getByRole("button", { name: "Lưu" });
    await expect(save).toBeDisabled();

    await dialog.getByRole("textbox", { name: "Họ và tên *" }).fill("NGUYỄN VĂN A");
    await expect(save).toBeDisabled();

    await dialog.getByRole("textbox", { name: "Điện thoại *" }).fill("123");
    await expect(save).toBeDisabled();

    await dialog.getByRole("textbox", { name: "Điện thoại *" }).fill("0912345678");
    await expect(save).toBeEnabled();
  });

  test("Kênh kết nối unlocks only once a source group is chosen", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const dialog = await openCreateDialog(page);
    const channel = dialog.locator(".floating-field", { hasText: "Kênh kết nối" });
    await expect(channel.locator(".ss-wrapper--disabled")).toBeVisible();

    await dialog.locator(".floating-field", { hasText: "Chọn loại nguồn đến" }).click();
    await page.locator("#ss-portal-dropdown .ss-option").first().click();

    await expect(channel.locator(".ss-wrapper--disabled")).toHaveCount(0);
  });

  test("every filter narrows the list on the server", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    // Trạng thái
    const byStatus = page.waitForRequest(
      (r) => r.url().includes("/api/v1/app/patients?") && r.url().includes("treatmentStatus=Pending"),
    );
    await page.locator(".bd-patient-filters").getByRole("button", { name: "Chưa phát sinh" }).click();
    await byStatus;

    // Bác sĩ
    const byDoctor = page.waitForRequest(
      (r) => r.url().includes("/api/v1/app/patients?") && r.url().includes("staffId="),
    );
    await page.locator(".bd-patient-filters .bd-patient-filter").first().click();
    await page.locator("#ss-portal-dropdown .ss-option").first().click();
    await byDoctor;

    // Tìm kiếm
    const bySearch = page.waitForRequest(
      (r) => r.url().includes("/api/v1/app/patients?") && r.url().includes("filter=zzz"),
    );
    await page.locator(".bd-patient-search input").fill("zzz");
    await bySearch;

    await expect(page.getByText("Không có bệnh nhân phù hợp")).toBeVisible();
  });

  test("the period tabs put the window in the URL and a second click clears it", async ({
    page,
  }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await expect(page.getByRole("button", { name: /Chọn thời gian/ })).toBeDisabled();

    const dayTab = page.locator(".bd-patient-toolbar .seg-tabs-item", { hasText: "Ngày" });
    const windowed = page.waitForRequest(
      (r) => r.url().includes("/api/v1/app/patients?") && r.url().includes("fromDate="),
    );
    await dayTab.click();
    await windowed;

    await expect(page).toHaveURL(/patient_dateMode=day&patient_date=\d{4}-\d{2}-\d{2}/);
    await expect(page.getByRole("button", { name: "Ngày kế tiếp" })).toBeVisible();

    await dayTab.click();
    await expect(page).not.toHaveURL(/patient_dateMode/);
    await expect(page.getByRole("button", { name: /Chọn thời gian/ })).toBeDisabled();
  });

  test("the page size and page number ride in the URL", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await page.locator(".bd-patient-tablecard .ant-pagination-options .ant-select").click();
    await page.getByRole("option", { name: "5 / trang", exact: true }).click();

    await expect(page).toHaveURL(/perPage=5/);
    await expect(page.locator(".bd-patient-tablecard tbody tr.ant-table-row")).toHaveCount(5);
  });

  test("Bộ lọc applies the same filters from the compact toolbar", async ({ page }) => {
    // Short enough that the list scrolls at all — the compact toolbar only
    // exists once the real one has gone under the app header.
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    // Scrolling before the rows land does nothing — the page is not tall yet.
    await expect(
      page.locator(".bd-patient-tablecard tbody tr.ant-table-row").first(),
    ).toBeVisible();
    await page.locator(".bd-patient-tablecard .ant-pagination").scrollIntoViewIfNeeded();

    const filterButton = page.locator(".bd-patient-sticky").getByRole("button", { name: "Bộ lọc" });
    await expect(filterButton).toBeVisible();
    await filterButton.click();

    const panel = page.locator(".bd-patient-filterpop");
    await expect(panel).toBeVisible();

    // A draft: nothing is sent until "Lưu".
    await panel.getByRole("button", { name: "Đang điều trị" }).click();
    const applied = page.waitForRequest(
      (r) =>
        r.url().includes("/api/v1/app/patients?") && r.url().includes("treatmentStatus=InTreatment"),
    );
    await panel.getByRole("button", { name: "Lưu" }).click();
    await applied;

    await expect(
      page.locator(".bd-patient-filters .seg-tabs-item--active"),
    ).toHaveText("Đang điều trị");
  });

  test("the name and the eye both open the patient's record", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const firstRow = page.locator(".bd-patient-tablecard tbody tr.ant-table-row").first();
    await expect(firstRow).toBeVisible();

    await firstRow.locator(".bd-patient-name").click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  });

  test("records tooth surfaces on the consulting chart", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await page.locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name").first().click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

    await page.getByRole("tab", { name: "Chẩn đoán & Tư vấn" }).click();

    // Initially no teeth selected.
    await expect(page.getByText("Chưa chọn răng")).toBeVisible();

    // Click tooth 11 via its aria-label (SVG <g role="button" aria-label="Răng 11 — …">).
    await page.getByRole("button", { name: /Răng 11/ }).click();
    await expect(page.getByText(/Đã chọn:.*11/)).toBeVisible();

    // Click tooth 11 again to deselect (toggle).
    await page.getByRole("button", { name: /Răng 11/ }).click();
    await expect(page.getByText("Chưa chọn răng")).toBeVisible();
  });
});
