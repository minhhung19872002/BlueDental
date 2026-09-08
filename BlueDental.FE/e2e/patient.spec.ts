import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Danh sách bệnh nhân (/patient) + hồ sơ bệnh nhân.
 *
 * Real stack throughout — the dialog writes to PostgreSQL through the real API
 * and every filter is asserted on the request the browser actually sent, so a
 * filter that quietly narrowed the list in the browser would fail here.
 */

/** Opens an AntD select and takes its first option from the portal it renders into. */
async function pickFirstOption(page: Page, combobox: Locator): Promise<void> {
  await combobox.click();
  const option = page
    .locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden)")
    .last()
    .locator(".ant-select-item-option")
    .first();
  await expect(option).toBeVisible();
  await option.click();
}

/**
 * The tag names drawn beside the patient's name.
 *
 * Trimmed and compared whole rather than by substring: a chip carries its icon
 * before the label, and "Chỉnh Nha" is contained in "Tư Vấn Chỉnh Nha".
 */
async function chipLabels(chips: Locator): Promise<string[]> {
  return (await chips.allInnerTexts()).map((text) => text.trim());
}

/**
 * What the dialog's ticked services still owe, added up.
 *
 * Follows the ticks rather than the first row: a slip may carry several lines
 * and the dialog opens with only the clicked one chosen.
 */
async function lineDue(dialog: Locator): Promise<number> {
  const rows = dialog.locator(".pd-newpay-lines > li");
  let due = 0;
  for (const row of await rows.all()) {
    if (!(await row.locator("input[type=checkbox]").isChecked())) continue;
    const text = await row.locator(".pd-newpay-due").innerText();
    due += Number(text.replace(/[^\d]/g, ""));
  }
  return due;
}

/**
 * Opens a record that actually has a treatment line.
 *
 * The list is newest-first and the records these specs create carry no
 * treatment, so landing on the first row leaves the table empty. `owing` picks
 * a slip that still has money on it — these specs collect as they go, so the
 * first slip is not reliably unpaid by the time a later one runs.
 */
type LineMode = "any" | "owing" | "stageable" | "warrantable";

async function openPatientWithTreatment(page: Page, owing: boolean | LineMode = false) {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  const mode: LineMode = owing === true ? "owing" : owing === false ? "any" : owing;
  const found = await page.evaluate(async (want) => {
    const res = await fetch("/api/v1/app/patient-treatments?maxResultCount=50", {
      credentials: "include",
    });
    const items = (await res.json()).items as {
      id: string;
      patientId: string;
      services: {
        id: string;
        outstandingAmount: number;
        status: number;
        warrantyDays: number;
      }[];
    }[];
    for (const slip of items) {
      const line =
        want === "owing"
          ? slip.services.find((service) => service.outstandingAmount > 0)
          : want === "stageable"
            ? // 1 = Created, 2 = InProgress: the only statuses the reference
              // offers a công đoạn on.
              slip.services.find((service) => service.status === 1 || service.status === 2)
            : want === "warrantable"
              ? slip.services.find((service) => service.warrantyDays > 0)
              : slip.services[0];
      if (line) return { patientId: slip.patientId, serviceId: line.id, planId: slip.id };
    }
    return null;
  }, mode);
  expect(found, "the demo clinic should have a slip with a service line").toBeTruthy();

  await page.goto(`/patient/${found!.patientId}`);
  await expect(page.locator(".pd-treatment-table tbody tr.ant-table-row").first()).toBeVisible({
    timeout: 20000,
  });
  return found!;
}

/**
 * The treatment row for one service line.
 *
 * Addressed by the table's row key — the service's own id — because these specs
 * collect as they go and the row that still owes is not reliably the first.
 */
function treatmentRow(page: Page, serviceId: string): Locator {
  // A row is one công đoạn, so a line with several owns several rows and its
  // key is prefixed with the line's id.
  return page.locator(`.pd-treatment-table tbody tr[data-row-key^="${serviceId}"]`).first();
}

/** Opens the treatment table's row for a line, once the table has settled. */
async function openStageDialog(page: Page, serviceId: string) {
  await expect(page.locator(".pd-treatment-table tbody tr.ant-table-row").first()).toBeVisible({
    timeout: 20000,
  });
  await page.locator(".pd-treatment-table .ant-table-content").evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await page
    .locator(`.pd-treatment-table tbody tr[data-row-key^="${serviceId}"]:has(.pd-tr-addstage)`)
    .first()
    .locator(".pd-tr-addstage")
    .click();

  const dialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Ticks Hoàn thành on the dialog's live công đoạn and waits for the server.
 *
 * The box is controlled by what came back, not by the click, so Playwright's
 * own `check()` — which insists the state flip before it returns — reports a
 * failure on a perfectly good tick.
 */
async function finishLiveStage(page: Page, dialog: Locator) {
  const live = dialog.locator('.pd-stage-histrow[aria-disabled="false"]').first();
  await expect(live).toBeVisible();

  const box = live.getByRole("checkbox");
  if (await box.isChecked()) return live;

  const done = page.waitForResponse(
    (res) =>
      res.url().includes("/api/v1/app/treatment-stages/") &&
      res.url().endsWith("/complete") &&
      res.request().method() === "POST",
  );
  await box.click({ force: true });
  expect((await done).ok()).toBeTruthy();
  return live;
}

/**
 * Adds a công đoạn to a service line through the real API, so a spec that needs
 * two of them on one line does not have to drive the dialog twice.
 */
async function addStage(
  page: Page,
  line: { patientId: string; planId: string; serviceId: string },
  note: string,
) {
  const status = await page.evaluate(
    async ({ target, text }) => {
      const branchId = new URLSearchParams(location.search).get("branchId");
      const plan = await (
        await fetch(`/api/v1/app/patient-treatments/${target.planId}`, { credentials: "include" })
      ).json();
      const service = plan.services.find((item: { id: string }) => item.id === target.serviceId);
      const staff = await (
        await fetch("/api/v1/app/staff?MaxResultCount=1", { credentials: "include" })
      ).json();

      const res = await fetch("/api/v1/app/treatment-stages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: target.patientId,
          clinicBranchId: branchId,
          treatmentId: target.planId,
          treatmentServiceId: target.serviceId,
          serviceId: service.serviceId,
          name: service.serviceName ?? service.code,
          note: text,
          staffId: staff.items[0].id,
          teeth: service.teeth,
        }),
      });
      return res.status;
    },
    { target: line, text: note },
  );
  expect(status, "the công đoạn should have been created").toBe(200);
}

/**
 * The slip's money, service by service, in the plan's own order.
 *
 * Keyed by service id rather than read off the receipt's rows: PostgreSQL
 * returns a receipt's lines unordered, and the claim under test is which
 * service got which share, not what order they came back in.
 */
async function paidByService(page: Page, planId: string) {
  return page.evaluate(async (id) => {
    const patientId = location.pathname.split("/").pop();
    const branchId = new URLSearchParams(location.search).get("branchId");
    const res = await fetch(
      `/api/v1/app/patient-payments/account?patientId=${patientId}&clinicBranchId=${branchId}`,
      { credentials: "include" },
    );
    const account = await res.json();
    const plan = account.plans.find((p: { id: string }) => p.id === id);
    const receipts = account.payments.filter(
      (p: { treatmentPlanId: string }) => p.treatmentPlanId === id,
    );
    const lines = new Map<string, number>(
      (receipts[0]?.lines ?? []).map((l: { treatmentServiceId: string; amount: number }) => [
        l.treatmentServiceId,
        l.amount,
      ]),
    );
    return {
      receiptCount: receipts.length as number,
      lineAmounts: (plan.services as { id: string }[]).map((s) => lines.get(s.id) ?? 0),
      paid: (plan.services as { paidAmount: number }[]).map((s) => s.paidAmount),
    };
  }, planId);
}

