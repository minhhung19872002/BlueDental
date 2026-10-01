import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Feature: e-invoices (EasyInvoice) and the billing invoice lifecycle.
 *
 * Every call is a real HTTP request from inside the logged-in page (cookie
 * session + antiforgery header, like the app's axios client) against the real
 * API and database — nothing is intercepted. No call here reaches the
 * EasyInvoice provider: drafts are read, configs are saved, invoices voided.
 */

interface ApiResult {
  status: number;
  body: {
    error?: { code?: string };
    id?: string;
    items?: Record<string, unknown>[];
    hasPassword?: boolean;
    password?: unknown;
    passwordCipher?: unknown;
    isActive?: boolean;
    name?: string;
    status?: number;
    lines?: unknown[];
    numberings?: unknown[];
    isConfigured?: boolean;
  };
}

async function call(
  page: Page,
  url: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; json?: unknown } = {},
): Promise<ApiResult> {
  return page.evaluate(
    async ({ url, options }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json",
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      if (options.json !== undefined) headers["content-type"] = "application/json";
      const res = await fetch(url, {
        method: options.method ?? "GET",
        credentials: "include",
        headers,
        body: options.json === undefined ? undefined : JSON.stringify(options.json),
      });
      const text = await res.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
      return { status: res.status, body: body as ApiResult["body"] };
    },
    { url, options },
  );
}

const CONFIGS = "/api/v1/app/e-invoice-configs";
const EINVOICES = "/api/v1/app/e-invoices";
const INVOICES = "/api/v1/app/invoices";

async function firstBranchId(page: Page): Promise<string> {
  const res = await call(page, "/api/v1/app/clinic-branches/accessible");
  expect(res.status).toBe(200);
  const items = (Array.isArray(res.body) ? res.body : res.body.items) as { id: string }[];
  expect(items.length, "admin should reach at least one branch").toBeGreaterThan(0);
  return items[0].id;
}

function configInput(branchId: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    clinicBranchId: branchId,
    name,
    appId: null,
    username: "e2e-user",
    password: "e2e-not-a-real-password",
    taxCode: "0100000000-001",
    taxByService: false,
    taxByPeriod: false,
    isActive: false,
    ...overrides,
  };
}

test.describe("e-invoice configs — real API", () => {
  test("create, read without the password, keep it on a blank update, delete", async ({ page }) => {
    await login(page);
    const branchId = await firstBranchId(page);
    const name = `E2E EInvoice ${runId()}`;

    const created = await call(page, CONFIGS, { method: "POST", json: configInput(branchId, name) });
    expect(created.status).toBe(200);
    expect(created.body.hasPassword).toBe(true);
    expect(created.body.password).toBeUndefined();
    expect(created.body.passwordCipher).toBeUndefined();
    const id = created.body.id!;

    try {
      // A separate request sees the saved row.
      const list = await call(page, `${CONFIGS}?clinicBranchId=${branchId}`);
      expect(list.status).toBe(200);
      const row = list.body.items!.find((c) => c.id === id);
      expect(row?.name).toBe(name);
      expect(JSON.stringify(row)).not.toContain("e2e-not-a-real-password");

      // Blank password on update keeps the stored one.
      const updated = await call(page, `${CONFIGS}/${id}`, {
        method: "PUT",
        json: configInput(branchId, `${name} v2`, { password: "" }),
      });
      expect(updated.status).toBe(200);
      expect(updated.body.hasPassword).toBe(true);
      expect(updated.body.name).toBe(`${name} v2`);

      // A new config needs a password.
      const noPassword = await call(page, CONFIGS, {
        method: "POST",
        json: configInput(branchId, `${name} nopw`, { password: "" }),
      });
      expect(noPassword.status).toBeGreaterThanOrEqual(400);
      expect(noPassword.body.error?.code).toBe("BlueDental:EInvoicing:0013");
    } finally {
      const deleted = await call(page, `${CONFIGS}/${id}`, { method: "DELETE" });
      expect(deleted.status).toBeLessThan(300);
    }

    const after = await call(page, `${CONFIGS}?clinicBranchId=${branchId}`);
    expect(after.body.items!.some((c) => c.id === id)).toBe(false);
  });

  test("a branch keeps at most one active config", async ({ page }) => {
    await login(page);
    const branchId = await firstBranchId(page);
    const existing = await call(page, `${CONFIGS}?clinicBranchId=${branchId}`);
    const alreadyActive = existing.body.items!.some((c) => c.isActive === true);
    const mine: string[] = [];

    try {
      if (!alreadyActive) {
        const first = await call(page, CONFIGS, {
          method: "POST",
          json: configInput(branchId, `E2E active ${runId()}`, { isActive: true }),
        });
        expect(first.status).toBe(200);
        mine.push(first.body.id!);
      }

      const second = await call(page, CONFIGS, {
        method: "POST",
        json: configInput(branchId, `E2E clash ${runId()}`, { isActive: true }),
      });
      if (second.body.id) mine.push(second.body.id);
      expect(second.status).toBeGreaterThanOrEqual(400);
      expect(second.body.error?.code).toBe("BlueDental:EInvoicing:0008");
    } finally {
      for (const id of mine) await call(page, `${CONFIGS}/${id}`, { method: "DELETE" });
    }
  });
});

