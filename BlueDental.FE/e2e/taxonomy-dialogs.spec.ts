import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { purgeRunGroups } from "./fixtures/cleanup";

// The groups this file creates carry a run id; leave none behind in the shared DB.
test.afterAll(async ({ browser }) => {
  await purgeRunGroups(browser, "care_service", ["NHOM DV"]);
});

/**
 * Feature: the per-catalog dialogs. The reference gives every catalog its own
 * form rather than one shared one, so each of these checks the field set it
 * actually offers and that what was typed comes back from the server.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL.
 */

async function createGroup(page: Page, name: string) {
  await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Tên phân loại/).fill(name);
  await dialog.getByRole("button", { name: /Lưu$/ }).click();
  await expect(dialog).toBeHidden();

  // Creating a group selects it. Wait for that: an entry dialog opened before
  // the selection lands would default to whichever group was selected before.
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function reopen(page: Page, rowName: string) {
  await page
    .getByRole("row", { name: new RegExp(rowName) })
    .getByRole("button")
    .nth(1)
    .click();
  return page.getByRole("dialog");
}

interface ApiCall {
  method: "GET" | "POST";
  url: string;
  body?: unknown;
}

interface ApiResult {
  status: number;
  body: { id?: string; name?: string; items?: { id: string; name: string }[]; error?: { code?: string } };
}

/**
 * One request from the logged-in page: cookie session + antiforgery header,
 * the same way the browser itself talks to the API. No injected tokens.
 */
async function callApi(page: Page, call: ApiCall): Promise<ApiResult> {
  return page.evaluate(async ({ method, url, body }) => {
    const xsrf = document.cookie
      .split("; ")
      .find((c) => c.startsWith("XSRF-TOKEN="))
      ?.substring("XSRF-TOKEN=".length);
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }, call);
}

/** The branch the signed-in account works in — the first one it may open. */
async function currentBranchId(page: Page): Promise<string> {
  const res = await callApi(page, { method: "GET", url: "/api/v1/app/clinic-branches/accessible" });
  const list = Array.isArray(res.body) ? (res.body as { id: string }[]) : res.body.items ?? [];
  expect(list.length, "the account should have an accessible branch").toBeGreaterThan(0);
  return list[0].id;
}

/** The Labo tab has nothing to pick without a supplier; make one when the branch has none. */
async function ensureSupplier(page: Page, branchId: string, id: string): Promise<string> {
  const existing = await callApi(page, {
    method: "GET",
    url: `/api/v1/app/labo-suppliers?ClinicBranchId=${branchId}&IsActive=true&MaxResultCount=1`,
  });
  const found = existing.body.items?.[0];
  if (found) return found.name;

  const created = await callApi(page, {
    method: "POST",
    url: "/api/v1/app/labo-suppliers",
    body: { name: `Labo e2e ${id}`, email: `labo-${id}@example.com`, clinicBranchId: branchId },
  });
  expect(created.status, "seeding a labo supplier").toBe(200);
  return created.body.name!;
}

