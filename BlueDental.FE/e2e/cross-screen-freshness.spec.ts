import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Cross-screen freshness: a change saved on one screen reaches another screen
 * that already holds the same data, without a reload.
 *
 * The client keeps query results for five minutes, so each scenario first opens
 * the reading screen to fill its cache, makes the change on Danh mục, returns
 * through the browser's history — same document, same cache — and expects the
 * new value. A cache nobody invalidated would keep showing the old one.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL. The
 * service and the account carry the run id and are removed at the end; the
 * slip scenario A saves stays, as the other slip specs' do.
 */

const SERVICE_GROUP = "E2E CACHE FRESHNESS";
const FALLBACK_BRANCH = "11111111-1111-1111-1111-111111111111";
const PRICE_BEFORE = 120_000;
const PRICE_AFTER = 250_000;

interface ApiCall {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  body?: unknown;
}

interface ApiResult {
  status: number;
  body: {
    id?: string;
    items?: { id: string; name?: string; holderName?: string; isDeleted?: boolean }[];
  };
}

/**
 * One request on the signed-in context: the session cookie the login screen
 * set, and the antiforgery header the app itself sends. Works whatever page
 * the tab is on, so clean-up still runs after a failure.
 */
async function callApi(page: Page, call: ApiCall): Promise<ApiResult> {
  const cookies = await page.context().cookies();
  const xsrf = cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value;
  const res = await page.request.fetch(call.url, {
    method: call.method,
    data: call.body,
    headers: xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {},
  });
  const body: ApiResult["body"] = await res.json().catch(() => ({}));
  return { status: res.status(), body };
}

/** The branch the screens read and write: the header's, else the account's own. */
function workingBranchId(page: Page): string {
  return new URL(page.url()).searchParams.get("branchId") ?? FALLBACK_BRANCH;
}

/** One fixed group holds every run's service, so the runs do not pile up groups. */
async function ensureServiceGroup(page: Page, branchId: string): Promise<string> {
  const found = await callApi(page, {
    method: "GET",
    url: `/api/v1/app/taxonomies?ClinicBranchId=${branchId}&Group=care_service&Filter=${encodeURIComponent(SERVICE_GROUP)}&MaxResultCount=50`,
  });
  const existing = found.body.items?.find((item) => item.name === SERVICE_GROUP);
  if (existing) return existing.id;

  const created = await callApi(page, {
    method: "POST",
    url: "/api/v1/app/taxonomies",
    body: { clinicBranchId: branchId, group: "care_service", name: SERVICE_GROUP, sortOrder: 0 },
  });
  expect(created.status, "seeding the service group").toBe(200);
  return created.body.id!;
}

/** A run cut short leaves its service behind; the group is this spec's alone. */
async function sweepServiceGroup(page: Page, branchId: string, taxonomyId: string): Promise<void> {
  const entries = await callApi(page, {
    method: "GET",
    url: `/api/v1/app/catalog-entries?clinicBranchId=${branchId}&taxonomyId=${taxonomyId}&maxResultCount=200`,
  });
  for (const entry of entries.body.items ?? []) {
    if (entry.isDeleted) continue;
    await callApi(page, { method: "DELETE", url: `/api/v1/app/catalog-entries/${entry.id}` });
  }
}

interface SeededService {
  id: string;
  taxonomyId: string;
}

async function createService(page: Page, branchId: string, name: string): Promise<SeededService> {
  const taxonomyId = await ensureServiceGroup(page, branchId);
  await sweepServiceGroup(page, branchId, taxonomyId);

  const created = await callApi(page, {
    method: "POST",
    url: "/api/v1/app/catalog-entries",
    body: {
      clinicBranchId: branchId,
      taxonomyId,
      name,
      price: PRICE_BEFORE,
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
        laboSupplierIds: [],
      },
      stages: [],
    },
  });
  expect(created.status, "seeding the service").toBe(200);
  return { id: created.body.id!, taxonomyId };
}

/**
 * The service dialog sends no `isActive` on an update, so the server switches
 * the service off — a defect of the Danh mục dialog, reported rather than fixed
 * here. The plan picker lists active services only, so the spec switches it back
 * on through the API. That write never touches the browser's cache: whether the
 * picker shows the new price still depends on the Danh mục save invalidating it.
 */
async function reactivateService(
  page: Page,
  service: SeededService,
  name: string,
): Promise<void> {
  const res = await callApi(page, {
    method: "PUT",
    url: `/api/v1/app/catalog-entries/${service.id}`,
    body: {
      taxonomyId: service.taxonomyId,
      name,
      price: PRICE_AFTER,
      isActive: true,
      isDeleted: false,
      sortOrder: 0,
    },
  });
  expect(res.status, "switching the service back on").toBe(200);
}