test.describe("e-invoice draft — real API", () => {
  test("the draft needs exactly one source and lists the slip's lines", async ({ page }) => {
    await login(page);

    const none = await call(page, `${EINVOICES}/draft`);
    expect(none.status).toBeGreaterThanOrEqual(400);
    expect(none.body.error?.code).toBe("BlueDental:EInvoicing:0011");

    const plans = await call(page, "/api/v1/app/patient-treatments?maxResultCount=20");
    const plan = plans.body.items?.find(
      (p) => Array.isArray(p.services) && (p.services as unknown[]).length > 0,
    );
    test.skip(!plan, "no treatment slip with services in the local seed");

    const draft = await call(page, `${EINVOICES}/draft?treatmentPlanId=${plan!.id as string}`);
    expect(draft.status).toBe(200);
    expect(Array.isArray(draft.body.lines)).toBe(true);
    expect(typeof draft.body.isConfigured).toBe("boolean");
    expect(Array.isArray(draft.body.numberings)).toBe(true);

    // The dialog's currency fields are editable, but only VND at rate 1 is
    // issued — refused before anything reaches the provider.
    const usd = await call(page, `${EINVOICES}/issue`, {
      method: "POST",
      json: {
        treatmentPlanId: plan!.id,
        publish: false,
        paymentMethod: 1,
        currency: "USD",
        exchangeRate: 25000,
        lines: [],
      },
    });
    expect(usd.status).toBeGreaterThanOrEqual(400);
    expect(usd.body.error?.code).toBe("BlueDental:EInvoicing:0015");
  });
});

test.describe("billing invoice void — real API", () => {
  test("void needs a reason, then a voided invoice stays voided", async ({ page }) => {
    await login(page);
    const branchId = await firstBranchId(page);
    const patients = await call(page, "/api/v1/app/patients?maxResultCount=1");
    const patientId = patients.body.items?.[0]?.id as string | undefined;
    test.skip(!patientId, "no patient in the local seed");

    const created = await call(page, INVOICES, {
      method: "POST",
      json: {
        patientId,
        branchId,
        subTotal: 100000,
        taxAmount: 0,
        discountAmount: 0,
        currency: "VND",
        dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      },
    });
    expect(created.status).toBe(200);
    const id = created.body.id!;

    const blank = await call(page, `${INVOICES}/${id}/void`, { method: "POST", json: { reason: "  " } });
    expect(blank.status).toBe(400);
    expect((await call(page, `${INVOICES}/${id}`)).body.status).toBe(1);

    const voided = await call(page, `${INVOICES}/${id}/void`, {
      method: "POST",
      json: { reason: "E2E void" },
    });
    expect(voided.status).toBe(200);
    expect((await call(page, `${INVOICES}/${id}`)).body.status).toBe(6);

    const again = await call(page, `${INVOICES}/${id}/void`, {
      method: "POST",
      json: { reason: "E2E void again" },
    });
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(again.body.error?.code).toBe("BlueDental:Billing:0002");
  });
});

test.describe("Công cụ › Hóa đơn › Cấu hình — real UI", () => {
  test("a config made in the dialog survives a reload", async ({ page }) => {
    await login(page);
    const name = `E2E UI EInvoice ${runId()}`;

    await page.goto("/tools/invoice");
    await page.getByRole("button", { name: "Tạo cấu hình" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Tên", exact: true }).fill(name);
    await dialog.getByRole("textbox", { name: "App ID" }).fill("e2e-app");
    await dialog.getByRole("textbox", { name: "Mã số thuế" }).fill("0100000000-002");
    await dialog.getByRole("textbox", { name: "Tên đăng nhập" }).fill("e2e-ui");
    await dialog.getByLabel("Mật khẩu").fill("e2e-ui-not-real");
    await dialog.getByRole("switch", { name: "Tính thuế theo dịch vụ" }).click();
    // Inactive, so it never clashes with the branch's live account.
    await dialog.getByRole("switch", { name: "Trạng thái" }).click();
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã tạo cấu hình")).toBeVisible();

    await page.reload();
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    // Clean up through the real delete dialog.
    await row.getByRole("button", { name: `Xoá ${name}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Xóa|Xoá/ }).last().click();
    await expect(row).toHaveCount(0);
  });
});
