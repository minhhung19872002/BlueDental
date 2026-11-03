import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * R-1136 (owner, 2026-11-03): Danh mục > Dịch vụ, tab "Bảo hành" carries a
 * rich-text "Nội dung bảo hành" box under the period — text only, no image or
 * video buttons. What is typed is saved with the service, read back after a
 * reload, and an emptied box clears it.
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted.
 */

const TAXONOMIES = "/api/v1/app/taxonomies";
const ENTRIES = "/api/v1/app/catalog-entries";
const BRANCH = "11111111-1111-1111-1111-111111111111";

interface Reply<T> {
  status: number;
  body: T;
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
          "Accept-Language": "vi",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await fetch(url, init);
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : {}) as never };
    },
    { method, url, body, branch: BRANCH },
  );
}

interface Entry {
  id: string;
  serviceConfig: { warrantyDays: number; warrantyContent: string | null } | null;
}

async function storedContent(page: Page, id: string) {
  const res = await call<Entry>(page, "GET", `${ENTRIES}/${id}`);
  expect(res.status).toBe(200);
  return res.body.serviceConfig?.warrantyContent ?? null;
}

async function openWarrantyTab(page: Page, name: string) {
  await page.getByRole("button", { name: `Chỉnh sửa ${name}` }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Cập nhật dịch vụ" });
  await dialog.getByRole("tab", { name: "Bảo hành" }).click();
  const box = dialog.locator(".bd-svc-warranty-content");
  await expect(box.getByText("Nội dung bảo hành", { exact: true })).toBeVisible();
  return { dialog, box, editor: box.locator(".ql-editor") };
}

test.describe("Danh mục > Dịch vụ — Nội dung bảo hành (R-1136)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/taxonomy/service");
  });

  test("typed terms are saved, survive a reload, and an emptied box clears them", async ({ page }) => {
    const id = runId();
    const group = await call<{ id: string }>(page, "POST", TAXONOMIES, {
      clinicBranchId: BRANCH, group: "care_service", name: `DUNG-TEST Bảo hành ${id}`, sortOrder: 0,
    });
    expect(group.status).toBe(200);
    const name = `DUNG-TEST Dịch vụ BH ${id}`;
    const created = await call<Entry>(page, "POST", ENTRIES, {
      clinicBranchId: BRANCH, taxonomyId: group.body.id, name, price: 500000, sortOrder: 0,
      serviceConfig: {
        taxRate: 0, priceIncludesTax: false, discountIsPercent: true, discountValue: 0,
        requireImage: false, deductDoctorOnWarranty: false, separateRevenue: false,
        showToothOnInvoice: false, revenueByStage: false, requireStageSequence: false,
        warrantyDays: 365, laboSupplierIds: [],
      },
    });
    expect(created.status).toBe(200);
    expect(await storedContent(page, created.body.id)).toBeNull();

    await page.goto(`/taxonomy/service?group=${group.body.id}`);
    let { dialog, box, editor } = await openWarrantyTab(page, name);

    // Text only: the toolbar has formatting but no picture or video button.
    await expect(box.locator(".ql-toolbar .ql-bold")).toBeVisible();
    await expect(box.locator(".ql-toolbar .ql-image")).toHaveCount(0);
    await expect(box.locator(".ql-toolbar .ql-video")).toHaveCount(0);

    await editor.click();
    await page.keyboard.type("Bảo hành 12 tháng ");
    await page.keyboard.press("Control+B");
    await page.keyboard.type("trừ va đập");
    const saved = page.waitForResponse(
      (res) => res.request().method() === "PUT" && res.url().includes(`${ENTRIES}/${created.body.id}`),
    );
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    expect((await saved).status()).toBe(200);
    await expect(dialog).toBeHidden();

    // Quill 2 writes typed spaces as &nbsp; — every rich-text body here does.
    const html = (await storedContent(page, created.body.id))?.replace(/&nbsp;/g, " ");
    expect(html).toContain("Bảo hành 12 tháng");
    expect(html).toMatch(/<strong>trừ va đập<\/strong>/);

    // A separate read after a reload shows what was stored, bold included.
    await page.reload();
    ({ dialog, box, editor } = await openWarrantyTab(page, name));
    await expect(editor).toContainText("Bảo hành 12 tháng trừ va đập");
    await expect(editor.locator("strong")).toHaveText("trừ va đập");
    // The period beside it is untouched.
    await expect(dialog.getByRole("checkbox", { name: "Bảo hành 1 năm" })).toBeChecked();

    // Emptied, the box stores nothing — not an empty paragraph.
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    await expect(dialog).toBeHidden();
    expect(await storedContent(page, created.body.id)).toBeNull();
  });

  test("a save that leaves the terms out (as the Excel import does) keeps them", async ({ page }) => {
    const id = runId();
    const group = await call<{ id: string }>(page, "POST", TAXONOMIES, {
      clinicBranchId: BRANCH, group: "care_service", name: `DUNG-TEST Bảo hành giữ ${id}`, sortOrder: 0,
    });
    const config = {
      taxRate: 0, priceIncludesTax: false, discountIsPercent: true, discountValue: 0,
      requireImage: false, deductDoctorOnWarranty: false, separateRevenue: false,
      showToothOnInvoice: false, revenueByStage: false, requireStageSequence: false,
      warrantyDays: 30, laboSupplierIds: [],
    };
    const name = `DUNG-TEST Dịch vụ BH giữ ${id}`;
    const created = await call<Entry>(page, "POST", ENTRIES, {
      clinicBranchId: BRANCH, taxonomyId: group.body.id, name, price: 100000, sortOrder: 0,
      serviceConfig: { ...config, warrantyContent: "<p>Điều khoản gốc</p>" },
    });
    expect(created.status).toBe(200);
    expect(await storedContent(page, created.body.id)).toBe("<p>Điều khoản gốc</p>");

    const updated = await call(page, "PUT", `${ENTRIES}/${created.body.id}`, {
      taxonomyId: group.body.id, name, price: 100000, sortOrder: 0, isActive: true, isDeleted: false,
      serviceConfig: { ...config, warrantyDays: 90 },
    });
    expect(updated.status).toBe(200);
    expect(await storedContent(page, created.body.id)).toBe("<p>Điều khoản gốc</p>");
  });
});