/** "250.000 đ" → 250000. */
function money(text: string): number {
  return Number(text.replace(/[^\d]/g, ""));
}

/** Marks the document, so a later check can prove no reload happened in between. */
async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => Object.assign(window, { bdSameDocument: true }));
}

async function expectSameDocument(page: Page): Promise<void> {
  expect(await page.evaluate(() => "bdSameDocument" in window), "no reload since the mark").toBe(
    true,
  );
}

/** Danh mục through the header menu — a client-side route change, not a page load. */
async function openCatalogFromMenu(page: Page): Promise<void> {
  await page.locator('.app-nav-group[title="Vận hành"]').click();
  await page.locator('.app-ribbon-item[title="Danh mục"]').click();
  await expect(page).toHaveURL(/\/taxonomy/);
}

/**
 * The route a URL names, without `branchId` — the header writes that one in
 * with `replaceState` whenever a route settles, so it comes and goes.
 */
function routeOf(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("branchId");
  parsed.searchParams.sort();
  return `${parsed.pathname}?${parsed.searchParams}`;
}

/** Browser Back until `target` is on screen again; the history stays in one document. */
async function backTo(page: Page, target: string): Promise<void> {
  const route = routeOf(target);
  for (let step = 0; step < 6 && routeOf(page.url()) !== route; step++) await page.goBack();
  expect(routeOf(page.url())).toBe(route);
}

function openDropdown(page: Page, panel = ".ant-select-dropdown:not(.tp-service-dropdown)") {
  return page.locator(`${panel}:not(.ant-select-dropdown-hidden)`).last();
}

/** Searches the slip dialog's service picker and returns the option for `name`. */
async function searchService(page: Page, dialog: Locator, name: string): Promise<Locator> {
  const picker = dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ });
  await picker.click();
  await picker.fill(name);
  const option = openDropdown(page, ".tp-service-dropdown")
    .locator(".ant-select-item-option:has(.tp-opt-service)")
    .filter({ hasText: name });
  await expect(option).toBeVisible({ timeout: 15_000 });
  return option;
}

function priceOf(option: Locator): Promise<number> {
  return option.locator(".tp-opt-price").innerText().then(money);
}

/** The corner ✕ rather than Escape, which an open picker or tooltip may swallow. */
async function closeDialog(dialog: Locator): Promise<void> {
  await dialog.locator(".ant-modal-close").click();
  await expect(dialog).toBeHidden();
}

/** Plan detail of the slip scenario A saves, for scenario B to collect against. */
let planUrl = "";

// Each scenario walks three screens and a dialog twice over.
test.describe.configure({ mode: "serial", timeout: 120_000 });

