import { expect, test, type Locator, type Page } from "@playwright/test";
import { BRANCH2_USER, assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { CONNECTION_REFUSED, startPartnerSandbox, type PartnerSandbox } from "./fixtures/partnerSandbox";
import {
  createDentist,
  deleteDentist,
  openDentistSession,
  resetDentistLeaves,
  setDentistLeaf,
} from "./fixtures/restrictedDentist";
import { purgeRunGroups } from "./fixtures/cleanup";

// The groups this file creates carry a run id; leave none behind in the shared DB.
test.afterAll(async ({ browser }) => {
  await purgeRunGroups(browser, "care_service", ["ZZ Đồng bộ"]);
});

/**
 * Feature: Danh mục → Dịch vụ → "Đồng bộ danh mục dịch vụ" (reference:
 * staging.nfcdental.com, observed 2026-09-25 — docs/clone/pages/taxonomy.md).
 *
 * Real browser → real BlueDental API → real PostgreSQL. The only stand-in is
 * the partner system on the far side of the sync, which does not exist
 * locally; `partnerSandbox` runs one as a real HTTP server that the API calls
 * over the network. No BlueDental request is intercepted and no token is
 * injected: setup goes through the API from the logged-in page, with the
 * session cookie and antiforgery token the real login left.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const SYNC = `/api/v1/app/clinic-integration/sync/${BRANCH_ONE}`;
const CONNECTIONS = "/api/v1/app/connections";

interface ApiResult<T> {
  status: number;
  body: T;
}

interface Service {
  id: string;
  name: string;
  code: string;
}

interface SyncGroup {
  taxonomyId: string;
  services: { id: string; code: string | null; synced: boolean }[];
}

/** One JSON call from the logged-in page: cookie session + antiforgery header. */
async function call<T>(page: Page, method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ method, url, body }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.split("=")[1];
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : {} };
    },
    { method, url, body },
  );
}

async function connectBranchToSandbox(page: Page, sandbox: PartnerSandbox) {
  const existing = await call(page, "GET", `${CONNECTIONS}/${BRANCH_ONE}`);
  const saved =
    existing.status === 200
      ? await call(page, "PATCH", `${CONNECTIONS}/${BRANCH_ONE}`, { baseUrl: sandbox.url, apiKey: sandbox.apiKey })
      : await call(page, "POST", CONNECTIONS, { clinicBranchId: BRANCH_ONE, baseUrl: sandbox.url, apiKey: sandbox.apiKey });
  expect(saved.status).toBe(200);

  const handshake = await call<{ status: string }>(page, "POST", `${CONNECTIONS}/${BRANCH_ONE}/handshake`);
  expect(handshake.body.status).toBe("active");

  const flags = await call(page, "PATCH", `${CONNECTIONS}/${BRANCH_ONE}/sync-flags`, { serviceCatalogSyncEnabled: true });
  expect(flags.status).toBe(200);
}

async function createService(page: Page, taxonomyId: string, name: string, price: number): Promise<Service> {
  const res = await call<Service>(page, "POST", "/api/v1/app/catalog-entries", {
    clinicBranchId: BRANCH_ONE,
    taxonomyId,
    name,
    price,
  });
  expect(res.status).toBe(200);
  return res.body;
}

