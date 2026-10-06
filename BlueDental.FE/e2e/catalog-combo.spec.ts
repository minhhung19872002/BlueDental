import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";

/**
 * Combo dịch vụ — review P0510, from "Update thêm màn hình cho combo" down:
 *
 * - Danh mục › Dịch vụ: "Loại: Dịch vụ lẻ | Combo" in "Thêm dịch vụ", the
 *   combo form (Danh mục picker, Thành phần combo, Cấu hình giá & thuế), the
 *   "Tất cả / Dịch vụ lẻ / Combo" filter and the combo row that opens on its
 *   components;
 * - Chọn Dịch Vụ: a ticked service that belongs to a combo raises the orange
 *   "Gợi ý tư vấn", "Áp dụng Combo" opens the Combo tab, picking a combo
 *   clears the ticked services, and Lưu stores the combo as one advise line.
 *
 * Every record is created through the real API on the first branch and read
 * back from PostgreSQL. Nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

const SERVICE_CONFIG = {
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
  laboSupplierIds: [],
};

interface Entry {
  id: string;
  name: string;
  price: number | null;
  isCombo: boolean;
  retailPrice: number | null;
  comboItems: { componentEntryId: string; quantity: number; unitPrice: number; componentName: string | null }[];
}

async function call<T>(page: Page, method: string, url: string, body?: unknown, branch = BRANCH) {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    },
    { method, url, body, branch },
  ) as Promise<{ status: number; body: T }>;
}

async function ok<T>(page: Page, method: string, url: string, body?: unknown, branch = BRANCH): Promise<T> {
  const res = await call<T>(page, method, url, body, branch);
  if (res.status >= 300) throw new Error(`${method} ${url} ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function firstGroup(page: Page, branch = BRANCH): Promise<{ id: string; name: string }> {
  const groups = await ok<{ items: { id: string; name: string }[] }>(
    page,
    "GET",
    `/api/v1/app/taxonomies?ClinicBranchId=${branch}&Group=care_service&MaxResultCount=1`,
    undefined,
    branch,
  );
  return groups.items[0];
}

async function service(page: Page, taxonomyId: string, name: string, price: number, branch = BRANCH) {
  return ok<Entry>(
    page,
    "POST",
    "/api/v1/app/catalog-entries",
    { clinicBranchId: branch, taxonomyId, name, price, serviceConfig: SERVICE_CONFIG, stages: [] },
    branch,
  );
}

async function combo(page: Page, taxonomyId: string, name: string, items: { id: string; quantity: number; unitPrice: number }[]) {
  return ok<Entry>(page, "POST", "/api/v1/app/catalog-entries", {
    clinicBranchId: BRANCH,
    taxonomyId,
    name,
    isCombo: true,
    description: "Combo e2e",
    serviceConfig: SERVICE_CONFIG,
    stages: [],
    comboItems: items.map((item) => ({ componentEntryId: item.id, quantity: item.quantity, unitPrice: item.unitPrice })),
  });
}

const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

test.describe("Combo dịch vụ — review P0510", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Danh mục builds a combo from single services, prices it from its rows, and lists it under Combo", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/taxonomy/service");
    await assertRealApiTraffic(page, "/api/v1/app/catalog-entries");

    const stamp = runId();
    const group = await firstGroup(page);
    const cleaning = await service(page, group.id, `e2e combo cạo vôi ${stamp}`, 300_000);
    const gel = await service(page, group.id, `e2e combo gel ${stamp}`, 350_000);

    await page.goto(`/taxonomy/service?group=${group.id}`);
    await page.getByRole("button", { name: "Thêm dịch vụ / combo" }).click();
    const dialog = page.getByRole("dialog", { name: "Thêm dịch vụ" });
    await expect(dialog).toBeVisible();

    // Loại: Combo swaps the form beneath.
    await dialog.getByText("Combo", { exact: true }).first().click();
    const comboDialog = page.locator(".bd-combo-dialog");
    await expect(comboDialog.getByText("Thành phần combo")).toBeVisible();

    // The Danh mục picker searches the server; "+" adds, "+" again raises the quantity.
    const search = comboDialog.getByPlaceholder("Tìm theo tên...");
    await search.fill(`e2e combo cạo vôi ${stamp}`);
    await comboDialog.getByRole("button", { name: `Thêm ${cleaning.name} vào combo` }).click();
    await search.fill(`e2e combo gel ${stamp}`);
    const addGel = comboDialog.getByRole("button", { name: `Thêm ${gel.name} vào combo` });
    await addGel.click();
    await addGel.click();
    await expect(comboDialog.locator(".bd-combo-picker-badge")).toHaveText("+2 trong combo");

    // Thành tiền of the cleaning lowered for this combo only.
    const amount = comboDialog.getByRole("textbox", { name: `Thành tiền ${cleaning.name}` });
    await amount.fill("250000");

    // Tổng giá lẻ 300.000 + 2 × 350.000 = 1.000.000; Giá combo 250.000 + 700.000 = 950.000.
    await expect(comboDialog.locator(".bd-combo-items-foot")).toContainText("1.000.000đ");
    await expect(comboDialog.locator(".bd-combo-items-foot")).toContainText("950.000đ");
    await expect(comboDialog.locator(".bd-combo-savings")).toContainText("50.000 đ (5%)");

    // 8% Trước thuế: Tiền thuế 76.000, Thực thu 1.026.000.
    await comboDialog.locator(".ant-select").filter({ hasText: "KCT" }).click();
    await page.locator(".ant-select-item-option", { hasText: /^8%$/ }).click();
    await expect(comboDialog.getByRole("textbox", { name: "Tiền thuế" })).toHaveValue("76.000");
    await expect(comboDialog.getByRole("textbox", { name: "Thực thu (Đã gồm VAT)" })).toHaveValue("1.026.000");

    const name = `e2e Combo trắng sáng ${stamp}`;
    await comboDialog.getByRole("textbox", { name: "Tên combo" }).fill(name);
    const created = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().endsWith("/api/v1/app/catalog-entries"),
    );
    await comboDialog.getByRole("button", { name: "Lưu combo" }).click();
    const saved = (await (await created).json()) as Entry;
    expect(saved.isCombo).toBe(true);
    expect(saved.price).toBe(950_000);
    expect(saved.retailPrice).toBe(1_000_000);
    expect(saved.comboItems.map((item) => [item.componentEntryId, item.quantity, item.unitPrice])).toEqual([
      [cleaning.id, 1, 250_000],
      [gel.id, 2, 350_000],
    ]);
    await expect(comboDialog).toBeHidden();

    // The service's own price is untouched.
    const cleaningAfter = await ok<Entry>(page, "GET", `/api/v1/app/catalog-entries/${cleaning.id}`);
    expect(cleaningAfter.price).toBe(300_000);

    // After a reload: Combo lists it, Dịch vụ lẻ does not, and the row opens on its parts.
    await page.reload();
    await page.getByPlaceholder("Tìm theo tên dịch vụ hoặc combo...").fill(stamp);
    const filter = page.locator(".bd-kind-filter");
    await expect(filter).toContainText("Tất cả (3)");
    await expect(filter).toContainText("Dịch vụ lẻ (2)");
    await expect(filter).toContainText("Combo (1)");

    await filter.getByText("Dịch vụ lẻ (2)").click();
    await expect(page.locator(".bd-cat-card tbody tr.ant-table-row")).toHaveCount(2);
    await expect(page.locator(".bd-cat-card")).not.toContainText(name);

    await filter.getByText("Combo (1)").click();
    const row = page.locator(".bd-cat-card tbody tr.ant-table-row", { hasText: name });
    await expect(row).toHaveCount(1);
    await expect(page.locator(".bd-cat-card tbody tr.ant-table-row")).toHaveCount(1);
    await expect(row).toContainText("COMBO");
    await expect(row).toContainText("2 thành phần · 3 đơn vị");
    await expect(row).toContainText("-5%");
    await row.getByRole("button", { name: `Xem thành phần ${name}` }).click();
    const detail = page.locator(".bd-combo-detail");
    await expect(detail).toContainText(cleaning.name);
    await expect(detail).toContainText("×2");
    await expect(detail).toContainText("Khách tiết kiệm 50.000 đ");
  });

  test("the server refuses a combo built from another branch's service, from a combo, or from nothing", async ({ page }) => {
    await page.goto("/taxonomy/service");
    await assertRealApiTraffic(page, "/api/v1/app/catalog-entries");
    const stamp = runId();
    const group = await firstGroup(page);
    const own = await service(page, group.id, `e2e combo own ${stamp}`, 100_000);
    const other = await service(page, (await firstGroup(page, BRANCH_TWO)).id, `e2e combo other ${stamp}`, 100_000, BRANCH_TWO);
    const inner = await combo(page, group.id, `e2e combo inner ${stamp}`, [{ id: own.id, quantity: 1, unitPrice: 90_000 }]);

    const attempt = (items: { componentEntryId: string; quantity: number; unitPrice: number }[]) =>
      call<{ error: { code: string } }>(page, "POST", "/api/v1/app/catalog-entries", {
        clinicBranchId: BRANCH,
        taxonomyId: group.id,
        name: `e2e combo refused ${stamp}`,
        isCombo: true,
        serviceConfig: SERVICE_CONFIG,
        comboItems: items,
      });

    const foreign = await attempt([{ componentEntryId: other.id, quantity: 1, unitPrice: 1 }]);
    expect(foreign.status).toBeGreaterThanOrEqual(400);
    expect(foreign.body.error.code).toBe("BlueDental:Catalogs:0028");

    const nested = await attempt([{ componentEntryId: inner.id, quantity: 1, unitPrice: 1 }]);
    expect(nested.body.error.code).toBe("BlueDental:Catalogs:0028");

    const empty = await attempt([]);
    expect(empty.body.error.code).toBe("BlueDental:Catalogs:0027");

    // The second branch's account cannot read the first branch's combo.
    await page.context().clearCookies();
    await login(page, BRANCH2_USER);
    const denied = await call(page, "GET", `/api/v1/app/catalog-entries/${inner.id}`, undefined, BRANCH_TWO);
    expect(denied.status).toBe(403);
  });

  test("Chọn Dịch Vụ suggests the combo, opens it, and saves it as one advise line", async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const stamp = runId();
    const group = await firstGroup(page);
    const cleaning = await service(page, group.id, `e2e gợi ý cạo vôi ${stamp}`, 500_000);
    const whitening = await service(page, group.id, `e2e gợi ý tẩy trắng ${stamp}`, 1_200_000);
    const comboName = `e2e Combo gợi ý ${stamp}`;
    const bundle = await combo(page, group.id, comboName, [
      { id: cleaning.id, quantity: 1, unitPrice: 400_000 },
      { id: whitening.id, quantity: 1, unitPrice: 1_050_000 },
    ]);
    expect(bundle.price).toBe(1_450_000);

    // A fresh patient with one diagnosis slip.
    const patientId = await page.evaluate(
      async ({ branch, suffix }) => {
        const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
        const get = async (url: string) => (await fetch(url, { credentials: "include", headers })).json();
        const post = async (url: string, body: unknown) => {
          const res = await fetch(url, { method: "POST", credentials: "include", headers, body: JSON.stringify(body) });
          if (!res.ok) throw new Error(`${url} ${res.status} ${await res.text()}`);
          return res.json();
        };
        const patient = await post("/api/v1/app/patients", {
          firstName: `Combo ${suffix}`,
          lastName: "E2E",
          dateOfBirth: null,
          gender: "male",
          phoneNumber: `07${suffix.padStart(8, "0").slice(-8)}`,
        });
        const diagnosis = (
          await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=1`)
        ).items[0];
        const staff = (await get("/api/v1/app/staff?MaxResultCount=1")).items[0];
        await post("/api/v1/app/patient-diagnoses", {
          patientId: patient.id,
          clinicBranchId: branch,
          diagnosisId: diagnosis.id,
          staffId: staff.id,
          note: `e2e combo ${suffix}`,
          teeth: [{ toothCode: 21, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
        });
        return patient.id as string;
      },
      { branch: BRANCH, suffix: stamp },
    );

    await page.goto(`/patient/${patientId}?tab=consulting&branchId=${BRANCH}`);
    const slipRow = page.locator(".pd-diagnosis-card tbody tr.ant-table-row").first();
    await expect(slipRow).toBeVisible({ timeout: 20_000 });
    await slipRow.getByRole("button", { name: "Tạo Dịch Vụ" }).click();
    const dialog = page.getByRole("dialog", { name: /Chọn Dịch Vụ/ });
    await expect(dialog).toBeVisible();

    // The Dịch vụ lẻ list never offers the combo as a service.
    await dialog.getByPlaceholder("Tìm dịch vụ").fill(stamp);
    await expect(dialog.locator(".am-table tbody tr")).toHaveCount(2, { timeout: 15_000 });
    await expect(dialog.locator(".am-table")).not.toContainText(comboName);

    // Ticking a part of the combo raises the suggestion, naming what is missing.
    await dialog.locator(".am-table tbody tr", { hasText: cleaning.name }).getByRole("checkbox").check();
    const notice = dialog.locator(".am-combo-notice");
    await expect(notice).toContainText(`Thêm ${whitening.name} để áp dụng ${comboName}`);
    await expect(notice).toContainText(`Tiết kiệm ${money(250_000)}`);

    // "Áp dụng Combo" only opens the Combo tab.
    await notice.getByRole("button", { name: "Áp dụng Combo" }).click();
    await expect(dialog.getByRole("tab", { name: /Combo/ })).toHaveAttribute("aria-selected", "true");
    await dialog.getByPlaceholder("Tìm combo").fill(stamp);
    const card = dialog.getByRole("article", { name: comboName });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText(money(1_450_000));
    await expect(card).toContainText("-15%");

    // Picking the combo clears the ticked service; the button turns into "Hủy dịch vụ".
    await card.getByRole("button", { name: "Chọn combo" }).click();
    await expect(card.getByRole("button", { name: "Hủy dịch vụ" })).toBeVisible();
    const summary = page.locator(".am-summary");
    await expect(summary.locator(".am-summary-items li")).toHaveCount(1);
    await expect(summary).toContainText(comboName);
    await expect(summary).not.toContainText(cleaning.name);
    await expect(summary).toContainText(`Giảm giá combo:${money(250_000)}`);
    await expect(summary.locator(".am-summary-total")).toHaveText(money(1_450_000));
    await expect(notice).toHaveCount(0);

    const created = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes("/api/v1/app/patient-advises"),
    );
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    const advise = (await (await created).json()) as { id: string; serviceId: string; price: number; quantity: number };
    expect(advise.serviceId).toBe(bundle.id);
    expect(advise.price).toBe(1_450_000);
    expect(advise.quantity).toBe(1);
    await expect(dialog).toBeHidden();

    // Phiếu tư vấn after a reload holds the combo as one line.
    await page.reload();
    const line = page.locator(`.pd-advise-table tbody tr[data-row-key="${advise.id}"]`);
    await expect(line).toBeVisible({ timeout: 20_000 });
    await expect(line).toContainText(comboName);
    await expect(line).toContainText(money(1_450_000));
  });
});