test.describe("Dữ liệu dùng chung giữa các màn hình", () => {
  test("a price changed in Danh mục shows in the treatment-plan service picker without a reload", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/patient");
    const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
    await expect(firstName).toBeVisible();
    const serviceName = `DV CACHE ${runId()}`;
    const service = await createService(page, workingBranchId(page), serviceName);
    const serviceId = service.id;

    try {
      await firstName.click();
      await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
      await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
      const createButton = page.getByRole("button", { name: "Tạo kế hoạch mới" });
      await expect(createButton).toBeVisible();
      const planTabUrl = page.url();
      await markDocument(page);

      // Fill the picker's cache with the price as it stands.
      await createButton.click();
      let dialog = page.getByRole("dialog", { name: "Tạo phiếu dịch vụ" });
      const primed = await searchService(page, dialog, serviceName);
      await expect.poll(() => priceOf(primed)).toBe(PRICE_BEFORE);
      await closeDialog(dialog);

      // Change it in Danh mục.
      await openCatalogFromMenu(page);
      await page.locator("#taxonomy-group-search").fill(SERVICE_GROUP);
      await page.getByRole("button", { name: SERVICE_GROUP, exact: true }).click();
      await expect(page.getByRole("heading", { name: SERVICE_GROUP })).toBeVisible();
      await page.getByRole("textbox", { name: /Tìm theo tên dịch vụ/ }).fill(serviceName);
      await page.getByRole("button", { name: `Chỉnh sửa ${serviceName}` }).click();
      const serviceDialog = page.getByRole("dialog");
      await serviceDialog.getByLabel(/^Giá$/).fill(String(PRICE_AFTER));
      const saved = page.waitForResponse(
        (res) => res.url().includes("/api/v1/app/catalog-entries/") && res.request().method() === "PUT",
      );
      await serviceDialog.getByRole("button", { name: /Lưu$/ }).click();
      expect((await saved).ok()).toBeTruthy();
      // With partner sync switched on the dialog stays open to offer sending the
      // saved service; otherwise it closes by itself.
      const syncOffer = serviceDialog.getByRole("button", { name: /Đồng bộ dịch vụ này/ });
      await expect
        .poll(async () => (await syncOffer.isVisible()) || !(await serviceDialog.isVisible()))
        .toBe(true);
      if (await syncOffer.isVisible()) await closeDialog(serviceDialog);
      await expect(serviceDialog).toBeHidden();
      await reactivateService(page, service, serviceName);

      // Back on the record, the picker offers the new price.
      await backTo(page, planTabUrl);
      await expectSameDocument(page);
      const before = await page.locator(".tp-table .tp-code").allTextContents();
      await createButton.click();
      dialog = page.getByRole("dialog", { name: "Tạo phiếu dịch vụ" });
      const option = await searchService(page, dialog, serviceName);
      await expect.poll(() => priceOf(option), { timeout: 15_000 }).toBe(PRICE_AFTER);
      await expectSameDocument(page);

      // Save the slip, so scenario B has money to collect.
      await option.click();
      await dialog.getByRole("combobox", { name: /Nhân sự tư vấn 1/ }).click();
      await openDropdown(page).locator(".ant-select-item-option").first().click();
      await dialog.locator(".tp-tooth-btn").click();
      const teeth = page.getByRole("dialog", { name: "Chọn răng" });
      await teeth.getByRole("button", { name: "Răng 14", exact: true }).click();
      await teeth.locator(".tp-teeth-foot button").click();
      await expect(teeth).toBeHidden();
      await dialog.getByRole("button", { name: "Lưu" }).click();
      await expect(dialog).toBeHidden();

      const unseen = async () =>
        (await page.locator(".tp-table .tp-code").allTextContents()).find(
          (code) => !before.includes(code),
        ) ?? "";
      await expect.poll(unseen, { timeout: 15_000 }).toMatch(/^DT\d+$/);
      await page.locator(".tp-table .tp-code", { hasText: await unseen() }).click();
      await expect(page).toHaveURL(/\/treatment-plan\/[0-9a-f-]{36}/);
      planUrl = page.url().split("?")[0];
    } finally {
      await callApi(page, { method: "DELETE", url: `/api/v1/app/catalog-entries/${serviceId}` });
    }
  });

  test("a payment account added in Danh mục is offered by the payment dialog without a reload", async ({
    page,
  }) => {
    expect(planUrl, "scenario A saves the slip this one collects against").not.toBe("");
    await login(page);
    await page.goto(planUrl);
    const holder = `CACHE MOMO ${runId()}`;

    try {
      await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
      await expect(page).toHaveURL(/planTab=payment-v2/);
      const paymentTabUrl = page.url();
      await markDocument(page);

      // Fill the dialog's account cache before the account exists.
      await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
      let dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
      const listed = page.waitForResponse(
        (res) => res.url().includes("/api/v1/app/payment-accounts") && res.url().includes("kind=1"),
      );
      await dialog.locator(".pd-newpay-methods button", { hasText: "Ví momo" }).click();
      expect((await listed).ok()).toBeTruthy();
      await expect(dialog.locator(".pd-newpay-accrow", { hasText: holder })).toHaveCount(0);
      await closeDialog(dialog);

      // Add the account in Danh mục / Phương thức thanh toán.
      await openCatalogFromMenu(page);
      await page.getByRole("link", { name: "Phương thức thanh toán" }).click();
      await page.getByRole("button", { name: "Thêm phương thức" }).click();
      const accountDialog = page.getByRole("dialog");
      await accountDialog.getByLabel(/Số điện thoại/).fill(`09${runId()}`);
      await accountDialog.getByLabel(/Tên chủ tài khoản/).fill(holder);
      await accountDialog.getByRole("button", { name: "Lưu" }).click();
      await expect(accountDialog).toBeHidden();
      await expect(page.getByRole("row", { name: new RegExp(holder) })).toBeVisible();

      // Back on the slip, the new account can be chosen.
      await backTo(page, paymentTabUrl);
      await expectSameDocument(page);
      await page.getByRole("button", { name: "Tạo Phiếu Thanh Toán" }).click();
      dialog = page.getByRole("dialog", { name: "Tạo phiếu thanh toán" });
      await dialog.locator(".pd-newpay-methods button", { hasText: "Ví momo" }).click();
      const row = dialog.locator(".pd-newpay-accrow", { hasText: holder });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.click();
      await expect(row.locator("input[type=radio]")).toBeChecked();
      await expectSameDocument(page);
      await closeDialog(dialog);
    } finally {
      const accounts = await callApi(page, {
        method: "GET",
        url: "/api/v1/app/payment-accounts?kind=1&maxResultCount=100",
      });
      const created = accounts.body.items?.find((item) => item.holderName === holder);
      if (created) {
        await callApi(page, { method: "DELETE", url: `/api/v1/app/payment-accounts/${created.id}` });
      }
    }
  });
});
