import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { purgeRunGroups } from "./fixtures/cleanup";

/**
 * Bug list item 36: the Dịch vụ, Chẩn đoán/Tư vấn and Nguồn đến/Lịch sử/Nghề
 * nghiệp dialogs sent no "isActive" once "Đang hoạt động / Đã xoá" became a
 * soft delete, so every Lưu switched the entry off while the dialog still
 * showed "Đang hoạt động ✓" — and the pickers, which list live entries only,
 * lost it ("Không tìm thấy dịch vụ" on Tạo kế hoạch mới).
 *
 * Rule now: an entry saved as "Đang hoạt động" is live; a request that leaves
 * "isActive" out keeps what is stored.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL. Every
 * check of what was saved is a separate read.
 */

const TAXONOMIES = "/api/v1/app/taxonomies";
const ENTRIES = "/api/v1/app/catalog-entries";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const LAST = 9999;

test.afterAll(async ({ browser }) => {
  await purgeRunGroups(browser, "care_service", ["NHOM ACTIVE"]);
  await purgeRunGroups(browser, "diagnosis", ["NHOM CD ACTIVE"]);
});

interface Entry {
  id: string;
  name: string;
  taxonomyId: string;
  isActive: boolean;
  isDeleted: boolean;
}

interface Reply<T> {
  status: number;
  body: T & { error?: { code?: string } };
}

async function call<T>(page: Page, method: string, url: string, body?: unknown): Promise<Reply<T>> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const init: RequestInit = {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await fetch(url, init);
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : {}) as never };
    },
    { method, url, body, branch: BRANCH_ONE },
  );
}

/**
 * The entry as the server holds it now. Read from the list, which keeps a
 * soft-deleted service on show; GET by id answers 404 for one.
 */
async function readEntry(page: Page, taxonomyId: string, id: string): Promise<Entry> {
  const res = await call<{ items: Entry[] }>(
    page,
    "GET",
    `${ENTRIES}?clinicBranchId=${BRANCH_ONE}&group=care_service&taxonomyId=${taxonomyId}&maxResultCount=50`,
  );
  expect(res.status).toBe(200);
  const entry = res.body.items.find((item) => item.id === id);
  expect(entry, "the entry should still be listed").toBeDefined();
  return entry!;
}

/** What the pickers ask for: live, not deleted, matching the typed name. */
async function pickerNames(page: Page, group: string, name: string): Promise<string[]> {
  const res = await call<{ items: Entry[] }>(
    page,
    "GET",
    `${ENTRIES}?clinicBranchId=${BRANCH_ONE}&group=${group}&isDeleted=false&isActive=true&filter=${encodeURIComponent(name)}&maxResultCount=50`,
  );
  expect(res.status).toBe(200);
  return res.body.items.map((item) => item.name);
}

async function createGroupInUi(page: Page, name: string) {
  await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Tên phân loại/).fill(name);
  await dialog.getByRole("button", { name: /Lưu$/ }).click();
  await expect(dialog).toBeHidden();
  // Creating a group selects it; an entry dialog opened before that lands
  // would default to whichever group was selected before.
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

/** Opens the row's edit dialog, saves it untouched and returns what the PUT answered. */
async function resaveInUi(page: Page, rowName: string): Promise<Entry> {
  await page.getByRole("row", { name: new RegExp(rowName) }).getByRole("button").nth(1).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("checkbox", { name: "Đang hoạt động" })).toBeChecked();

  const saved = page.waitForResponse(
    (res) => res.url().includes(ENTRIES) && res.request().method() === "PUT",
  );
  await dialog.getByRole("button", { name: /Lưu$/ }).click();
  const res = await saved;
  expect(res.ok()).toBeTruthy();
  await expect(dialog).toBeHidden();
  return (await res.json()) as Entry;
}