/** Reads a live figure until it stops changing. */
async function settled(read: () => Promise<number>): Promise<number> {
  let last = await read();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const next = await read();
    if (next === last) return next;
    last = next;
  }
  return last;
}

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
      { patientId: string; clinicBranchId: string } | undefined;
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
    await expect(page.locator(".pd-money")).toHaveCount(7);
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

    // Initially no teeth selected: the "Răng đã chọn" box carries its empty line.
    const selected = page.getByTestId("selected-teeth");
    await expect(selected.getByText("Chưa chọn răng")).toBeVisible();

    // Clicking a tooth takes the whole tooth; a surface names itself the way
    // the chart does, and the chip's red X puts the tooth back.
    await page.getByRole("button", { name: "Răng 11", exact: true }).click();
    await expect(selected.locator(".pd-tooth-chip")).toHaveText(["11"]);

    const tooth16 = page.getByRole("group", { name: "Mặt răng 16" });
    await tooth16.getByRole("button", { name: "Mặt ngoài" }).click();
    await tooth16.getByRole("button", { name: "Mặt nhai" }).click();
    await expect(selected.locator(".pd-tooth-chip")).toHaveText(["11", "16 - Mặt ngoài, Mặt nhai"]);

    await selected.getByRole("button", { name: "Bỏ chọn răng 11" }).click();
    await expect(selected.locator(".pd-tooth-chip")).toHaveText(["16 - Mặt ngoài, Mặt nhai"]);

    // Clicking the tooth itself clears it, surfaces and all.
    await page.getByRole("button", { name: "Răng 16", exact: true }).click();
    await expect(selected.getByText("Chưa chọn răng")).toBeVisible();
  });

  test("Lưu Chẩn Đoán files a slip with the picked teeth and it survives a reload", async ({
    page,
  }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();
    await page.getByRole("link", { name: "Chẩn đoán & Tư vấn" }).click();
    await page.locator(".pd-diagnosis-card .pd-card-title").getByRole("button").click();
    const form = page.getByTestId("diagnosis-form");
    await expect(form).toBeVisible();

    // Nothing is saveable until a doctor, a diagnosis and a tooth are all in.
    const save = form.getByRole("button", { name: "Lưu Chẩn Đoán" });
    await expect(save).toBeDisabled();

    // The doctor and the diagnosis are the reference's search comboboxes; the
    // option list renders into a portal, so it is addressed from the page.
    await pickFirstOption(page, form.getByRole("combobox", { name: "Bác sĩ chẩn đoán 1" }));
    await pickFirstOption(page, form.locator(".pd-diagnosis-side").getByRole("combobox").first());
    await expect(save).toBeDisabled();

    await page.getByRole("button", { name: "Răng 18", exact: true }).click();
    const tooth16 = page.getByRole("group", { name: "Mặt răng 16" });
    await tooth16.getByRole("button", { name: "Mặt ngoài" }).click();
    await tooth16.getByRole("button", { name: "Mặt nhai" }).click();
    await expect(save).toBeEnabled();

    // The real POST, then the row the real GET brings back, teeth worded as
    // the reference words them.
    const created = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" && res.url().includes("/api/v1/app/patient-diagnoses"),
    );
    await save.click();
    expect((await created).ok()).toBeTruthy();
    await expect(form).toBeHidden();

    const rows = page.locator(".pd-diagnosis-card tbody tr.ant-table-row");
    await expect(rows.first()).toContainText("18, 16 - Mặt ngoài, Mặt nhai");
    const code = (await rows.first().locator("td").first().innerText()).trim();
    expect(code).toMatch(/^CD\d{2}-\d{4}$/);

    await page.reload();
    await expect(page).toHaveURL(/tab=consulting/);
    const row = page.locator(".pd-diagnosis-card tbody tr.ant-table-row", { hasText: code });
    await expect(row).toContainText("18, 16 - Mặt ngoài, Mặt nhai");
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
        res.url().includes("/api/v1/app/catalog-entries") && res.url().includes("consulting_data"),
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
    // Once the patient has photographs the zone gives way to them, so the
    // 240px #E6EAF0 zone is only there while the panel is empty.
    await page.waitForLoadState("networkidle");
    if ((await page.locator(".pd-image-tile").count()) === 0) {
      const drop = (await page.locator(".pd-image-drop").boundingBox())!;
      expect(Math.round(drop.height)).toBe(240);
      await expect(page.locator(".pd-image-drop")).toHaveCSS(
        "background-color",
        "rgb(230, 234, 240)",
      );
    } else {
      await expect(page.locator(".pd-image-drop")).toHaveCount(0);
    }

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
    await expect(advise.getByText("Tổng tiền:")).toBeVisible();

    // The voucher line as staging draws it: the tag button drops a search
    // popover with the empty state, and the line beside it says none applies.
    await expect(advise.getByText("Chưa có voucher nào cho kế hoạch điều trị.")).toBeVisible();
    await advise.getByRole("button", { name: "Chọn voucher" }).click();
    await expect(page.getByRole("textbox", { name: "Tìm voucher" })).toHaveAttribute(
      "placeholder",
      "Tìm voucher theo mã hoặc tên...",
    );
    await expect(page.getByText("Đã chọn: 0")).toBeVisible();
    // A code no voucher carries leaves the bordered box on its empty sentence.
    await page.getByRole("textbox", { name: "Tìm voucher" }).fill("KHONG-CO-MA-NAY");
    await expect(
      page.getByText("Không có voucher nào khả dụng cho kế hoạch điều trị."),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // The four commands: the doctor, the two plan buttons, the printer.
    await expect(advise.getByRole("combobox", { name: "Chọn bác sĩ điều trị" })).toBeVisible();
    for (const label of ["Thêm kế hoạch điều trị", "Tạo báo giá", "In phiếu tư vấn"]) {
      await expect(advise.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("the plan total counts only the ticked rows and a plan voucher comes off it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    // A record with a consulting line, and a live "Tổng kế hoạch" voucher that
    // line qualifies for — made through the real API when the clinic has none.
    const setup = await page.evaluate(async (stamp) => {
      const send = (url: string, init?: RequestInit) =>
        fetch(url, { credentials: "include", ...init });
      const advise = (await (await send("/api/v1/app/patient-advises?maxResultCount=1")).json())
        .items?.[0] as
        | { id: string; patientId: string; clinicBranchId: string; effectiveAmount: number }
        | undefined;
      if (!advise) return null;

      const available = (await (
        await send(`/api/v1/app/vouchers/available?orderAmount=${advise.effectiveAmount}`)
      ).json()) as {
        code: string;
        scopeTarget: string;
        discountType: string;
        discountValue: number;
        maxDiscountAmount: number | null;
        isExclusive: boolean;
      }[];
      let voucher = available.find(
        (item) =>
          item.scopeTarget === "treatment" &&
          item.discountType === "percentage" &&
          !item.isExclusive,
      );
      if (!voucher) {
        const today = new Date();
        const created = (await (
          await send("/api/v1/app/vouchers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: `E2EKH${stamp}`,
              name: `Voucher kế hoạch ${stamp}`,
              discountType: "percentage",
              discountValue: 10,
              scopeTarget: "treatment",
              targetIds: [],
              startDate: new Date(today.getTime() - 86400000).toISOString(),
              endDate: new Date(today.getTime() + 30 * 86400000).toISOString(),
              usageLimit: 100,
              isExclusive: false,
              customerTargets: ["new", "returning"],
              isDaysOfWeekLimited: false,
              daysOfWeek: [],
              displayOnNfcDental: true,
            }),
          })
        ).json()) as { id: string; code: string };
        await send(`/api/v1/app/vouchers/${created.id}/publish`, { method: "POST" });
        voucher = {
          code: created.code,
          scopeTarget: "treatment",
          discountType: "percentage",
          discountValue: 10,
          maxDiscountAmount: null,
          isExclusive: false,
        };
      }
      return { advise, voucher };
    }, runId());
    expect(setup, "the demo clinic should have a consulting line").toBeTruthy();
    const { advise: line, voucher } = setup!;

    await page.goto(`/patient/${line.patientId}?branchId=${line.clinicBranchId}&tab=consulting`);
    const advise = page.locator(".pd-advise-card");
    const row = advise.locator(`tr[data-row-key="${line.id}"]`);
    await expect(row).toBeVisible({ timeout: 20000 });
    const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;
    const gross = advise.locator(".pd-plan-total > p").first();
    const net = advise.locator(".pd-plan-net");

    // Untouched, the plan is worth nothing: staging sums only what is ticked.
    await expect(gross).toContainText("Tổng thành tiền: 0 đ");
    await expect(net).toContainText("Tổng tiền: 0 đ");

    await row.getByRole("checkbox").check();
    await expect(gross).toContainText(`Tổng thành tiền: ${money(line.effectiveAmount)}`);
    await expect(net).toContainText(`Tổng tiền: ${money(line.effectiveAmount)}`);

    // The voucher popover now lists the live plan voucher; picking it takes
    // its discount off the net total and names it beside the button.
    await advise.getByRole("button", { name: "Chọn voucher" }).click();
    await page.getByRole("textbox", { name: "Tìm voucher" }).fill(voucher.code);
    const option = page.getByRole("button", { name: new RegExp(voucher.code) });
    await expect(option).toBeVisible();
    await option.click();
    await expect(page.getByText("Đã chọn: 1")).toBeVisible();
    await page.keyboard.press("Escape");

    let discount = (line.effectiveAmount * voucher.discountValue) / 100;
    if (voucher.maxDiscountAmount !== null)
      discount = Math.min(discount, voucher.maxDiscountAmount);
    // Outside, the button now counts the picks and the italic line is gone.
    await expect(advise.getByRole("button", { name: "Voucher (1)" })).toBeVisible();
    await expect(advise.locator(".pd-plan-voucher > em")).toHaveCount(0);
    await expect(gross).toContainText(`Tổng thành tiền: ${money(line.effectiveAmount)}`);
    await expect(net).toContainText(`Tổng tiền: ${money(line.effectiveAmount - discount)}`);

    // Unticking the row empties the order: nothing left to discount, while a
    // voucher with no minimum order stays picked for the next tick.
    await row.getByRole("checkbox").uncheck();
    await expect(gross).toContainText("Tổng thành tiền: 0 đ");
    await expect(net).toContainText("Tổng tiền: 0 đ");
    await expect(advise.getByRole("button", { name: "Voucher (1)" })).toBeVisible();
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
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();
    await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();

    const dialog = page.locator(".bd-patient-dialog");
    await expect(dialog).toBeVisible();
    const name = dialog.locator(
      '.floating-field:has(.floating-field-label:text-is("Họ và tên")) input',
    );
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
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();
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
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();

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
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();

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
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();
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
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();
    await page.getByRole("button", { name: "Thêm lý do đến khám" }).click();

    // A single-row box was what the app's own modal styling forced; the
    // reference writes a paragraph here.
    //
    // Polled: AntD zooms the modal in, and measuring the moment the box turns
    // visible reads a collapsed 36px mid-animation.
    const box = page.getByRole("dialog").locator("textarea").first();
    await expect(box).toBeVisible();
    await expect
      .poll(async () => Math.round((await box.boundingBox())!.height))
      .toBeGreaterThan(140);
  });

  test("adding a lý do đến khám keeps the earlier ones, dated, across a reload", async ({
    page,
  }) => {
    const first = `e2e lý do A ${runId()}`;
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();
    await expect(page.locator(".pd-profile-card")).toBeVisible();

    const rows = page.locator(".pd-reason");
    const before = await rows.count();

    await page.getByRole("button", { name: "Thêm lý do đến khám" }).click();
    await page.getByRole("dialog").locator("textarea").first().fill(first);
    await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click();
    await expect(rows).toHaveCount(before + 1);

    // A second one appends rather than replacing: the reference keeps the whole
    // history, which is what the dates on the card are for.
    const second = `e2e lý do B ${runId()}`;
    await page.getByRole("button", { name: "Thêm lý do đến khám" }).click();
    const box = page.getByRole("dialog").locator("textarea").first();
    // The box opens empty even though the record now has reasons.
    await expect(box).toHaveValue("");
    await box.fill(second);
    await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click();
    await expect(rows).toHaveCount(before + 2);

    // Newest first, each on its own line: dd/MM/yyyy in an 88px column, then
    // the reason itself.
    await expect(rows.first().locator(".pd-reason-date")).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/);
    await expect(rows.first().locator(".pd-reason-text")).toHaveText(second);
    await expect(rows.nth(1).locator(".pd-reason-text")).toHaveText(first);
    // 85px — the reference's 88px scaled to this column's type, which runs a
    // notch smaller here than the reference's does.
    expect(Math.round((await rows.first().locator(".pd-reason-date").boundingBox())!.width)).toBe(
      85,
    );
    await expect(rows.first().locator(".pd-reason-text")).toHaveCSS("font-size", "13.5px");

    // Written through the real API to PostgreSQL, so a reload finds them still
    // there — a client-side list would vanish here.
    await page.reload();
    await expect(rows.first().locator(".pd-reason-text")).toHaveText(second);
    await expect(rows.nth(1).locator(".pd-reason-text")).toHaveText(first);
  });

  test("a tag put on the record shows beside the name and survives a reload", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();
    await expect(page.locator(".pd-profile-card")).toBeVisible();

    await page.getByRole("button", { name: "Nhãn bệnh nhân" }).click();
    const option = page.locator(".pd-tag-options button").first();
    await expect(option).toBeVisible();
    const label = (await option.locator("em").innerText()).trim();

    // Start from "not on this record", whichever way the seed left it.
    if ((await option.getAttribute("class"))?.includes("selected")) {
      await option.click();
      await expect(option.locator(".pd-tag-tick")).toHaveCount(0);
    }
    const chips = page.locator(".pd-profile-name .pd-tag-chip");
    await expect.poll(() => chipLabels(chips)).not.toContain(label);

    await option.click();
    // Ticked in the picker and drawn beside the name, both at once.
    await expect(option.locator(".pd-tag-tick")).toBeVisible();
    await expect.poll(() => chipLabels(chips)).toContain(label);

    await page.reload();
    await expect.poll(() => chipLabels(chips)).toContain(label);
  });

  test("the treatment table is laid out the way the reference lays it out", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openPatientWithTreatment(page);

    // Ten columns, in the reference's order and its own sentence case — the
    // app's other tables wear uppercase 11.5px headers; this one opts out.
    const headers = page.locator(".pd-treatment-table .ant-table-thead th");
    await expect(headers).toHaveText([
      "Ngày",
      "Dịch vụ",
      "Nội dung điều trị",
      "Răng",
      "SL",
      "Bác sĩ điều trị",
      "Bác sĩ hỗ trợ",
      "Công đoạn",
      "Chăm sóc sau điều trị",
      "Thao tác",
    ]);
    await expect(headers.first()).toHaveCSS("text-transform", "none");
    await expect(headers.first()).toHaveCSS("font-size", "14px");

    // The DT… code is a link into the slip; the service name beside it is not.
    const row = page.locator(".pd-treatment-table tbody tr.ant-table-row").first();
    await expect(row.locator(".pd-tr-code")).not.toBeEmpty();
    await expect(row.locator(".pd-tr-chip")).toBeVisible();
    await expect(row.locator(".pd-tr-sub")).toContainText("Phụ tá");
    await expect(row.locator(".pd-tr-care")).toBeVisible();
    await expect(row.getByRole("button", { name: "Tạo phiếu thanh toán" })).toBeVisible();
  });

  test("a row's Thao tác collects money and moves that line's Còn nợ", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const { serviceId } = await openPatientWithTreatment(page, true);

    const row = treatmentRow(page, serviceId);
    await row.getByRole("button", { name: "Tạo phiếu thanh toán" }).click();

    const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
    await expect(dialog).toBeVisible();
    // The clicked row opens ticked, and the dialog carries the reference's
    // two split modes and its payment methods.
    await expect(dialog.locator(".pd-newpay-lines > li input:checked")).toHaveCount(1);
    await expect(dialog.getByText("Chia Tiền Tự Động")).toBeVisible();
    await expect(dialog.getByText("Chia Tiền Thủ Công")).toBeVisible();
    await expect(dialog.locator(".pd-newpay-methods button")).toHaveCount(5);

    const dueBefore = await lineDue(dialog);
    expect(dueBefore).toBeGreaterThan(0);
    const paid = Math.min(100_000, dueBefore);

    // Nothing chosen is refused with the reference's own wording.
    const ticked = dialog
      .locator(".pd-newpay-lines > li")
      .filter({ has: page.locator("input:checked") });
    await ticked.locator("input[type=checkbox]").uncheck();
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog.locator(".pd-newpay-error")).toHaveText("Bạn cần chọn ít nhất 1 dịch vụ");
    await dialog.locator(".pd-newpay-lines > li input[type=checkbox]").first().check();

    const collected = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/patient-payments") && res.request().method() === "POST",
    );
    await dialog.locator(".pd-newpay-amount").fill(String(paid));
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await collected).ok()).toBeTruthy();
    await expect(dialog).toBeHidden();

    // Written through the real API: the line owes that much less, still after a
    // reload. The money row's Đã thu moved by the same amount.
    await page.reload();
    await treatmentRow(page, serviceId)
      .getByRole("button", { name: "Tạo phiếu thanh toán" })
      .click();
    const reopened = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
    await expect(reopened).toBeVisible();
    await expect.poll(() => lineDue(reopened)).toBe(dueBefore - paid);
  });

  test("the payment dialog carries the reference's fields, momo included", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const { serviceId } = await openPatientWithTreatment(page, true);
    await treatmentRow(page, serviceId)
      .getByRole("button", { name: "Tạo phiếu thanh toán" })
      .click();

    const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
    await expect(dialog).toBeVisible();

    // The five section headings, in the reference's order. Their case comes
    // from CSS there too, so the DOM text stays sentence case.
    await expect(dialog.locator(".pd-newpay-head")).toHaveText([
      /Nội dung thanh toán/,
      /Dịch vụ/,
      /Tổng tiền theo kế hoạch/,
      /Thông tin thanh toán/,
      /Phương thức thanh toán/,
    ]);
    await expect(dialog.locator(".pd-newpay-head").first()).toHaveCSS(
      "text-transform",
      "uppercase",
    );

    // Five payment methods — the reference offers a wallet the four-way rollup
    // never showed, so the enum carries it too.
    await expect(dialog.locator(".pd-newpay-methods button")).toHaveText([
      "Tiền mặt",
      "Ngân hàng",
      "Ví momo",
      "Quẹt thẻ",
      /^Dư nợ/,
    ]);
    await expect(dialog.locator(".pd-newpay-methods button").first()).toHaveClass(/active/);

    // The plan block, in the reference's wording and order.
    await expect(dialog.locator(".pd-newpay-fact > span:first-child")).toHaveText([
      "Nội dung",
      "Ngày thanh toán",
      "Tổng tiền",
      "Giảm giá",
      "Tổng tiền sau giảm",
      "Đã thanh toán",
      "Còn lại",
    ]);

    // "Còn lại" is a live preview: it drops by whatever is being entered.
    const remaining = () =>
      dialog
        .locator(".pd-newpay-fact")
        .last()
        .locator("span")
        .last()
        .innerText()
        .then((text) => Number(text.replace(/[^\d]/g, "")));
    // Tự động opens with the whole of what the chosen lines owe already in the
    // box, the way the reference prefills it.
    const box = dialog.locator("input.pd-newpay-amount");
    const prefill = Number((await box.inputValue()).replace(/\D/g, ""));
    expect(prefill).toBe(await lineDue(dialog));

    // Measured as a delta between two typed amounts rather than against the
    // opening figure: the plan's Còn lại floors at zero, and a slip whose lines
    // owe more than the plan still does would sit on that floor.
    await box.fill("100000");
    const atHundred = await settled(remaining);
    await box.fill("50000");
    await expect.poll(remaining).toBe(atHundred + 50_000);

    // Thủ công swaps the single box for one per chosen service, each offering
    // what that line still owes.
    await dialog.getByText("Chia Tiền Thủ Công").click();
    const chosenCount = await dialog.locator(".pd-newpay-lines > li input:checked").count();
    const perLine = dialog.locator(".pd-newpay-manual input");
    await expect(perLine).toHaveCount(chosenCount);
    await expect(perLine.first()).not.toHaveValue("");

    // Tìm dịch vụ is a toggle, not a permanent box.
    await expect(dialog.locator(".pd-newpay-searchbox")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Tìm dịch vụ" }).click();
    await expect(dialog.locator(".pd-newpay-searchbox")).toBeVisible();
  });

  test("one receipt covers several services, split by the server", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    // A slip with two lines still owing. The demo clinic seeds one line per
    // slip, so build one the way the app does: accept two consulting lines and
    // open a plan from them.
    const slip = await page.evaluate(async () => {
      const send = (url: string, init?: RequestInit) =>
        fetch(url, { credentials: "include", ...init });

      const owing = await (await send("/api/v1/app/patient-treatments?maxResultCount=50")).json();
      const ready = (
        owing.items as {
          id: string;
          patientId: string;
          services: { outstandingAmount: number }[];
        }[]
      ).find((plan) => plan.services.filter((line) => line.outstandingAmount > 0).length >= 2);
      if (ready) return { planId: ready.id, patientId: ready.patientId };

      const advises = (await (await send("/api/v1/app/patient-advises?maxResultCount=200")).json())
        .items as { id: string; patientId: string; treatmentPlanId: string | null }[];
      const free = advises.filter((a) => !a.treatmentPlanId);
      const patientId = free.find(
        (a) => free.filter((b) => b.patientId === a.patientId).length >= 2,
      )?.patientId;
      if (!patientId) return null;

      const pair = free
        .filter((a) => a.patientId === patientId)
        .slice(0, 2)
        .map((a) => a.id);
      for (const id of pair) {
        await send(`/api/v1/app/patient-advises/${id}/accept`, { method: "POST" });
      }
      const branchId = new URLSearchParams(location.search).get("branchId");
      const dentistId = (await (await send("/api/v1/app/staff?MaxResultCount=1")).json()).items[0]
        .id;

      const opened = await send("/api/v1/app/patient-treatments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          clinicBranchId: branchId,
          dentistId,
          title: "E2E một phiếu nhiều dịch vụ",
          discountType: 1,
          discountValue: 0,
          adviseIds: pair,
        }),
      });
      if (!opened.ok) return null;
      return { planId: (await opened.json()).id as string, patientId };
    });
    expect(slip, "a slip with two unpaid lines").toBeTruthy();

    await page.goto(`/patient/${slip!.patientId}`);
    const table = page.locator(".pd-treatment-table tbody tr.ant-table-row");
    await expect(table.first()).toBeVisible({ timeout: 20000 });

    // Open the dialog on that slip and take every service on it.
    const owingLine = await page.evaluate(async (planId) => {
      const patientId = location.pathname.split("/").pop();
      const branchId = new URLSearchParams(location.search).get("branchId");
      const res = await fetch(
        `/api/v1/app/patient-payments/account?patientId=${patientId}&clinicBranchId=${branchId}`,
        { credentials: "include" },
      );
      const account = await res.json();
      const plan = account.plans.find((entry: { id: string }) => entry.id === planId);
      const line = (
        plan?.services as { id: string; outstandingAmount: number }[] | undefined
      )?.find((service) => service.outstandingAmount > 0);
      return line?.id ?? null;
    }, slip!.planId);
    expect(owingLine, "the picked slip should still owe money").toBeTruthy();
    await treatmentRow(page, owingLine!)
      .getByRole("button", { name: "Tạo phiếu thanh toán" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
    await expect(dialog).toBeVisible();
    await dialog.locator(".pd-newpay-head--split input[type=checkbox]").check();

    const lines = dialog.locator(".pd-newpay-lines > li");
    const count = await lines.count();
    test.skip(count < 2, "this slip has only one line still owing");

    const before = await paidByService(page, slip!.planId);
    const dues = await dialog
      .locator(".pd-newpay-due")
      .allInnerTexts()
      .then((texts) => texts.map((x) => Number(x.replace(/[^\d]/g, ""))));
    // Pay the first line off and part of the second, so the split is visible.
    const paying = dues[0] + Math.floor(dues[1] / 2);

    const posted = page.waitForRequest(
      (req) => req.url().includes("/api/v1/app/patient-payments") && req.method() === "POST",
    );
    await dialog.locator("input.pd-newpay-amount").fill(String(paying));
    await dialog.getByRole("button", { name: "Lưu" }).click();

    // One request, naming every service — not one request per service.
    const body = JSON.parse((await posted).postData() ?? "{}");
    expect(body.treatmentServiceIds).toHaveLength(count);
    expect(body.amount).toBe(paying);
    expect(body.splitMode).toBe(1);
    expect(body.items, "auto leaves the split to the server").toBeFalsy();
    await expect(dialog).toBeHidden();

    // The server spread it oldest-first, capped per line, and it persisted.
    const after = await paidByService(page, slip!.planId);

    expect(after.receiptCount, "one receipt, not one per service").toBe(1);
    // Line one paid off, the rest of the money on line two.
    const share = [dues[0], paying - dues[0]];
    expect(after.lineAmounts.slice(0, 2)).toEqual(share);
    expect(after.paid.slice(0, 2)).toEqual([before.paid[0] + share[0], before.paid[1] + share[1]]);
  });

  test("Ngân hàng and Ví momo make the clinic's account a required pick", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const { serviceId } = await openPatientWithTreatment(page, true);
    await treatmentRow(page, serviceId)
      .getByRole("button", { name: "Tạo phiếu thanh toán" })
      .click();

    const dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
    await expect(dialog).toBeVisible();
    // Cash needs no account at all.
    await expect(dialog.locator(".pd-newpay-accounts")).toHaveCount(0);

    // Ngân hàng lists bank accounts by name and number.
    await dialog.locator(".pd-newpay-methods button", { hasText: "Ngân hàng" }).click();
    await expect(dialog.locator(".pd-newpay-acchead span")).toHaveText([
      "Chọn",
      "Tên ngân hàng",
      "Số tài khoản",
    ]);
    // Polled: the account list is fetched when the method is picked.
    await expect(
      dialog.locator(".pd-newpay-accrow").first(),
      "the demo clinic should have a bank account",
    ).toBeVisible();

    // Ví momo swaps the columns for the wallet's own.
    await dialog.locator(".pd-newpay-methods button", { hasText: "Ví momo" }).click();
    await expect(dialog.locator(".pd-newpay-acchead span")).toHaveText([
      "Chọn",
      "Số điện thoại",
      "Tên chủ tài khoản",
    ]);

    // Saving without one is refused; the reference will not post it either.
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeVisible();

    // With an account picked the payment goes through carrying it.
    const posted = page.waitForRequest(
      (req) => req.url().includes("/api/v1/app/patient-payments") && req.method() === "POST",
    );
    await dialog.locator(".pd-newpay-accrow").first().click();
    await dialog.locator("input.pd-newpay-amount").fill("10000");
    await dialog.getByRole("button", { name: "Lưu" }).click();

    const body = JSON.parse((await posted).postData() ?? "{}");
    // 5 = PaymentMethodKind.EWallet, the reference's "momo".
    expect(body.method).toBe(5);
    expect(body.paymentAccountId, "an e-wallet payment names the wallet").toBeTruthy();
    await expect(dialog).toBeHidden();
  });

  test("the Công đoạn cell opens Chi tiết phiếu and a stage is added there", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const { serviceId } = await openPatientWithTreatment(page, "stageable");

    const row = treatmentRow(page, serviceId);
    // The pinned Thao tác column sits over this cell until the table is scrolled.
    await page.locator(".pd-treatment-table .ant-table-content").evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await row.getByRole("button", { name: /Thêm công đoạn|Chi tiết phiếu/ }).click();

    const dialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await expect(dialog).toBeVisible();

    // Two tabs with their counts, the reference's two commands, four column
    // heads and the treatment history under them.
    await expect(dialog.locator(".pd-stage-tabs button")).toHaveCount(2);
    await expect(dialog.getByRole("button", { name: "Thanh toán" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "In lịch sử điều trị" })).toBeVisible();
    await expect(dialog.locator(".pd-stage-colhead")).toHaveText([
      "Chi tiết",
      "Ngày - Nhân sự",
      "Dịch vụ đã chọn",
      "Nội dung điều trị",
    ]);
    await expect(dialog.locator(".pd-stage-histhead > div")).toHaveText([
      "Ngày",
      "Dịch vụ & răng",
      "Ghi chú",
      "Công đoạn",
      "Hành động",
    ]);

    const historyBefore = await dialog.locator(".pd-stage-histrow").count();

    // Ngày tạo and Dịch vụ are read-outs, as the reference disables them.
    await dialog.locator(".pd-stage-picks button").first().click();
    const form = dialog.locator(".pd-stage-form");
    await expect(form.locator("input[disabled]")).toHaveCount(2);

    const note = `e2e công đoạn ${runId()}`;
    const created = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/treatment-stages") && res.request().method() === "POST",
    );
    await form.locator("textarea").fill(note);
    await dialog.getByRole("button", { name: /Thêm công đoạn|Tiếp tục công đoạn/ }).click();
    expect((await created).ok()).toBeTruthy();

    // The history grows and the row behind it picks the note up as its
    // "Nội dung điều trị" — the reference's column 3 is the stage's note.
    await expect(dialog.locator(".pd-stage-histrow")).toHaveCount(historyBefore + 1);
    await expect(dialog.locator(".pd-stage-note").filter({ hasText: note })).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(row.locator("td").nth(2)).toHaveText(new RegExp(note));
  });

  test("the stage form fills its columns, as the reference's does", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const { serviceId } = await openPatientWithTreatment(page, "stageable");

    const dialog = await openStageDialog(page, serviceId);
    await dialog.locator(".pd-stage-picks button").first().click();
    const form = dialog.locator(".pd-stage-form");
    await expect(form).toBeVisible();

    // Three columns at 1600, and every control the full width of its own — the
    // reference measures 366px for all of them at this viewport.
    const columns = await form.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(columns.split(" ")).toHaveLength(3);

    const widths = await form.evaluate((el) => {
      const column = el.children[0] as HTMLElement;
      const inner = column.getBoundingClientRect().width;
      const fields = [...column.querySelectorAll(".floating-field")] as HTMLElement[];
      return { inner, fields: fields.map((f) => Math.round(f.getBoundingClientRect().width)) };
    });
    expect(widths.fields).toHaveLength(4);
    for (const width of widths.fields) {
      expect(Math.abs(width - Math.round(widths.inner))).toBeLessThanOrEqual(1);
    }

    // Tải Ảnh is live before the công đoạn exists — the reference keeps a file
    // input inside the form card, not only on a saved row.
    await expect(form.getByRole("button", { name: "Tải Ảnh" })).toBeEnabled();
    // And the note carries no asterisk there.
    await expect(form.locator(".floating-field-label").last()).toHaveText("Nội dung điều trị");
  });

  test("a history row's pencil rewrites the note in place", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const { serviceId } = await openPatientWithTreatment(page, "stageable");

    const dialog = await openStageDialog(page, serviceId);
    const rows = dialog.locator(".pd-stage-histrow");
    if ((await rows.count()) === 0) {
      // Nothing to edit yet — add one so the spec always exercises the pencil.
      await dialog.locator(".pd-stage-picks button").first().click();
      await dialog.locator(".pd-stage-form textarea").fill(`e2e ${runId()}`);
      await dialog.getByRole("button", { name: /Thêm công đoạn|Tiếp tục công đoạn/ }).click();
      await expect(rows).not.toHaveCount(0);
    }

    // The day cell spans its stages, so the date reads d/M/yyyy once per day.
    await expect(dialog.locator(".pd-stage-histdate b").first()).toHaveText(
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    );

    const edited = `e2e ghi chú ${runId()}`;
    const first = rows.first();
    await first.getByRole("button", { name: "Sửa ghi chú" }).click();

    const saved = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/app/treatment-stages") && res.request().method() === "PUT",
    );
    await first.locator(".pd-stage-noteedit textarea").fill(edited);
    await first.getByRole("button", { name: "Lưu" }).click();
    expect((await saved).ok()).toBeTruthy();

    await expect(first.locator(".pd-stage-note")).toHaveText(edited);

    // Written through the real API: still there after a reload.
    await page.reload();
    await page.locator(".pd-treatment-table .ant-table-content").evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await treatmentRow(page, serviceId)
      .getByRole("button", { name: /Thêm công đoạn|Chi tiết phiếu/ })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Chi tiết phiếu" }).locator(".pd-stage-note").first(),
    ).toHaveText(edited);
  });

  test("In lịch sử điều trị opens the reference's printable sheet", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const { serviceId } = await openPatientWithTreatment(page, "stageable");

    const opened = await openStageDialog(page, serviceId);
    await opened.getByRole("button", { name: "In lịch sử điều trị" }).click();

    const sheet = page.locator(".pd-print-dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator(".pd-print-facts h3")).toHaveText([
      "Thông tin chi nhánh",
      "Thông tin khách hàng",
    ]);
    // The clinic's own letterhead, read from the branch — not hard-coded.
    await expect(sheet.locator(".pd-print-facts section").first()).toContainText("Phòng khám:");
    await expect(sheet.locator(".pd-print-facts section").first()).not.toContainText("—");
    await expect(sheet.locator(".pd-print-table").first().locator("th")).toHaveText([
      "Dịch vụ",
      "Ngày điều trị",
      "Nội dung điều trị",
      "Bác sĩ",
      "Phụ tá",
      "Bác sĩ hỗ trợ",
    ]);
    await expect(sheet.getByRole("button", { name: "In Phiếu" })).toBeVisible();

    // The A4 copy carries the centred title and both signature blocks.
    await expect(sheet.locator(".pd-print-sheet h2")).toHaveText("Chi tiết phiếu");
    await expect(sheet.locator(".pd-print-signs > div > p:first-child")).toHaveText([
      "Người lập phiếu",
      "Khách hàng",
    ]);
  });

  test("Thanh toán leaves the stage dialog for the slip's own screen", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const { serviceId } = await openPatientWithTreatment(page, "stageable");

    const dialog = await openStageDialog(page, serviceId);
    await dialog.getByRole("button", { name: "Thanh toán" }).click();

    // The reference navigates rather than stacking a payment form on the dialog.
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/tab=treatment-plan/);
  });

  test("Tạo Labo opens Đặt mới filled from the công đoạn", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const { serviceId } = await openPatientWithTreatment(page, "stageable");

    const dialog = await openStageDialog(page, serviceId);
    const rows = dialog.locator(".pd-stage-histrow");
    if ((await rows.count()) === 0) {
      await dialog.locator(".pd-stage-picks button").first().click();
      await dialog.locator(".pd-stage-form textarea").fill(`e2e ${runId()}`);
      await dialog.getByRole("button", { name: /Thêm công đoạn|Tiếp tục công đoạn/ }).click();
      await expect(rows).not.toHaveCount(0);
    }

    await rows.first().getByRole("button", { name: "Tạo Labo" }).click();

    const labo = page.getByRole("dialog", { name: "Đặt mới" });
    await expect(labo).toBeVisible();
    // The four facts the công đoạn already knows open filled and disabled.
    const locked = labo.locator("input[disabled]");
    await expect(locked).toHaveCount(4);
    for (const input of await locked.all()) {
      await expect(input).not.toHaveValue("");
    }
    // Số phiếu Labo comes from the server in the reference's own shape.
    // The file input behind Tải ảnh is hidden, not a form field, so it is
    // skipped when reaching for the first editable one.
    await expect(labo.locator("input:not([disabled]):not([type=file])").first()).toHaveValue(
      /^LABO-\d{8}\d+$/,
    );
    await expect(labo.getByText("Chọn dịch vụ trước")).toBeVisible();
    await expect(labo.getByRole("button", { name: "Lưu" })).toBeVisible();
  });

  test("the treatment table is one row per công đoạn, grouped by day", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const line = await openPatientWithTreatment(page, "stageable");

    const rowsFor = () =>
      page.locator(`.pd-treatment-table tbody tr[data-row-key^="${line.serviceId}"]`);
    const before = await rowsFor().count();

    // Two more công đoạn on the same line, both today.
    await addStage(page, line, `e2e nhóm A ${runId()}`);
    await addStage(page, line, `e2e nhóm B ${runId()}`);
    await page.reload();
    await expect(page.locator(".pd-treatment-table tbody tr.ant-table-row").first()).toBeVisible({
      timeout: 20000,
    });

    // Each công đoạn is its own row — the reference's timeline is stage-shaped.
    await expect(rowsFor()).toHaveCount(before + 2);

    // And the Ngày cell spans its day instead of repeating: today's rows carry
    // exactly one date cell between them.
    const spans = await page.locator(".pd-treatment-table tbody").evaluate((body) => {
      const rows = [...body.querySelectorAll("tr.ant-table-row")];
      return rows.map((tr) => {
        const first = tr.querySelector("td");
        const isDate = first?.querySelector(".pd-tr-day") !== null;
        return { isDate, rowSpan: isDate ? (first as HTMLTableCellElement).rowSpan : 0 };
      });
    });
    const dateCells = spans.filter((row) => row.isDate);
    expect(dateCells.length, "one date cell per day, not per row").toBeLessThan(spans.length);
    expect(dateCells[0].rowSpan).toBeGreaterThan(1);
    // The spans have to add up to the rows on screen, or a date would be eaten.
    expect(dateCells.reduce((sum, cell) => sum + cell.rowSpan, 0)).toBe(spans.length);
  });

  test("only a line's newest công đoạn stays workable", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const line = await openPatientWithTreatment(page, "stageable");
    await addStage(page, line, `e2e cũ ${runId()}`);
    await addStage(page, line, `e2e mới ${runId()}`);
    await page.reload();

    await page.locator(".pd-treatment-table .ant-table-content").evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await treatmentRow(page, line.serviceId)
      .getByRole("button", { name: /Thêm công đoạn|Chi tiết phiếu/ })
      .click();

    const dialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    const rows = dialog.locator(".pd-stage-histrow");
    await expect(rows).not.toHaveCount(0);

    // Exactly one row is live; the reference marks the rest aria-disabled.
    await expect(dialog.locator('.pd-stage-histrow[aria-disabled="false"]')).toHaveCount(1);
    await expect(dialog.locator('.pd-stage-histrow[aria-disabled="true"]')).not.toHaveCount(0);

    // Only that one keeps Tạo Labo, and only its Hoàn thành can be ticked.
    await expect(dialog.getByRole("button", { name: "Tạo Labo" })).toHaveCount(1);
    const stale = dialog.locator('.pd-stage-histrow[aria-disabled="true"]').first();
    await expect(stale.getByRole("checkbox")).toBeDisabled();
    await expect(stale).toHaveCSS("pointer-events", "none");
  });

  test("Đặt mới is built from the app's own fields, with the reference's blocks", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const line = await openPatientWithTreatment(page, "stageable");
    // A fresh công đoạn, so the slip has a live row: only that one offers Tạo
    // Labo, and earlier specs may have finished the ones already there.
    await addStage(page, line, `e2e labo ${runId()}`);
    await page.reload();

    const dialog = await openStageDialog(page, line.serviceId);
    const live = dialog.locator('.pd-stage-histrow[aria-disabled="false"]').first();
    await live.getByRole("button", { name: "Tạo Labo" }).click();

    const labo = page.getByRole("dialog", { name: "Đặt mới" });
    await expect(labo).toBeVisible();

    // Eleven required fields, each carrying the reference's red asterisk inside
    // its own floating label — the app's shared field wrapper, not markup
    // invented here.
    await expect(labo.locator(".floating-field-label .floating-field-required")).toHaveCount(11);
    await expect(labo.locator(".floating-field-required").first()).toHaveCSS(
      "color",
      "rgb(229, 72, 77)",
    );

    // The pickers are the app's SearchSelect, the same widget the reference uses.
    await expect(labo.locator(".ss-wrapper")).toHaveCount(4);

    // Two chip strips with the reference's own empty pills, then the teeth row.
    await expect(labo.locator(".pd-labo-strip > p")).toHaveText([/Lựa chọn dịch vụ/, /Vật liệu/]);
    await expect(labo.getByText("Chọn dịch vụ trước")).toBeVisible();
    await expect(labo.locator(".pd-labo-teeth")).toContainText("Chọn tất cả");
    await expect(labo.locator(".pd-labo-drop")).toBeVisible();

    // A floating label rests muted and only turns blue while its field has
    // focus, the way the reference draws it — not blue the moment it floats.
    const noteField = labo.locator(".pd-labo-notes .floating-field");
    const noteLabel = noteField.locator(".floating-field-label");
    await labo.locator(".pd-labo-notes textarea").fill("x");
    const resting = await noteLabel.evaluate((el) => getComputedStyle(el).color);
    await labo.locator(".pd-labo-notes textarea").focus();
    await expect(noteLabel).toHaveCSS("color", "rgb(38, 113, 216)");
    expect(resting, "a floating label rests muted, not blue").not.toBe("rgb(38, 113, 216)");

    // Tải ảnh takes several pictures and holds them as drafts, each with its
    // own remove.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAJUlEQVR42u3OMQEAAAgDoJnc6BpjDwmg2XCqAAAAAAAAAAAA4LcFvxYBAWfnQVUAAAAASUVORK5CYII=",
      "base64",
    );
    await labo.locator("input[type=file]").setInputFiles([
      { name: "labo-a.png", mimeType: "image/png", buffer: png },
      { name: "labo-b.png", mimeType: "image/png", buffer: png },
    ]);
    const drafts = labo.locator(".pd-labo-drafts > div");
    await expect(drafts).toHaveCount(2);
    await expect(drafts.first().locator("img")).toBeVisible();

    await drafts.first().getByRole("button").click();
    await expect(drafts).toHaveCount(1);
  });

  test("finishing a công đoạn swaps its action for Bảo hành, inside and out", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const line = await openPatientWithTreatment(page, "warrantable");
    await addStage(page, line, `e2e bảo hành ${runId()}`);
    await page.reload();

    const dialog = await openStageDialog(page, line.serviceId);
    const before = dialog.locator('.pd-stage-histrow[aria-disabled="false"]').first();

    // Before: the live row offers Tạo Labo and no Bảo hành.
    await expect(before.getByRole("button", { name: "Tạo Labo" })).toBeVisible();
    await expect(before.getByRole("button", { name: "Bảo hành" })).toHaveCount(0);

    const live = await finishLiveStage(page, dialog);

    // After: Tạo Labo gives way to Bảo hành on that same row.
    await expect(live.getByRole("button", { name: "Bảo hành" })).toBeVisible();
    await expect(live.getByRole("button", { name: "Tạo Labo" })).toHaveCount(0);

    // And it opens the reference's own form.
    await live.getByRole("button", { name: "Bảo hành" }).click();
    const warranty = page.getByRole("dialog", { name: "Tạo bảo hành" });
    await expect(warranty).toBeVisible();
    const footer = warranty.locator(".ant-modal-footer");
    await expect(footer.getByRole("button", { name: "Lưu bảo hành" })).toBeVisible();
    await expect(footer.getByRole("button", { name: "Đóng" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(warranty).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Outside, the row's Công đoạn cell is the Bảo hành chip, and it opens the
    // same form — the reference offers it from both places.
    await page.reload();
    await page.locator(".pd-treatment-table .ant-table-content").evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    const done = page.locator(".pd-treatment-table tbody tr .pd-tr-warranty").first();
    await expect(done).toBeVisible();
    await done.click();
    await expect(page.getByRole("dialog", { name: "Tạo bảo hành" })).toBeVisible();
  });

  test("finishing one công đoạn leaves the others open", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const line = await openPatientWithTreatment(page, "warrantable");
    await addStage(page, line, `e2e còn mở A ${runId()}`);
    await addStage(page, line, `e2e còn mở B ${runId()}`);
    await page.reload();

    const rowsFor = page.locator(`.pd-treatment-table tbody tr[data-row-key^="${line.serviceId}"]`);
    await expect(page.locator(".pd-treatment-table tbody tr.ant-table-row").first()).toBeVisible({
      timeout: 20000,
    });
    const openBefore = await rowsFor.locator(".pd-tr-addstage").count();
    expect(openBefore, "two công đoạn were just added").toBeGreaterThan(1);

    // Finish only the newest.
    const dialog = await openStageDialog(page, line.serviceId);
    const live = await finishLiveStage(page, dialog);
    await expect(live.getByRole("button", { name: "Bảo hành" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.reload();
    await page.locator(".pd-treatment-table .ant-table-content").evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });

    // Finishing one closes exactly one: every other công đoạn on the line still
    // offers "+", and it still opens Chi tiết phiếu.
    const stillOpen = rowsFor.locator(".pd-tr-addstage");
    await expect(stillOpen).toHaveCount(openBefore - 1);
    expect(openBefore - 1, "the line keeps unfinished công đoạn").toBeGreaterThan(0);
    await stillOpen.first().click();
    await expect(page.getByRole("dialog", { name: "Chi tiết phiếu" })).toBeVisible();
  });

  test("Tạo Tái khám lists the công đoạn that are finished", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const line = await openPatientWithTreatment(page, "warrantable");
    await addStage(page, line, `e2e tái khám ${runId()}`);
    await page.reload();

    const dialog = await openStageDialog(page, line.serviceId);
    await finishLiveStage(page, dialog);
    await expect(dialog.getByRole("button", { name: "Bảo hành" }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Tạo Tái khám" }).click();
    const recall = page.getByRole("dialog", { name: "Tạo tái khám" });
    await expect(recall).toBeVisible();
    await expect(recall.locator(".pd-recall-head strong")).toHaveText([
      "Ngày - Nhân sự",
      "Dịch vụ đã hoàn tất",
      "Nội dung điều trị",
    ]);

    // A finished công đoạn shows up, with the reference's two commands beside a
    // ticked, read-only Hoàn thành.
    const row = recall.locator(".pd-recall-row").first();
    await expect(row).toBeVisible();
    await expect(row.getByRole("checkbox")).toBeChecked();
    await expect(row.getByRole("checkbox")).toBeDisabled();
    await expect(row.getByRole("button", { name: "Tái Khám" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Chi Tiết" })).toBeVisible();
  });

  test("the Tiếp nhận steps advance one at a time", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const booked = await page.evaluate(async () => {
      const res = await fetch("/api/v1/app/appointments?maxResultCount=100", {
        credentials: "include",
      });
      const items = (await res.json()).items as { patientId: string; status: number }[];
      // 1 = Requested, 2 = Confirmed — everything before Đã đến, which is where
      // the card's stepper starts.
      return items.find((item) => item.status === 1 || item.status === 2)?.patientId ?? null;
    });
    test.skip(booked === null, "the demo clinic has no appointment yet to arrive");

    await page.goto(`/patient/${booked!}`);
    const steps = page.locator(".pd-appt-steps button");
    await expect(steps).toHaveCount(3);
    // The card shows the patient's *upcoming* booking, which may not be the one
    // the search found — if it has already arrived there is nothing to walk.
    test.skip(!(await steps.nth(0).isEnabled()), "that patient's next booking has already arrived");

    // Only the next step can be pressed — the reference disables the rest so a
    // reception cannot skip ahead.
    await expect(steps.nth(0)).toBeEnabled();
    await expect(steps.nth(1)).toBeDisabled();
    await expect(steps.nth(2)).toBeDisabled();

    const arrived = page.waitForResponse(
      (res) => res.url().includes("/check-in") && res.request().method() === "POST",
    );
    await steps.nth(0).click();
    expect((await arrived).ok()).toBeTruthy();

    // The step is stamped and the next one opens up, and it survives a reload.
    await expect(steps.nth(0)).toBeDisabled();
    await expect(steps.nth(1)).toBeEnabled();
    await expect(page.locator(".pd-appt-steps li").first()).toHaveClass(/reached/);
    await expect(page.locator(".pd-appt-steps li").first()).not.toContainText("--:--");

    await page.reload();
    await expect(page.locator(".pd-appt-steps li").first()).toHaveClass(/reached/);
    await expect(page.locator(".pd-appt-steps button").nth(1)).toBeEnabled();
  });

  test("a finished công đoạn on a service with no warranty offers nothing", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const line = await page.evaluate(async () => {
      const res = await fetch("/api/v1/app/patient-treatments?maxResultCount=50", {
        credentials: "include",
      });
      const items = (await res.json()).items as {
        id: string;
        patientId: string;
        services: { id: string; status: number; warrantyDays: number }[];
      }[];
      for (const slip of items) {
        const found = slip.services.find(
          (service) => service.warrantyDays === 0 && service.status !== 3,
        );
        if (found) return { patientId: slip.patientId, planId: slip.id, serviceId: found.id };
      }
      return null;
    });
    test.skip(line === null, "the demo clinic has no warranty-less service line");

    await page.goto(`/patient/${line!.patientId}`);
    await addStage(page, line!, `e2e không bảo hành ${runId()}`);
    await page.reload();

    const dialog = await openStageDialog(page, line!.serviceId);
    const live = await finishLiveStage(page, dialog);
    // No warranty period, so the finished row offers neither Tạo Labo nor Bảo hành.
    await expect(live.getByRole("button", { name: "Bảo hành" })).toHaveCount(0);
    await expect(live.getByRole("button", { name: "Tạo Labo" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(page.locator(".pd-treatment-table tbody tr.ant-table-row").first()).toBeVisible({
      timeout: 20000,
    });
    await page.locator(".pd-treatment-table .ant-table-content").evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });

    // Outside, the chip is grey and inert — the reference's "Không bảo hành".
    const row = treatmentRow(page, line!.serviceId);
    await expect(row.locator(".pd-tr-nostage")).toBeVisible();
    await expect(row.locator(".pd-tr-addstage, .pd-tr-warranty")).toHaveCount(0);
  });

  test("the Phân loại theo Tag filter lists plain rows, like Phân loại dịch vụ", async ({
    page,
  }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    await page
      .locator(
        '.bd-patient-filters .floating-field:has(.floating-field-label:text-is("Phân loại theo Tag")) .ss-wrapper',
      )
      .click();
    const options = page.locator("#ss-portal-dropdown .ss-option");
    await expect(options.first()).toBeVisible();

    // The reference's two "Phân loại" filters are the same widget down to the
    // markup — a coloured chip here was invented, and is gone.
    await expect(options.locator(".bd-tag-chip")).toHaveCount(0);
    await expect(options.first()).not.toBeEmpty();
  });

  test("the appointment card reassigns its doctor without opening the editor", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    // A record with an appointment — the picker only exists when the card has one.
    const found = await page.evaluate(async () => {
      const res = await fetch("/api/v1/app/appointments?maxResultCount=20", {
        credentials: "include",
      });
      const items = (await res.json()).items as { patientId: string; dentistId: string }[];
      return items.find((item) => item.patientId) ?? null;
    });
    expect(found, "the demo clinic should have a booked appointment").toBeTruthy();

    await page.goto(`/patient/${found!.patientId}`);
    const picker = page.locator(".pd-appt-doctor-picker");
    await expect(picker).toBeVisible();
    const before = (await picker.locator(".ss-value").innerText()).trim();

    await picker.locator(".ss-wrapper").click();
    const options = page.locator("#ss-portal-dropdown .ss-option");
    await expect(options.first()).toBeVisible();

    // Compared whole and trimmed rather than with hasNotText: the card's doctor
    // can be blank, and hasNotText("") excludes every option. Picking the row
    // that is already selected would save nothing and the PUT would never fire.
    const labels = (await options.allInnerTexts()).map((text) => text.trim());
    const index = labels.findIndex((label) => label !== before && label.length > 0);
    expect(index, "the clinic should have a second dentist to move the booking to").toBeGreaterThan(
      -1,
    );
    const other = options.nth(index);
    const chosen = labels[index];

    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/v1/app/appointments/") && res.request().method() === "PUT",
    );
    await other.click();
    expect((await saved).ok()).toBeTruthy();

    // The card's Bác sĩ line and the picker both follow, and it survives a reload.
    await expect.poll(() => picker.locator(".ss-value").innerText()).toContain(chosen);
    await page.reload();
    await expect.poll(() => picker.locator(".ss-value").innerText()).toContain(chosen);
  });

  test("the money row carries all seven totals, Tạm ứng included", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();

    const tiles = page.locator(".pd-money");
    await expect(tiles).toHaveCount(7);
    await expect(tiles.locator("small")).toHaveText([
      "Tổng dự kiến thu",
      "Đã thu",
      "Dự kiến thu còn lại",
      "Dư nợ",
      "Phải thu",
      "Đã hoàn",
      "Tạm ứng",
    ]);

    // One row at desktop width, as the reference lays them out.
    const tops = await tiles.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(1);

    // The figure comes from the server's rollup, not a placeholder.
    const prepaid = await page.evaluate(async () => {
      const id = location.pathname.split("/").pop();
      const branchId = new URLSearchParams(location.search).get("branchId");
      const res = await fetch(
        `/api/v1/app/patient-payments/account?patientId=${id}&clinicBranchId=${branchId}`,
        { credentials: "include" },
      );
      return res.ok ? ((await res.json()).payment?.prepaid as number) : null;
    });
    expect(prepaid, "the server should roll up a prepaid figure").not.toBeNull();
    await expect(tiles.nth(6).locator("strong")).toHaveText(
      `${prepaid ? prepaid.toLocaleString("vi-VN") : "0"} đ`,
    );
  });

  test("the tag button offers only the patient's own branch tags", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    await page
      .locator(".bd-patient-tablecard tbody tr.ant-table-row .bd-patient-name")
      .first()
      .click();

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
    const tiles = page.locator(".pd-image-shown .pd-image-tile");
    await expect(tiles.first()).toBeVisible({ timeout: 20000 });
    const shownCount = await tiles.count();
    expect(shownCount).toBeGreaterThan(0);

    // The empty "Kéo ảnh vào…" zone gives way to them: the first photograph
    // sits at the top of the panel, under the three commands.
    await expect(page.locator(".pd-image-drop")).toHaveCount(0);
    const panelTop = (await page.locator(".pd-image-panel").boundingBox())!.y;
    const firstTop = (await tiles.first().boundingBox())!.y;
    expect(Math.round(firstTop - panelTop)).toBe(9);

    // Each tile is the reference's own: 240px of cover, full panel width.
    const tile = (await page.locator(".pd-image-shown img").first().boundingBox())!;
    expect(Math.round(tile.height)).toBe(240);
    await expect(page.locator(".pd-image-shown img").first()).toHaveCSS("object-fit", "cover");

    // Clicking one opens the same full-screen viewer as Hình ảnh: counter,
    // the tool row (rotate, flip, zoom, annotate) and the thumbnail strip.
    await tiles.first().click();
    const viewer = page.getByTestId("patient-image-viewer");
    await expect(viewer).toBeVisible();
    await expect(page.getByTestId("patient-image-counter")).toHaveText(`1 / ${shownCount}`);
    const tools = viewer.getByRole("toolbar", { name: "Công cụ xem ảnh" });
    for (const name of ["Vẽ chú thích", "Xoay phải", "Lật ngang", "Zoom gần", "Đóng"]) {
      await expect(tools.getByRole("button", { name, exact: true })).toBeVisible();
    }
    await expect(viewer.locator(".pi-viewer-thumbs")).toBeVisible();

    // Rotating is applied to the frame, and Escape closes the viewer.
    await tools.getByRole("button", { name: "Xoay phải", exact: true }).click();
    await expect(page.getByTestId("patient-image-frame")).toHaveAttribute(
      "style",
      /--pi-rotate: 90deg/,
    );
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
  });

  test("Chọn ảnh hiển thị lists the photographs by day, and unticking hides one", async ({
    page,
  }) => {
    await openConsultingWithImages(page);
    await expect(page.locator(".pd-image-shown .pd-image-tile").first()).toBeVisible({
      timeout: 20000,
    });
    const before = await page.locator(".pd-image-shown .pd-image-tile").count();

    await page.locator(".pd-image-tools").getByRole("button", { name: "Danh sách ảnh" }).click();
    const picker = page.getByRole("dialog", { name: "Chọn ảnh hiển thị" });
    await expect(picker).toBeVisible();

    // Grouped under the day they were taken, on 280px cards — measured off the
    // reference. Everything starts ticked.
    await expect(picker.locator(".pd-image-day > h4").first()).toHaveText(/\d{2}\/\d{2}\/\d{4}/);
    const cards = picker.locator(".pd-image-card");
    // Polled: AntD scales a modal in from 0.2, so measuring the moment it turns
    // visible reads 56px — a fifth of the real width.
    await expect.poll(async () => Math.round((await cards.first().boundingBox())!.width)).toBe(280);
    await expect(picker.locator(".pd-image-card--on")).toHaveCount(before);

    // A card carries its name, its time, and the reference's two round actions.
    await expect(cards.first().locator("b")).not.toBeEmpty();
    await expect(cards.first().getByRole("button", { name: "Sắp xếp" })).toBeVisible();
    await expect(cards.first().getByRole("button", { name: "Xoá ảnh" })).toBeVisible();

    // Unticking takes it off the panel behind.
    await cards.first().getByRole("checkbox").uncheck();
    await picker.getByRole("button", { name: "Xong" }).click();
    await expect(picker).toBeHidden();
    await expect(page.locator(".pd-image-shown .pd-image-tile")).toHaveCount(before - 1);
  });

  test("dragging a card by its grip in Chọn ảnh hiển thị reorders the day, and it survives a reload", async ({
    page,
  }) => {
    await openConsultingWithImages(page);
    await expect(page.locator(".pd-image-shown .pd-image-tile").first()).toBeVisible({
      timeout: 20000,
    });

    const openPicker = async () => {
      await page.locator(".pd-image-tools").getByRole("button", { name: "Danh sách ảnh" }).click();
      const picker = page.getByRole("dialog", { name: "Chọn ảnh hiển thị" });
      await expect(picker).toBeVisible();
      const cards = picker.locator(".pd-image-day").first().locator(".pd-image-card");
      await expect
        .poll(async () => Math.round((await cards.first().boundingBox())!.width))
        .toBe(280);
      return { picker, cards };
    };
    const namesOf = (cards: Locator) => cards.locator("b").allTextContents();

    const { picker, cards } = await openPicker();
    const count = await cards.count();
    test.skip(count < 2, "the first day needs two photographs to swap");
    // The row runs sideways and scrolls — measured off the reference.
    await expect(picker.locator(".pd-image-cards").first()).toHaveCSS("flex-wrap", "nowrap");
    await expect(picker.locator(".pd-image-cards").first()).toHaveCSS("overflow-x", "auto");

    const [firstName, secondName] = await namesOf(cards);
    const from = await cards.nth(1).getByRole("button", { name: "Sắp xếp" }).boundingBox();
    const to = await cards.nth(0).getByRole("button", { name: "Sắp xếp" }).boundingBox();
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();

    const reordered = page.waitForResponse(
      (res) => res.url().includes("/reorder") && res.request().method() === "PUT",
    );
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(from!.x - 20, from!.y + from!.height / 2, { steps: 4 });
    await page.mouse.move(to!.x + to!.width / 2 - 40, to!.y + to!.height / 2, { steps: 12 });
    await page.mouse.up();
    expect((await reordered).ok()).toBeTruthy();
    await expect
      .poll(() => namesOf(cards))
      .toEqual(expect.arrayContaining([secondName, firstName]));
    await expect
      .poll(async () => (await namesOf(cards)).slice(0, 2))
      .toEqual([secondName, firstName]);

    // The panel behind stacks in the same order, and so does a fresh load.
    await picker.getByRole("button", { name: "Xong" }).click();
    await expect(picker).toBeHidden();
    await expect(page.locator(".pd-image-shown .pd-image-tile").first()).toHaveAttribute(
      "aria-label",
      `Xem ảnh ${secondName}`,
    );

    await page.reload();
    await expect(page.locator(".pd-image-shown .pd-image-tile").first()).toBeVisible({
      timeout: 20000,
    });
    const reopened = await openPicker();
    await expect
      .poll(async () => (await namesOf(reopened.cards)).slice(0, 2))
      .toEqual([secondName, firstName]);

    // Put it back so the next run starts from the same order.
    const back = page.waitForResponse(
      (res) => res.url().includes("/reorder") && res.request().method() === "PUT",
    );
    const from2 = await reopened.cards
      .nth(1)
      .getByRole("button", { name: "Sắp xếp" })
      .boundingBox();
    const to2 = await reopened.cards.nth(0).getByRole("button", { name: "Sắp xếp" }).boundingBox();
    await page.mouse.move(from2!.x + from2!.width / 2, from2!.y + from2!.height / 2);
    await page.mouse.down();
    await page.mouse.move(from2!.x - 20, from2!.y + from2!.height / 2, { steps: 4 });
    await page.mouse.move(to2!.x + to2!.width / 2 - 40, to2!.y + to2!.height / 2, { steps: 12 });
    await page.mouse.up();
    expect((await back).ok()).toBeTruthy();
    await expect
      .poll(async () => (await namesOf(reopened.cards)).slice(0, 2))
      .toEqual([firstName, secondName]);
  });
});