test.describe("Danh mục — dialog theo từng danh mục", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a service keeps its price configuration, stages, warranty and labo suppliers", async ({
    page,
  }) => {
    const id = runId();
    const name = `DV CAU HINH ${id}`;

    await page.goto("/taxonomy/service");
    const branchId = await currentBranchId(page);
    const supplierName = await ensureSupplier(page, branchId, id);
    await createGroup(page, `NHOM DV ${id}`);

    await page.getByRole("button", { name: /Thêm dịch vụ$/ }).click();
    let dialog = page.getByRole("dialog");

    // The reference dropped its "Mã dịch vụ" box and added a Labo tab.
    await expect(dialog.getByLabel(/Mã dịch vụ/)).toHaveCount(0);
    await expect(dialog.getByRole("tab")).toHaveText(["Cài đặt", "Công đoạn", "Bảo hành", "Labo"]);

    await dialog.getByLabel(/^Dịch vụ/).fill(name);
    await dialog.getByLabel(/Tên chi tiết/).fill("Tên chi tiết E2E");
    await dialog.getByLabel(/^Giá$/).fill("1000");
    await dialog.getByLabel(/Giảm giá/).fill("10");
    await dialog.getByLabel(/^Đơn vị$/).fill("Răng");

    // 10% VAT, price quoted before tax
    await dialog.getByLabel(/% thuế/).click();
    await page.locator(".ant-select-item-option").filter({ hasText: /^10%$/ }).click();

    // The two read-only boxes follow the inputs live, before any save:
    // 1000 − 10% = 900, then +10% VAT = 990.
    await expect(dialog.getByLabel(/Giá sau giảm/)).toHaveValue("900");
    await expect(dialog.getByLabel(/Thực thu từ khách/)).toHaveValue("990");
    // "Sau thuế": the price already carries VAT, so the first box backs it out.
    await dialog.locator(".ant-segmented-item", { hasText: "Sau thuế" }).click();
    await expect(dialog.getByLabel(/Giá sau giảm/)).toHaveValue("818");
    await expect(dialog.getByLabel(/Thực thu từ khách/)).toHaveValue("900");
    await dialog.locator(".ant-segmented-item", { hasText: "Trước thuế" }).click();
    await expect(dialog.getByLabel(/Giá sau giảm/)).toHaveValue("900");

    await dialog.getByLabel("Yêu cầu hình ảnh khi điều trị").check();
    await dialog.getByLabel("Hiển thị răng ở hóa đơn").check();

    await dialog.getByRole("tab", { name: "Công đoạn" }).click();
    await dialog.getByLabel("Tính doanh số trên công đoạn").check();
    await expect(dialog.getByText(/^Bật: Bác sĩ sẽ nhận hoa hồng/)).toBeVisible();

    // A new stage starts as a percentage share; this one becomes 30 % and
    // counts toward the marketing salary.
    await dialog.getByRole("textbox", { name: "Công đoạn", exact: true }).fill("Lấy dấu");
    await dialog.getByRole("button", { name: /Công đoạn$/ }).click();
    const first = dialog.getByRole("row", { name: /Lấy dấu/ });
    await expect(first.getByRole("cell", { name: "Lấy dấu", exact: true })).toBeVisible();
    await expect(first.locator(".ant-segmented-item-selected")).toHaveText("%");
    await first.getByLabel("Giá trị công đoạn Lấy dấu").fill("30");
    const star = first.getByRole("button", { name: /Tính lương cho phòng MKT/ });
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");

    // The second is a fixed amount, then the first is renamed in place.
    await dialog.getByRole("textbox", { name: "Công đoạn", exact: true }).fill("Gắn sứ");
    await dialog.getByRole("textbox", { name: "Công đoạn", exact: true }).press("Enter");
    const second = dialog.getByRole("row", { name: /Gắn sứ/ });
    await second.getByText("VNĐ", { exact: true }).click();
    await expect(second.locator(".ant-segmented-item-selected")).toHaveText("VNĐ");
    await second.getByLabel("Giá trị công đoạn Gắn sứ").fill("250000");
    await expect(second.getByLabel("Giá trị công đoạn Gắn sứ")).toHaveValue("250.000");

    // Neither box grows without bound: an amount stops at ten digits, a share at 100.
    const secondValue = second.getByLabel("Giá trị công đoạn Gắn sứ");
    await secondValue.selectText();
    await secondValue.pressSequentially("5555555555555555555");
    await expect(secondValue).toHaveValue("5.555.555.555");
    await secondValue.fill("250000");
    const firstValue = first.getByLabel("Giá trị công đoạn Lấy dấu");
    await firstValue.selectText();
    await firstValue.pressSequentially("300");
    await expect(firstValue).toHaveValue("30");

    await first.getByRole("button", { name: /Sửa tên công đoạn/ }).click();
    await first.getByRole("textbox", { name: "Tên công đoạn" }).fill("Lấy dấu răng");
    await first.getByRole("textbox", { name: "Tên công đoạn" }).press("Enter");
    await expect(dialog.getByRole("cell", { name: "Lấy dấu răng", exact: true })).toBeVisible();
    await expect(dialog.getByText("Hiển thị 2 trên 2")).toBeVisible();

    await dialog.getByRole("tab", { name: "Labo" }).click();
    await expect(
      dialog.getByText("Để trống nếu dịch vụ này được chọn tất cả nhà cung cấp khi tạo phiếu labo."),
    ).toBeVisible();
    await dialog.getByRole("combobox", { name: /Nhà cung cấp Labo/ }).click();
    await page.locator(".ant-select-item-option").filter({ hasText: supplierName }).first().click();
    await expect(dialog.getByText("Đã chọn 1 nhà cung cấp")).toBeVisible();
    await page.keyboard.press("Escape");

    // The pick is also a pill under the box, and its × takes it back out.
    const chip = dialog.locator(".bd-labo-chip", { hasText: supplierName });
    await expect(chip).toBeVisible();
    await chip.getByRole("button", { name: "Bỏ chọn nhà cung cấp" }).click();
    await expect(chip).toHaveCount(0);
    await expect(dialog.getByText("Đã chọn 1 nhà cung cấp")).toHaveCount(0);
    await dialog.getByRole("combobox", { name: /Nhà cung cấp Labo/ }).click();
    await page.locator(".ant-select-item-option").filter({ hasText: supplierName }).first().click();
    await page.keyboard.press("Escape");
    await expect(chip).toBeVisible();

    await dialog.getByRole("tab", { name: "Bảo hành" }).click();
    // Radio-like: picking one clears the rest, so this is a click rather than
    // a check — the box is controlled, and check() samples it before React has
    // re-rendered the group.
    await dialog.getByLabel("Bảo hành 1 năm").click();
    await expect(dialog.getByLabel("Bảo hành 1 năm")).toBeChecked();

    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();

    // Everything comes back from the server, including the two boxes it works out.
    await page.reload();
    dialog = await reopen(page, name);

    await expect(dialog.getByLabel(/Tên chi tiết/)).toHaveValue("Tên chi tiết E2E");
    await expect(dialog.getByLabel(/^Đơn vị$/)).toHaveValue("Răng");
    await expect(dialog.getByLabel("Yêu cầu hình ảnh khi điều trị")).toBeChecked();
    await expect(dialog.getByLabel("Hiển thị răng ở hóa đơn")).toBeChecked();
    // 1000 − 10% = 900, then +10% VAT = 990 — the same figures the server returns.
    await expect(dialog.getByLabel(/Giá sau giảm/)).toHaveValue("900");
    await expect(dialog.getByLabel(/Thực thu từ khách/)).toHaveValue("990");

    await dialog.getByRole("tab", { name: "Công đoạn" }).click();
    const savedFirst = dialog.getByRole("row", { name: /Lấy dấu răng/ });
    await expect(savedFirst.getByRole("cell", { name: "Lấy dấu răng", exact: true })).toBeVisible();
    await expect(savedFirst.locator(".ant-segmented-item-selected")).toHaveText("%");
    await expect(savedFirst.getByLabel("Giá trị công đoạn Lấy dấu răng")).toHaveValue("30");
    await expect(
      savedFirst.getByRole("button", { name: /Tính lương cho phòng MKT/ }),
    ).toHaveAttribute("aria-pressed", "true");
    const savedSecond = dialog.getByRole("row", { name: /Gắn sứ/ });
    await expect(savedSecond.locator(".ant-segmented-item-selected")).toHaveText("VNĐ");
    await expect(savedSecond.getByLabel("Giá trị công đoạn Gắn sứ")).toHaveValue("250.000");
    await expect(
      savedSecond.getByRole("button", { name: /Tính lương cho phòng MKT/ }),
    ).toHaveAttribute("aria-pressed", "false");

    await dialog.getByRole("tab", { name: "Labo" }).click();
    await expect(dialog.getByText("Đã chọn 1 nhà cung cấp")).toBeVisible();
    await expect(dialog.locator(".bd-labo-chip", { hasText: supplierName })).toBeVisible();

    await dialog.getByRole("tab", { name: "Bảo hành" }).click();
    await expect(dialog.getByLabel("Bảo hành 1 năm")).toBeChecked();
    await expect(dialog.getByLabel("Không bảo hành")).not.toBeChecked();
  });

  test("the API refuses a labo supplier from another branch and a share over 100 %", async ({
    page,
  }) => {
    const id = runId();
    await page.goto("/taxonomy/service");
    const branchId = await currentBranchId(page);

    const groups = await callApi(page, {
      method: "GET",
      url: `/api/v1/app/taxonomies?ClinicBranchId=${branchId}&Group=care_service&MaxResultCount=1`,
    });
    const taxonomyId = groups.body.items?.[0]?.id;
    expect(taxonomyId, "the branch should have a service group").toBeTruthy();

    const base = {
      clinicBranchId: branchId,
      taxonomyId,
      name: `DV API ${id}`,
      price: 1000,
      serviceConfig: {
        taxRate: 0,
        priceIncludesTax: false,
        discountIsPercent: true,
        discountValue: 0,
        requireImage: false,
        deductDoctorOnWarranty: false,
        separateRevenue: false,
        showToothOnInvoice: false,
        revenueByStage: false,
        requireStageSequence: false,
        warrantyDays: 0,
        laboSupplierIds: [] as string[],
      },
      stages: [] as { name: string; value: number; valueType: number; isMarketingSalary: boolean }[],
    };

    // A supplier id nobody in this branch owns.
    const foreign = await callApi(page, {
      method: "POST",
      url: "/api/v1/app/catalog-entries",
      body: {
        ...base,
        serviceConfig: { ...base.serviceConfig, laboSupplierIds: ["00000000-0000-4000-8000-000000000001"] },
      },
    });
    expect(foreign.status).toBe(403);
    expect(foreign.body.error?.code).toBe("BlueDental:Catalogs:0025");

    // A percentage stage cannot exceed the whole.
    const overShare = await callApi(page, {
      method: "POST",
      url: "/api/v1/app/catalog-entries",
      body: {
        ...base,
        stages: [{ name: "Quá 100", value: 120, valueType: 0, isMarketingSalary: false }],
      },
    });
    expect(overShare.status).toBe(403);
    expect(overShare.body.error?.code).toBe("BlueDental:Catalogs:0021");

    // The same value as an amount is fine, and comes back typed.
    const amount = await callApi(page, {
      method: "POST",
      url: "/api/v1/app/catalog-entries",
      body: {
        ...base,
        stages: [{ name: "Tiền", value: 120, valueType: 1, isMarketingSalary: true }],
      },
    });
    expect(amount.status).toBe(200);
    const stored = amount.body as unknown as {
      stages: { valueType: number; isMarketingSalary: boolean }[];
    };
    expect(stored.stages).toEqual([expect.objectContaining({ valueType: 1, isMarketingSalary: true })]);
  });

  test("a medicine keeps both prices and its ingredient", async ({ page }) => {
    const id = runId();
    const name = `THUOC ${id}`;

    await page.goto("/taxonomy/medicine");
    await createGroup(page, `NHOM THUOC ${id}`);

    await page.getByRole("button", { name: /Thêm loại thuốc$/ }).click();
    let dialog = page.getByRole("dialog");

    await dialog.getByLabel(/Tên thuốc/).fill(name);
    await dialog.getByLabel(/Hoạt chất/).fill("Amoxicillin");
    await dialog.getByLabel(/Cách dùng/).fill("Uống sau ăn");
    await dialog.getByLabel(/Giá mua/).fill("8000");
    await dialog.getByLabel(/Giá bán/).fill("12000");
    await dialog.getByLabel(/Đơn vị tính/).fill("Viên");

    // This catalog is the one the reference gives no state checkboxes.
    await expect(dialog.getByLabel("Đang hoạt động")).toHaveCount(0);

    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    dialog = await reopen(page, name);
    await expect(dialog.getByLabel(/Hoạt chất/)).toHaveValue("Amoxicillin");
    // CurrencyInput shows the stored numbers grouped the Vietnamese way.
    await expect(dialog.getByLabel(/Giá mua/)).toHaveValue("8.000");
    await expect(dialog.getByLabel(/Giá bán/)).toHaveValue("12.000");
  });

  test("a diagnosis keeps its rich-text body and its note", async ({ page }) => {
    const id = runId();
    const name = `CHAN DOAN ${id}`;

    await page.goto("/taxonomy/diagnosis");
    await createGroup(page, `NHOM CD ${id}`);

    await page.getByRole("button", { name: /Thêm chẩn đoán$/ }).click();
    let dialog = page.getByRole("dialog");

    await dialog.getByLabel(/Tên chẩn đoán/).fill(name);
    // The Quill editor is a contenteditable, not an input.
    await dialog.locator(".ql-editor").click();
    await page.keyboard.type("Nội dung tư vấn E2E");
    await dialog.getByLabel(/Ghi chú/).fill("Ghi chú E2E");
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    dialog = await reopen(page, name);
    await expect(dialog.locator(".ql-editor")).toContainText("Nội dung tư vấn E2E");
    await expect(dialog.getByLabel(/Ghi chú/)).toHaveValue("Ghi chú E2E");
  });

  test("a prescription template stores its lines and works out the quantity", async ({ page }) => {
    const id = runId();
    const medicine = `THUOC DON ${id}`;
    const template = `DON MAU ${id}`;

    // The line picker reads the branch's medicine catalog, so seed one first.
    await page.goto("/taxonomy/medicine");
    await createGroup(page, `NHOM DON ${id}`);
    await page.getByRole("button", { name: /Thêm loại thuốc$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên thuốc/).fill(medicine);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/taxonomy/prescription-template");
    await page.getByRole("button", { name: /Thêm đơn thuốc mẫu$/ }).click();
    dialog = page.getByRole("dialog");

    await dialog.getByLabel(/Tên đơn thuốc mẫu/).fill(template);
    await dialog.getByLabel(/Lời dặn/).fill("Uống đủ liều");

    // The branch's medicine list is long (e2e leftovers), so the picker is a
    // virtual list: type the name first, then the one match is on screen.
    await dialog.getByLabel("Tên thuốc", { exact: true }).fill(medicine);
    await page
      .locator(".ant-select-dropdown:visible .ant-select-item-option")
      .filter({ hasText: medicine })
      .first()
      .click();
    await dialog.getByLabel("Ngày uống").fill("2");
    await dialog.getByLabel("Mỗi lần").fill("1.5");
    await dialog.getByLabel("Số ngày").fill("5");

    // "Số lượng" is derived, and the reference shows it disabled.
    const quantity = dialog.getByLabel("Số lượng");
    await expect(quantity).toBeDisabled();
    await expect(quantity).toHaveValue("15");

    // ── "Sử dụng" only commits on its own "Lưu" ────────────────────────────
    const usage = dialog.getByRole("button", { name: /^Sử dụng$/ });
    await usage.click();
    await page.getByLabel("Sau khi ăn").check();
    await page.getByLabel("Trước khi ngủ").check();

    // Ticking a box changes nothing behind the popover yet.
    await expect(usage).toHaveText("Sử dụng");

    await page.getByRole("button", { name: /Lưu$/ }).last().click();
    await expect(dialog.getByRole("button", { name: /Sau khi ăn/ })).toContainText(
      "Trước khi ngủ",
    );

    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    dialog = await reopen(page, template);
    await expect(dialog.getByLabel("Số lượng")).toHaveValue("15");
    await expect(dialog.getByRole("button", { name: /Sau khi ăn/ })).toContainText("Trước khi ngủ");
  });

  test('"Khác" asks for the usage in words, and shows it back', async ({ page }) => {
    const id = runId();
    const medicine = `THUOC KHAC ${id}`;
    const template = `DON KHAC ${id}`;
    const written = `Ngậm dưới lưỡi ${id}`;

    // A prescription line picks from the thuốc catalog, so one has to exist.
    await page.goto("/taxonomy/medicine");
    await createGroup(page, `NHOM TK ${id}`);
    await page.getByRole("button", { name: /Thêm loại thuốc$/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên thuốc/).fill(medicine);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    // Đơn thuốc mẫu is one flat table on the reference — no group panel.
    await page.goto("/taxonomy/prescription-template");
    await page.getByRole("button", { name: /Thêm đơn thuốc mẫu$/ }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên đơn thuốc mẫu/).fill(template);

    // The branch's medicine list is long (e2e leftovers), so the picker is a
    // virtual list: type the name first, then the one match is on screen.
    await dialog.getByLabel("Tên thuốc", { exact: true }).fill(medicine);
    await page
      .locator(".ant-select-dropdown:visible .ant-select-item-option")
      .filter({ hasText: medicine })
      .first()
      .click();

    const usage = dialog.getByRole("button", { name: /^Sử dụng$/ });
    await usage.click();
    await page.getByLabel("Khác").check();

    // Ticking "Khác" asks for the words, and refuses to commit without them.
    const other = page.getByLabel("Cách sử dụng khác");
    await expect(other).toBeVisible();
    await page.getByRole("button", { name: /Lưu$/ }).last().click();
    await expect(page.getByText("Vui lòng nhập giá trị!")).toBeVisible();
    await expect(usage).toHaveText("Sử dụng");

    await other.fill(written);
    await page.getByRole("button", { name: /Lưu$/ }).last().click();

    // "Khác" reads as whatever was written for it.
    await expect(dialog.getByRole("button", { name: new RegExp(written) })).toBeVisible();

    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    // The server kept it, not the page.
    await page.reload();
    dialog = await reopen(page, template);
    await expect(dialog.getByRole("button", { name: new RegExp(written) })).toBeVisible();
  });

  test("a medical record template stores the A4 sheet it was filled in with", async ({ page }) => {
    const id = runId();
    const name = `BENH AN ${id}`;

    await page.goto("/taxonomy/medical-record-template");
    await createGroup(page, `NHOM BA ${id}`);

    await page.getByRole("button", { name: /Thêm bệnh án mẫu$/ }).click();
    let dialog = page.getByRole("dialog");

    // The printed sheet is the dental outpatient record, not a blank form.
    await expect(dialog.getByRole("heading", { name: "BỆNH ÁN NGOẠI TRÚ" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "CHUYÊN KHOA RĂNG HÀM MẶT" })).toBeVisible();
    await expect(dialog.getByText("I. HÀNH CHÍNH:")).toBeVisible();
    await expect(dialog.getByText("Mạch:")).toBeVisible();
    await expect(dialog.getByText("TỔNG KẾT BỆNH ÁN:")).toBeVisible();
    await expect(dialog.getByText("Phân loại khe hở môi vòm miệng")).toBeVisible();

    // The vitals are a ruled box to the *right* of the examination notes, not a
    // row stacked under the section heading.
    const layout = await page.evaluate(() => {
      // The innermost element holding every vital is the ruled box itself —
      // a single row would only hold one of them.
      const box = [...document.querySelectorAll("[role=dialog] div")]
        .filter((el) => {
          const text = el.textContent ?? "";
          return text.includes("Mạch:") && text.includes("Cân nặng:");
        })
        .pop()!;
      const exam = document.querySelector<HTMLElement>(
        '[role=dialog] [aria-label="Nhập khám toàn thân..."]',
      )!;
      const b = box.getBoundingClientRect();
      const e = exam.getBoundingClientRect();

      // Each "Họ tên" of the handover table is written on a rule, and neither
      // heading in that column is allowed to wrap.
      const labels = [...document.querySelectorAll("[role=dialog] td p")].filter((el) =>
        /^Người (giao|nhận) hồ sơ:$/.test((el.textContent ?? "").trim()),
      );
      return {
        boxIsRightOfExam: b.left >= e.right,
        boxOverlapsExamBand: b.top < e.bottom + 60,
        boxHasBorder: getComputedStyle(box).borderTopWidth !== "0px",
        handoverLabels: labels.length,
        wrapped: labels.filter((el) => el.getBoundingClientRect().height > 26).length,
      };
    });
    expect(layout.boxIsRightOfExam).toBe(true);
    expect(layout.boxOverlapsExamBand).toBe(true);
    expect(layout.boxHasBorder).toBe(true);
    expect(layout.handoverLabels).toBe(2);
    expect(layout.wrapped, "the handover column is too narrow and its headings wrap").toBe(0);
    await expect(dialog.getByText("ĐẠI DIỆN CƠ SỞ KHÁM CHỮA BỆNH")).toBeVisible();

    await dialog.getByLabel(/Tiêu đề bệnh án/).fill(name);
    await dialog.getByLabel("Nhập lý do vào viện...").fill("Đau răng số 36");
    await dialog.getByLabel("Nhập khám toàn thân...").fill("Thể trạng bình thường");
    // A cell on each of the other two pages, so all three are wired up.
    await dialog.getByLabel("Nhập bệnh chính...").fill("Sâu ngà răng 36");
    await dialog.getByLabel("Nhập tóm tắt bệnh án...").fill("Tóm tắt E2E");

    // The zoom control the reference puts above the sheet. A transform does not
    // change an element's layout box, so this also guards the sheet staying
    // centred instead of drifting to the left edge as it scales.
    await dialog.getByRole("button", { name: "Phóng to" }).click();
    await expect(dialog.getByText("100%")).toBeVisible();

    const margins = await page.evaluate(() => {
      const sheetPage = document.querySelector<HTMLElement>("[role=dialog] .bd-a4-page")!;
      const scroller = sheetPage.closest("div.bd-a4-viewport")!;
      const outer = scroller.getBoundingClientRect();
      const inner = sheetPage.getBoundingClientRect();
      return { left: inner.left - outer.left, right: outer.right - inner.right };
    });
    expect(Math.abs(margins.left - margins.right)).toBeLessThan(6);

    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    dialog = await reopen(page, name);
    await expect(dialog.getByLabel("Nhập lý do vào viện...")).toHaveValue("Đau răng số 36");
    await expect(dialog.getByLabel("Nhập khám toàn thân...")).toHaveValue("Thể trạng bình thường");
    await expect(dialog.getByLabel("Nhập bệnh chính...")).toHaveValue("Sâu ngà răng 36");
    await expect(dialog.getByLabel("Nhập tóm tắt bệnh án...")).toHaveValue("Tóm tắt E2E");
  });
});