test.describe("Danh mục — trạng thái hoạt động (bug 36)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("API: a save as 'Đang hoạt động' keeps the entry live; a delete keeps what is stored", async ({ page }) => {
    await page.goto("/taxonomy/service");
    const id = runId();
    const group = await call<{ id: string }>(page, "POST", TAXONOMIES, {
      clinicBranchId: BRANCH_ONE, group: "care_service", name: `NHOM ACTIVE ${id}`, sortOrder: LAST,
    });
    expect(group.status).toBe(200);
    const name = `DV ACTIVE API ${id}`;
    const created = await call<Entry>(page, "POST", ENTRIES, { taxonomyId: group.body.id, name, price: 100000, sortOrder: 0 });
    expect(created.status).toBe(200);
    expect(created.body.isActive).toBe(true);

    const put = (body: Record<string, unknown>) =>
      call<Entry>(page, "PUT", `${ENTRIES}/${created.body.id}`, {
        taxonomyId: group.body.id, name, price: 100000, sortOrder: 0, ...body,
      });

    // The request the old dialogs sent: no "isActive" at all.
    expect((await put({ isDeleted: false })).status).toBe(200);
    expect((await readEntry(page, group.body.id, created.body.id)).isActive).toBe(true);

    // "Đang hoạt động" wins over a stray false.
    expect((await put({ isActive: false, isDeleted: false })).status).toBe(200);
    expect((await readEntry(page, group.body.id, created.body.id)).isActive).toBe(true);
    expect(await pickerNames(page, "care_service", name)).toContain(name);

    // Deleted with the flag switched off: both stay as sent…
    expect((await put({ isActive: false, isDeleted: true })).status).toBe(200);
    let stored = await readEntry(page, group.body.id, created.body.id);
    expect(stored).toMatchObject({ isActive: false, isDeleted: true });
    expect(await pickerNames(page, "care_service", name)).not.toContain(name);

    // …and bringing it back through the dialog makes it live again.
    expect((await put({ isActive: false, isDeleted: false })).status).toBe(200);
    stored = await readEntry(page, group.body.id, created.body.id);
    expect(stored).toMatchObject({ isActive: true, isDeleted: false });
    expect(await pickerNames(page, "care_service", name)).toContain(name);
  });

  test("UI: a service created and saved again is still offered on Tạo kế hoạch mới", async ({ page }) => {
    const id = runId();
    const name = `DV ACTIVE ${id}`;

    await page.goto("/taxonomy/service");
    await createGroupInUi(page, `NHOM ACTIVE ${id}`);

    await page.getByRole("button", { name: /Thêm dịch vụ/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: /^Dịch vụ/ }).fill(name);
    await dialog.getByLabel(/^Giá$/).fill("150000");
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    // QA step 3: open it again and Lưu without touching anything.
    const saved = await resaveInUi(page, name);
    expect(saved).toMatchObject({ isActive: true, isDeleted: false });
    await page.reload();
    expect((await readEntry(page, saved.taxonomyId, saved.id)).isActive).toBe(true);

    // QA step 2: the slip's service picker finds it by name.
    await page.goto("/patient");
    const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
    await expect(firstName).toBeVisible();
    await firstName.click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
    await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
    await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
    const slip = page.getByRole("dialog", { name: "Tạo phiếu dịch vụ" });
    await expect(slip).toBeVisible();

    await slip.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
    await page.keyboard.type(name);
    const option = page
      .locator(".tp-service-dropdown:not(.ant-select-dropdown-hidden)")
      .last()
      .locator(".ant-select-item-option .tp-opt-name", { hasText: name });
    await expect(option).toBeVisible({ timeout: 15_000 });
  });

  test("UI: a diagnosis saved again stays live", async ({ page }) => {
    const id = runId();
    const name = `CD ACTIVE ${id}`;

    await page.goto("/taxonomy/diagnosis");
    await createGroupInUi(page, `NHOM CD ACTIVE ${id}`);

    await page.getByRole("button", { name: /Thêm chẩn đoán$/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Tên chẩn đoán/).fill(name);
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    const saved = await resaveInUi(page, name);
    expect(saved.isActive).toBe(true);
    expect(await pickerNames(page, "diagnosis", name)).toContain(name);
  });
});