async function openSyncDialog(page: Page) {
  await page.getByRole("button", { name: "Đồng bộ danh mục dịch vụ" }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Chọn danh mục dịch vụ cần đồng bộ" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function syncGroup(
  page: Page,
  groupName: string,
  run: string,
  expectedCount: number,
  { watchTheWait = false }: { watchTheWait?: boolean } = {},
) {
  const dialog = await openSyncDialog(page);
  await dialog.getByRole("searchbox").fill(run);
  const groupTick = dialog.getByRole("checkbox", { name: `Chọn taxonomy ${groupName}` });
  await groupTick.check();
  await expect(dialog.getByText(`Đã chọn ${expectedCount} dịch vụ`)).toBeVisible();

  const answered = page.waitForResponse(
    (res) => res.url().includes(`${SYNC}/service-catalog`) && res.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Đồng bộ", exact: true }).click();

  if (watchTheWait) {
    // While the partner has not answered the dialog stays, says so, and
    // takes no more picks (CLAUDE.md §16.18).
    await expect(dialog.getByRole("button", { name: /Đang đồng bộ/ })).toBeDisabled();
    await expect(groupTick).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Huỷ" })).toBeDisabled();
    await expect(page.getByText(/Đã đồng bộ \d+\/\d+ dịch vụ/)).toHaveCount(0);
  }

  expect((await answered).status()).toBe(200);
  await expect(dialog).toBeHidden();

  const result = page.getByRole("dialog").filter({ hasText: "Kết quả đồng bộ danh mục dịch vụ" });
  await expect(result).toBeVisible();
  return result;
}

function tile(result: Locator, label: string) {
  return result.locator(".bd-sync-result__tile").filter({ hasText: label }).locator(".bd-sync-result__tile-value");
}

test.describe.serial("Danh mục → Đồng bộ danh mục dịch vụ", () => {
  const run = runId();
  const groupName = `ZZ Đồng bộ ${run}`;
  let sandbox: PartnerSandbox;
  let groupId = "";
  let plain: Service;
  let warned: Service;
  let duplicate: Service;

  test.beforeAll(async ({ browser }) => {
    sandbox = await startPartnerSandbox(`e2e-key-${run}`);
    const page = await browser.newPage();
    await login(page);
    await connectBranchToSandbox(page, sandbox);

    const group = await call<{ id: string }>(page, "POST", "/api/v1/app/taxonomies", {
      clinicBranchId: BRANCH_ONE,
      group: "care_service",
      name: groupName,
    });
    expect(group.status).toBe(200);
    groupId = group.body.id;

    plain = await createService(page, groupId, `Cạo vôi ${run}`, 300_000);
    warned = await createService(page, groupId, `Trám răng [warn] ${run}`, 450_000);
    duplicate = await createService(page, groupId, `Tẩy trắng ${run}`, 900_000);
    // The partner already holds this code on a record of its own.
    sandbox.seedCode(duplicate.code, "Tẩy trắng bên hệ thống");
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    // The branch is shared by every suite: do not leave it pointing at a sandbox that is about to go.
    const page = await browser.newPage();
    await login(page);
    await call(page, "PATCH", `${CONNECTIONS}/${BRANCH_ONE}/sync-flags`, { serviceCatalogSyncEnabled: false });
    await page.close();
    await sandbox.close();
  });

  test("a new service is given a five-character code by the server", () => {
    for (const service of [plain, warned, duplicate]) {
      expect(service.code).toMatch(/^[A-Za-z0-9]{5}$/);
    }
    expect(new Set([plain.code, warned.code, duplicate.code]).size).toBe(3);
  });

  test("a partner that refuses the link fails every service, under its own code, from both entry points", async ({ page }) => {
    // Staging, 2026-09-25: the flags still read "active", yet the partner
    // answered CLINIC_CONN_0001 and every picked service failed.
    sandbox.refuseConnection(true);
    try {
      await login(page);
      await page.goto(`/taxonomy/service?group=${groupId}&branchId=${BRANCH_ONE}`);

      const result = await syncGroup(page, groupName, run, 3);
      await expect(page.getByText("Đồng bộ thất bại: 0/3 dịch vụ được ghi nhận")).toBeVisible();
      await expect(result.getByText("Lỗi trong quá trình đồng bộ")).toBeVisible();
      await expect(
        result.getByText(`${CONNECTION_REFUSED.code} — ${CONNECTION_REFUSED.message}`),
      ).toBeVisible();
      await expect(tile(result, "Tổng cộng")).toHaveText("3");
      await expect(tile(result, "Đã gửi")).toHaveText("0");
      await expect(tile(result, "Thất bại")).toHaveText("3");
      await expect(result.getByText("Không có dữ liệu")).toBeVisible();
      await result.locator(".ant-modal-close").click();
      await expect(result).toBeHidden();

      // The single-service sync reports the same failure and, as on the
      // reference, the dialog still closes: the request itself succeeded.
      await page.getByRole("button", { name: `Chỉnh sửa ${plain.name}` }).click();
      const dialog = page.getByRole("dialog").filter({ hasText: "Cập nhật dịch vụ" });
      await dialog.getByLabel(/^Giá$/).fill("310000");
      await dialog.getByRole("button", { name: /Lưu/ }).click();
      await dialog.getByRole("button", { name: "Đồng bộ dịch vụ này" }).click();
      await expect(page.getByText("Đồng bộ thất bại: 0/1 dịch vụ được ghi nhận")).toBeVisible();
      await expect(dialog).toBeHidden();

      // Nothing was accepted, so nothing counts as synced.
      expect(sandbox.batches).toHaveLength(0);
      const groups = await call<SyncGroup[]>(page, "GET", `${SYNC}/service-catalog-groups`);
      const services = groups.body.find((group) => group.taxonomyId === groupId)?.services ?? [];
      expect(services.every((service) => !service.synced)).toBe(true);
    } finally {
      sandbox.refuseConnection(false);
    }
  });

  test("syncs a whole group and reports what the partner did with each service", async ({ page }) => {
    await login(page);
    await page.goto(`/taxonomy/service?group=${groupId}&branchId=${BRANCH_ONE}`);
    await assertRealApiTraffic(page, `${SYNC}/flags`);

    sandbox.answerAfter(1500);
    const result = await syncGroup(page, groupName, run, 3, { watchTheWait: true }).finally(() =>
      sandbox.answerAfter(0),
    );

    await expect(page.getByText("Đã đồng bộ 2/3 dịch vụ")).toBeVisible();
    await expect(tile(result, "Tổng cộng")).toHaveText("3");
    await expect(tile(result, "Đã gửi")).toHaveText("2");
    await expect(tile(result, "Trùng mã")).toHaveText("1");
    await expect(tile(result, "Cảnh báo")).toHaveText("1");

    // Opens on "Trùng mã" because there is one, naming both sides.
    const duplicateRow = result.getByRole("row", { name: new RegExp(duplicate.code) });
    await expect(duplicateRow).toContainText(duplicate.name);
    await expect(duplicateRow).toContainText("Tẩy trắng bên hệ thống");

    await result.locator(".ant-segmented").getByText("Cảnh báo", { exact: true }).click();
    await expect(result.getByRole("row", { name: new RegExp(warned.code) })).toContainText("Thiếu đơn vị tính");

    // What actually crossed the wire: one batch, our ids as external ids.
    expect(sandbox.batches).toHaveLength(1);
    expect(sandbox.batches[0].map((item) => item.externalId).sort()).toEqual(
      [plain.id, warned.id, duplicate.id].sort(),
    );
  });

  test("a resend of unchanged services sends only what the partner has not accepted", async ({ page }) => {
    await login(page);
    await page.goto(`/taxonomy/service?group=${groupId}&branchId=${BRANCH_ONE}`);

    const result = await syncGroup(page, groupName, run, 3);

    await expect(page.getByText("Không có thay đổi — 2/3 dịch vụ đã đồng bộ từ trước")).toBeVisible();
    await expect(tile(result, "Bỏ qua")).toHaveText("2");
    expect(sandbox.batches).toHaveLength(2);
    expect(sandbox.batches[1].map((item) => item.externalId)).toEqual([duplicate.id]);

    await result.locator(".ant-segmented").getByText("Đã đồng bộ trước", { exact: true }).click();
    await expect(result.getByRole("row", { name: new RegExp(plain.code) })).toBeVisible();
  });

  test("an edited service is sent again from its own dialog, and the sync state survives a reload", async ({ page }) => {
    await login(page);
    await page.goto(`/taxonomy/service?group=${groupId}&branchId=${BRANCH_ONE}`);

    await page.getByRole("button", { name: `Chỉnh sửa ${plain.name}` }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Cập nhật dịch vụ" });
    await expect(dialog.getByText("Lưu ý:")).toBeVisible();

    await dialog.getByLabel(/^Giá$/).fill("350000");
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    await expect(page.getByText("Đã cập nhật dịch vụ")).toBeVisible();

    // The reference keeps the dialog open and offers the sync in place of "Lưu".
    const syncThis = dialog.getByRole("button", { name: "Đồng bộ dịch vụ này" });
    await expect(syncThis).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Lưu/ })).toBeDisabled();
    await syncThis.click();

    await expect(page.getByText("Đã đồng bộ 1/1 dịch vụ")).toBeVisible();
    await expect(dialog).toBeHidden();
    const last = sandbox.batches.at(-1) ?? [];
    expect(last.map((item) => [item.externalId, item.price])).toEqual([[plain.id, 350000]]);

    await page.reload();
    const groups = await call<SyncGroup[]>(page, "GET", `${SYNC}/service-catalog-groups`);
    const services = groups.body.find((group) => group.taxonomyId === groupId)?.services ?? [];
    const synced = Object.fromEntries(services.map((service) => [service.id, service.synced]));
    expect(synced).toEqual({ [plain.id]: true, [warned.id]: true, [duplicate.id]: false });
  });

  test("another branch's account cannot read or sync this branch", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, BRANCH2_USER);

    expect((await call(page, "GET", `${SYNC}/flags`)).status).toBe(403);
    expect((await call(page, "POST", `${SYNC}/service-catalog`, { serviceIds: [plain.id] })).status).toBe(403);
    await context.close();
  });

  test("an account that may only read services gets no button and is refused by the API", async ({ page, browser }) => {
    test.slow();
    const fullName = `Nha sĩ đồng bộ ${run}`;
    const userName = `syncdentist${run}`;
    const password = "Dentist@123456";

    await login(page);
    await createDentist(page, fullName, userName, password);
    await setDentistLeaf(page, "catalogService.read", true);

    try {
      const dentist = await openDentistSession(browser, userName, password);
      await dentist.page.goto(`/taxonomy/service?branchId=${BRANCH_ONE}`);
      await expect(dentist.page.getByRole("heading", { name: "Danh mục", level: 1 })).toBeVisible();
      await expect(dentist.page.locator(".bd-cat-title")).toBeVisible();
      await expect(dentist.page.getByRole("button", { name: "Đồng bộ danh mục dịch vụ" })).toHaveCount(0);

      const refused = await call(dentist.page, "POST", `${SYNC}/service-catalog`, { serviceIds: [plain.id] });
      expect(refused.status).toBe(403);
      expect((await call(dentist.page, "GET", `${CONNECTIONS}/${BRANCH_ONE}`)).status).toBe(403);
      await dentist.context.close();
    } finally {
      await resetDentistLeaves(page, ["catalogService.read"]);
      await deleteDentist(page, fullName);
    }
  });

  test("switching the flag off takes the button away", async ({ page }) => {
    await login(page);
    await call(page, "PATCH", `${CONNECTIONS}/${BRANCH_ONE}/sync-flags`, { serviceCatalogSyncEnabled: false });

    await page.goto(`/taxonomy/service?group=${groupId}&branchId=${BRANCH_ONE}`);
    await assertRealApiTraffic(page, `${SYNC}/flags`);
    await expect(page.getByRole("button", { name: "Xuất" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Đồng bộ danh mục dịch vụ" })).toHaveCount(0);

    const refused = await call<{ error?: { code?: string } }>(page, "POST", `${SYNC}/service-catalog`, {
      serviceIds: [plain.id],
    });
    expect(refused.status).not.toBe(200);
    expect(refused.body.error?.code).toBe("BlueDental:ClinicIntegration:0004");
  });
});
