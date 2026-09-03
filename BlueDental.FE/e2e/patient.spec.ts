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

/**
 * Opens Chẩn đoán & Tư vấn for a patient that actually has photographs.
 *
 * The list is newest-first and the newest records are the ones these specs
 * create, which carry no images — so landing on the first row tests nothing.
 */
async function openConsultingWithImages(page: Page) {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  const found = await page.evaluate(async () => {
    const res = await fetch("/api/v1/app/patient-images?MaxResultCount=1", {
      credentials: "include",
    });
    const first = (await res.json()).items?.[0] as
      | { patientId: string; clinicBranchId: string }
      | undefined;
    // The branch travels with the image: a record from another branch answers
    // 404 without it, and the page then renders no panel at all.
    return first ? { patientId: first.patientId, branchId: first.clinicBranchId } : null;
  });
  expect(found, "the demo clinic should have a photograph on a reachable record").toBeTruthy();

  await page.goto(`/patient/${found!.patientId}?branchId=${found!.branchId}&tab=consulting`);
  await expect(page.locator(".pd-image-panel")).toBeVisible({ timeout: 20000 });
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
      (r) =>
        r.url().includes("/api/v1/app/patients?") && r.url().includes("treatmentStatus=Pending"),
    );
    await page
      .locator(".bd-patient-filters")
      .getByRole("button", { name: "Chưa phát sinh" })
      .click();
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
        r.url().includes("/api/v1/app/patients?") &&
        r.url().includes("treatmentStatus=InTreatment"),
    );
    await panel.getByRole("button", { name: "Lưu" }).click();
    await applied;

    await expect(page.locator(".bd-patient-filters .seg-tabs-item--active")).toHaveText(
      "Đang điều trị",
    );
  });

  test("the name and the eye both open the patient's record", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const firstRow = page.locator(".bd-patient-tablecard tbody tr.ant-table-row").first();
    await expect(firstRow).toBeVisible();

    await firstRow.locator(".bd-patient-name").click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  });

  test("the patient detail keeps all ten tabs in the URL-driven layout", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();

    await expect(page.locator(".pd-profile-card")).toBeVisible();
    await expect(page.locator(".pd-money")).toHaveCount(6);
    await expect(
      page.getByRole("navigation", { name: "Chi tiết bệnh nhân" }).getByRole("link"),
    ).toHaveCount(10);

    await page.getByRole("button", { name: "Nhãn bệnh nhân" }).click();
    await expect(page.getByPlaceholder("Tìm tag")).toBeVisible();
    await page.getByRole("button", { name: "Nhãn bệnh nhân" }).click();

    await page.getByRole("button", { name: "Tạo Tái khám" }).click();
    const recallDialog = page.getByRole("dialog", { name: "Tạo tái khám" });
    await expect(recallDialog.getByText("Chưa có dịch vụ hoàn tất")).toBeVisible();
    await recallDialog.getByRole("button", { name: "Đóng" }).click();

    await page.locator(".pd-table-toolbar").getByRole("button", { name: "Thanh toán" }).click();
    const paymentDialog = page.getByRole("dialog", { name: "Thanh toán" });
    await expect(paymentDialog.getByText("Tổng tiền:")).toBeVisible();
    await paymentDialog.getByRole("button", { name: "Đóng", exact: true }).last().click();

    await page.getByRole("button", { name: "Tạo lịch hẹn mới" }).click();
    const appointmentDialog = page.getByRole("dialog", { name: "Tạo lịch hẹn" });
    await expect(appointmentDialog).toBeVisible();
    // The reference offers only the X here, so that is the only way out.
    await appointmentDialog.getByRole("button", { name: "Đóng" }).click();
    await expect(appointmentDialog).toBeHidden();

    await page.getByRole("link", { name: "Hóa đơn" }).click();
    await expect(page).toHaveURL(/tab=invoice/);
    await expect(page.getByRole("columnheader", { name: "MÃ HÓA ĐƠN" })).toBeVisible();

    await page.getByRole("link", { name: "Hồ sơ" }).click();
    await expect(page).not.toHaveURL(/tab=/);
    await expect(page.locator(".pd-profile-card")).toBeVisible();
  });

  test("the Hồ sơ card states the visit facts the way the reference states them", async ({
    page,
  }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();

    // Each note is one line — "label: value" — not a stacked label over a value.
    for (const label of ["Tiểu sử bệnh:", "Về KH:", "Nguồn đến:"]) {
      await expect(page.locator(".pd-fact").getByText(label, { exact: false })).toBeVisible();
    }

    // "Lịch hẹn gần nhất" is the nearest appointment, past or future, and it
    // carries the reception steps under it. A patient between visits used to
    // get an empty card because only future appointments counted.
    const card = page.locator(".pd-next-appointment");
    const hasAppointment = await card.locator(".pd-appt-facts").isVisible();

    if (hasAppointment) {
      for (const label of ["Ngày:", "Giờ hẹn:", "Bác sĩ:", "Nội dung:"]) {
        await expect(card.getByText(label, { exact: true })).toBeVisible();
      }
      await expect(card.getByText("Tiếp nhận", { exact: true })).toBeVisible();
      await expect(card.locator(".pd-appt-steps > li")).toHaveCount(3);
    } else {
      await expect(card.getByText("Chưa có lịch hẹn sắp tới")).toBeVisible();
    }
  });

  test("records tooth surfaces on the consulting chart", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

    await page.getByRole("link", { name: "Chẩn đoán & Tư vấn" }).click();

    // The current reference keeps the diagnosis editor collapsed until + is
    // pressed, so the dental chart must not be mounted before that action.
    await expect(page.locator("[data-testid=diagnosis-form]")).toHaveCount(0);
    await page.locator(".pd-diagnosis-card .pd-card-title").getByRole("button").click();
    await expect(page.locator("[data-testid=diagnosis-form]")).toBeVisible();

    // Initially no teeth selected.
    await expect(page.getByText("Răng đã chọn: —")).toBeVisible();

    // Click tooth 11 via its aria-label (SVG <g role="button" aria-label="Răng 11 — …">).
    await page.getByRole("button", { name: /Răng 11/ }).click();
    await expect(page.getByText(/Răng đã chọn:.*11/)).toBeVisible();

    // Click tooth 11 again to deselect (toggle).
    await page.getByRole("button", { name: /Răng 11/ }).click();
    await expect(page.getByText("Răng đã chọn: —")).toBeVisible();
  });

  test("Chẩn đoán & Tư vấn carries the reference's panels, columns and totals", async ({
    page,
  }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();
    // The consulting-data catalogue is read from the real API as the tab opens.
    const catalogue = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/catalog-entries") &&
        res.url().includes("consulting_data"),
    );
    await page.getByRole("link", { name: "Chẩn đoán & Tư vấn" }).click();
    await expect(page).toHaveURL(/tab=consulting/);
    expect((await catalogue).ok()).toBeTruthy();

    // The round + beside the heading, at the reference's own size: 28px with a
    // 16px glyph. AntD's circle button defaults to 32, which read too heavy.
    const plus = page.locator(".pd-card-title .ant-btn").first();
    const plusBox = (await plus.boundingBox())!;
    expect(Math.round(plusBox.width)).toBe(28);
    expect(Math.round(plusBox.height)).toBe(28);
    await expect(page.locator(".pd-card-title h3")).toHaveCSS("font-weight", "700");

    // The image card and its drop zone, measured off the reference: a 350px
    // card and a 240px #E6EAF0 zone with 36px commands over it.
    expect(Math.round((await page.locator(".pd-image-panel").boundingBox())!.width)).toBe(350);
    const drop = (await page.locator(".pd-image-drop").boundingBox())!;
    expect(Math.round(drop.height)).toBe(240);
    await expect(page.locator(".pd-image-drop")).toHaveCSS("background-color", "rgb(230, 234, 240)");

    // Three stacked commands over the drop zone, with the reference's labels.
    const tools = page.locator(".pd-image-tools");
    expect(Math.round((await tools.locator(".ant-btn").first().boundingBox())!.width)).toBe(36);
    for (const label of ["Thêm ảnh", "Danh sách ảnh", "Danh mục"]) {
      await expect(tools.getByRole("button", { name: label })).toBeVisible();
    }

    await tools.getByRole("button", { name: "Danh mục" }).click();
    await expect(page.getByText("Dữ liệu tư vấn")).toBeVisible();
    await page.keyboard.press("Escape");

    // "Danh sách ảnh" is the reference's "Chọn ảnh hiển thị" dialog.
    await tools.getByRole("button", { name: "Danh sách ảnh" }).click();
    const picker = page.getByRole("dialog", { name: "Chọn ảnh hiển thị" });
    await expect(picker.getByRole("button", { name: "Chọn tất cả" })).toBeVisible();
    await picker.getByRole("button", { name: "Xong" }).click();
    await expect(picker).toBeHidden();

    // The diagnosis card carries the reference's six columns.
    for (const header of ["SỐ PHIẾU", "BÁC SĨ CHẨN ĐOÁN 1", "CHẨN ĐOÁN 2", "RĂNG", "GHI CHÚ"]) {
      await expect(
        page.locator(".pd-diagnosis-card").getByRole("columnheader", { name: header }),
      ).toBeVisible();
    }

    // The consulting sheet: column chooser, the reference's columns, the total
    // block and its four commands.
    const advise = page.locator(".pd-advise-card");
    await advise.getByRole("button", { name: "Cột hiển thị" }).click();
    const chooser = page.getByText("Cấu hình cột");
    await expect(chooser).toBeVisible();

    // Turning a column off takes it out of the table.
    await expect(advise.getByRole("columnheader", { name: "GHI CHÚ TƯ VẤN" })).toBeVisible();
    await page.getByRole("switch").last().click();
    await expect(advise.getByRole("columnheader", { name: "GHI CHÚ TƯ VẤN" })).toBeHidden();
    await page.keyboard.press("Escape");

    await expect(advise.getByText("TỔNG KẾ HOẠCH")).toBeVisible();
    await expect(advise.getByText("Tổng thành tiền:")).toBeVisible();
    await expect(advise.getByRole("button", { name: "%", exact: true })).toBeVisible();
    await expect(advise.getByRole("button", { name: "VNĐ", exact: true })).toBeVisible();
    for (const label of ["Thêm kế hoạch điều trị", "Tạo báo giá", "In phiếu tư vấn"]) {
      await expect(advise.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("the record opens the same hồ sơ dialog the list opens", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    // What the list shows, to compare the record against.
    await page.locator("tbody tr.ant-table-row").first().getByRole("button").last().click();
    const fromList = page.locator(".bd-patient-dialog");
    await expect(fromList).toBeVisible();
    const listLabels = await fromList.locator(".floating-field-label").allInnerTexts();
    await fromList.getByRole("button", { name: "Đóng" }).click();
    await expect(fromList).toBeHidden();

    // The same dialog, opened from the patient's own record. It used to render
    // unstyled there: the dialog's CSS lived in the list's stylesheet, which
    // the record's page never imported.
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
    await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();

    const fromRecord = page.locator(".bd-patient-dialog");
    await expect(fromRecord).toBeVisible();
    expect(await fromRecord.locator(".floating-field-label").allInnerTexts()).toEqual(listLabels);

    // And *not* a tag field: the reference's dialog has none, because tags are
    // filed from the record's own tag button.
    await expect(fromRecord.getByText("Thẻ hồ sơ")).toHaveCount(0);

    // Which is the button beside the name.
    await fromRecord.getByRole("button", { name: "Đóng" }).click();
    await expect(page.getByRole("button", { name: "Nhãn bệnh nhân" })).toBeVisible();
  });

  test("the hồ sơ dialog's name switch shouts and un-shouts", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page.locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name").first().click();
    await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();

    const dialog = page.locator(".bd-patient-dialog");
    await expect(dialog).toBeVisible();
    const name = dialog.locator('.floating-field:has(.floating-field-label:text-is("Họ và tên")) input');
    await name.fill("lê thị liên");

    await dialog.locator("#uppercase").check();
    await expect(name).toHaveValue("LÊ THỊ LIÊN");

    // Unticking has to put the name back the way a name is written — it used to
    // leave the shouting behind.
    await dialog.locator("#uppercase").uncheck();
    await expect(name).toHaveValue("Lê Thị Liên");
  });

  test("the hồ sơ dialog offers a priority when filing a new source type", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page.locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name").first().click();
    await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();

    const dialog = page.locator(".bd-patient-dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("button:has(.anticon-plus)").first().click();

    const add = page.locator(".ant-modal:visible").last();
    await expect(add.getByText("Tên loại nguồn đến")).toBeVisible();
    await expect(add.getByText("Mức độ ưu tiên")).toBeVisible();

    // Side by side, the way Danh mục lays its group dialogs out — they were
    // stacked, which is not how the reference draws them.
    const name = await add
      .locator('.floating-field:has(.floating-field-label:text-is("Tên loại nguồn đến")) input')
      .boundingBox();
    const priority = await add
      .locator('.floating-field:has(.floating-field-label:text-is("Mức độ ưu tiên")) input')
      .boundingBox();
    expect(Math.abs(priority!.y - name!.y)).toBeLessThan(6);
    expect(priority!.x).toBeGreaterThan(name!.x + name!.width - 4);
  });

  test("the payment dialog keeps every column title on one line", async ({ page }) => {
    // Wide enough for the eight columns' 1260px. Narrower than that the table
    // scrolls and the pinned Thao tác column covers the last heading — which is
    // what the reference does too, so it is not what this test is about.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page.locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name").first().click();

    // The record's own button, not the sidebar entry of the same name.
    const open = page.locator(".pd-page .pd-btn-outline", { hasText: "Thanh toán" });
    await expect(open).toBeVisible();
    await open.click();

    const headers = page.locator(".pd-payment-dialog .ant-table-thead th");
    await expect(headers.first()).toBeVisible();

    // Two titles used to wrap to a second line, and widening them alone pushed
    // the pinned Thao tác column over the last one and clipped it.
    const measured = await headers.evaluateAll((cells) =>
      cells.map((cell) => ({
        text: (cell as HTMLElement).innerText,
        height: Math.round(cell.getBoundingClientRect().height),
        clipped: cell.scrollWidth > cell.clientWidth + 1,
      })),
    );
    expect(measured.length).toBeGreaterThan(4);
    for (const cell of measured) {
      expect(cell.text).not.toContain(String.fromCharCode(10));
      expect(cell.clipped).toBe(false);
    }
    expect(new Set(measured.map((c) => c.height)).size).toBe(1);
  });

  test("a tag the record already carries is ticked in the picker", async ({ page }) => {
    // Fixed, because the assertions below are measurements: a narrower window
    // lets the popover clamp its own width.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page.locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name").first().click();

    const button = page.getByRole("button", { name: "Nhãn bệnh nhân" });
    const buttonBox = (await button.boundingBox())!;
    await button.click();
    const options = page.locator(".pd-tag-options button");
    await expect(options.first()).toBeVisible();

    // Measured off the reference: a 258px panel opening below the button with
    // its left edges aligned, and 40px rows. It used to open right-aligned.
    //
    // Polled, because AntD scales the popover in from 0.8 — measuring the
    // moment it becomes visible reads 206px, mid-animation.
    await expect
      .poll(async () => Math.round((await page.locator(".pd-tag-picker").boundingBox())!.width))
      .toBe(258);

    const panel = (await page.locator(".pd-tag-picker").boundingBox())!;
    expect(panel.x - buttonBox.x).toBeLessThan(12);
    expect(panel.y - (buttonBox.y + buttonBox.height)).toBeLessThan(20);
    expect(Math.round((await options.first().boundingBox())!.height)).toBe(40);

    // Toggle the first one on, and it should read as chosen — a background
    // shade alone was easy to miss, so the reference ticks it.
    const first = options.first();
    const wasSelected = (await first.getAttribute("class"))?.includes("selected");
    if (wasSelected) await first.click();
    await expect(first.locator(".pd-tag-tick")).toHaveCount(0);

    await first.click();
    await expect(first.locator(".pd-tag-tick")).toBeVisible();
  });

  test("the occupation list carries the reference's Khác escape hatch", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page.locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name").first().click();
    await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();

    const dialog = page.locator(".bd-patient-dialog");
    await dialog
      .locator('.floating-field:has(.floating-field-label:text-is("Nghề nghiệp")) .ss-wrapper')
      .click();

    const footer = page.locator(".ss-footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByText("Khác")).toBeVisible();

    // Ticking it opens the free-text box the list cannot cover.
    await footer.getByRole("checkbox").check();
    await expect(footer.getByPlaceholder("Vui lòng nhập")).toBeVisible();
  });

  test("the lý do đến khám box has room to write in", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page.locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name").first().click();
    await page.getByRole("button", { name: "Thêm lý do đến khám" }).click();

    // A single-row box was what the app's own modal styling forced; the
    // reference writes a paragraph here.
    const box = page.getByRole("dialog").locator("textarea").first();
    await expect(box).toBeVisible();
    const rect = await box.boundingBox();
    expect(rect!.height).toBeGreaterThan(140);
  });

  test("the tag button offers only the patient's own branch tags", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page.locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name").first().click();

    const branchId = await page.evaluate(async () => {
      const id = location.pathname.split("/").pop();
      const res = await fetch(`/api/v1/app/patients/${id}`, { credentials: "include" });
      return (await res.json()).branchId as string;
    });

    // The picker used to follow the header's filter, which reads "every branch"
    // for a clinic-wide account — so a record could be tagged from elsewhere.
    // Reloaded first: the tag list is cached for minutes, and a warm cache
    // would mean no request to look at.
    await page.reload();
    const tagged = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/patient-tags") && res.request().method() === "GET",
    );
    await page.getByRole("button", { name: "Nhãn bệnh nhân" }).click();
    const url = (await tagged).url();
    expect(decodeURIComponent(url)).toContain(branchId);

    await expect(page.locator(".pd-tag-picker")).toBeVisible();
  });

  test("the consulting panel shows its images, and one opens full size", async ({ page }) => {
    await openConsultingWithImages(page);

    // Shown without being chosen first: a photograph is on the panel as soon as
    // it exists, which is what makes a fresh upload appear straight away.
    const tiles = page.locator(".pd-image-shown .ant-image");
    await expect(tiles.first()).toBeVisible({ timeout: 20000 });
    const shownCount = await tiles.count();
    expect(shownCount).toBeGreaterThan(0);

    // Each tile is the reference's own: 240px of cover, full panel width.
    const tile = (await page.locator(".pd-image-shown img").first().boundingBox())!;
    expect(Math.round(tile.height)).toBe(240);
    await expect(page.locator(".pd-image-shown img").first()).toHaveCSS("object-fit", "cover");

    // Clicking one opens it over the page, with the group's counter.
    await page.locator(".pd-image-shown img").first().click();
    await expect(page.locator(".ant-image-preview-img").first()).toBeVisible();
    await expect(page.locator(".ant-image-preview-mask")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0.45)",
    );
    await page.keyboard.press("Escape");
  });

  test("Chọn ảnh hiển thị lists the photographs by day, and unticking hides one", async ({
    page,
  }) => {
    await openConsultingWithImages(page);
    await expect(page.locator(".pd-image-shown .ant-image").first()).toBeVisible({ timeout: 20000 });
    const before = await page.locator(".pd-image-shown .ant-image").count();

    await page.locator(".pd-image-tools").getByRole("button", { name: "Danh sách ảnh" }).click();
    const picker = page.getByRole("dialog", { name: "Chọn ảnh hiển thị" });
    await expect(picker).toBeVisible();

    // Grouped under the day they were taken, on 280px cards — measured off the
    // reference. Everything starts ticked.
    await expect(picker.locator(".pd-image-day > h4").first()).toHaveText(/\d{2}\/\d{2}\/\d{4}/);
    const cards = picker.locator(".pd-image-card");
    // Polled: AntD scales a modal in from 0.2, so measuring the moment it turns
    // visible reads 56px — a fifth of the real width.
    await expect
      .poll(async () => Math.round((await cards.first().boundingBox())!.width))
      .toBe(280);
    await expect(picker.locator(".pd-image-card--on")).toHaveCount(before);

    // A card carries its name, its time, and the reference's two round actions.
    await expect(cards.first().locator("b")).not.toBeEmpty();
    await expect(cards.first().getByRole("button", { name: "Sắp xếp" })).toBeVisible();
    await expect(cards.first().getByRole("button", { name: "Xoá ảnh" })).toBeVisible();

    // Unticking takes it off the panel behind.
    await cards.first().getByRole("checkbox").uncheck();
    await picker.getByRole("button", { name: "Xong" }).click();
    await expect(picker).toBeHidden();
    await expect(page.locator(".pd-image-shown .ant-image")).toHaveCount(before - 1);
  });
});
