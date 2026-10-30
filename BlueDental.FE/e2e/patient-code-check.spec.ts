import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";

/**
 * Feature: Tạo hồ sơ → "Mã khách hàng" typed by the desk (BA 2026-10-29).
 *
 * The box opens empty — no suggested next code any more — and once it loses
 * focus the typed code is checked against every record, the rule the save
 * applies (one code across all branches). A taken code is flagged under the
 * box before the rest of the form is filled.
 *
 * Every call is a real HTTP request from inside the logged-in page, with the
 * cookie the real login left and the antiforgery token the server set. Nothing
 * is intercepted, no token is injected, the database is the real one.
 */

const PATIENTS = "/api/v1/app/patients";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const DUPLICATE_CODE = "BlueDental:Patient:0002";
const CODE_TAKEN = "Mã khách hàng đã tồn tại";

interface ApiResult<T> {
  status: number;
  body: T & { error?: { code?: string; message?: string } };
}

/** One request from the logged-in page: cookie session + antiforgery header. */
async function send<T>(
  page: Page,
  method: "GET" | "POST",
  url: string,
  payload?: unknown,
  branchHeader?: string,
): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ method, url, payload, branchHeader }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json",
        "accept-language": "vi",
        ...(payload !== undefined ? { "content-type": "application/json" } : {}),
        ...(branchHeader ? { "X-Clinic-Branch-Id": branchHeader } : {}),
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      const text = await res.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
      return { status: res.status, body: body as never };
    },
    { method, url, payload, branchHeader },
  );
}

/** The greyed half of the code this year, e.g. "DH26". */
async function codePrefix(page: Page): Promise<string> {
  const estimate = await send<{ prefix: string }>(page, "GET", `${PATIENTS}/code-estimate`, undefined, BRANCH_ONE);
  expect(estimate.status).toBe(200);
  return estimate.body.prefix;
}

function checkCode(page: Page, code: string, options: { excludeId?: string; branch?: string } = {}) {
  const query = new URLSearchParams({ code, ...(options.excludeId ? { excludeId: options.excludeId } : {}) });
  return send<{ exists: boolean }>(page, "GET", `${PATIENTS}/check-code?${query}`, undefined, options.branch);
}

function register(page: Page, code: string, name: string, phone: string, branch?: string) {
  return send<{ id: string; patientCode: string }>(
    page,
    "POST",
    PATIENTS,
    { firstName: name, lastName: "E2E Mã", gender: 1, phoneNumber: phone, patientCode: code },
    branch,
  );
}

test.describe("Mã khách hàng typed and checked on blur (real stack)", () => {
  test("the check answers the same as the save: free, taken, own code, blank, other branch", async ({ browser }) => {
    const id = runId();

    const page = await browser.newPage();
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    const code = `${await codePrefix(page)}9${id}`;
    expect((await checkCode(page, code, { branch: BRANCH_ONE })).body).toEqual({ exists: false });

    const holder = await register(page, code, `Giữ ${id}`, `09${id}71`, BRANCH_ONE);
    expect(holder.status, JSON.stringify(holder.body)).toBe(200);
    expect(holder.body.patientCode).toBe(code);

    expect((await checkCode(page, code, { branch: BRANCH_ONE })).body).toEqual({ exists: true });
    // The record being edited does not collide with its own code.
    expect((await checkCode(page, code, { excludeId: holder.body.id, branch: BRANCH_ONE })).body).toEqual({
      exists: false,
    });
    expect((await checkCode(page, "", { branch: BRANCH_ONE })).body).toEqual({ exists: false });

    const second = await register(page, code, `Trùng ${id}`, `09${id}72`, BRANCH_ONE);
    expect(second.status).toBe(403);
    expect(second.body.error?.code).toBe(DUPLICATE_CODE);
    await page.close();

    // One code across every branch: branch two hears "taken" and its save is refused too.
    const branchPage = await browser.newPage();
    await login(branchPage, BRANCH2_USER);
    await branchPage.goto("/patient");
    expect((await checkCode(branchPage, code)).body).toEqual({ exists: true });
    const elsewhere = await register(branchPage, code, `Khác ${id}`, `09${id}73`);
    expect(elsewhere.status).toBe(403);
    expect(elsewhere.body.error?.code).toBe(DUPLICATE_CODE);
    await branchPage.close();
  });

  test("the box opens empty, a taken code is flagged on blur, a free one saves and survives a reload", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);

    const id = runId();
    const prefix = await codePrefix(page);
    const holder = await register(page, `${prefix}9${id}`, `Giữ UI ${id}`, `09${id}81`, BRANCH_ONE);
    expect(holder.status, JSON.stringify(holder.body)).toBe(200);

    await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Tạo hồ sơ" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo hồ sơ" });
    await expect(dialog).toBeVisible();

    // No suggested code: the prefix shows, the digits are left to the desk.
    const codeBox = dialog.getByRole("textbox", { name: "Phần số mã khách hàng" });
    await expect(dialog.locator(".bd-patient-codeprefix")).toHaveText(prefix);
    await expect(codeBox).toHaveValue("");

    const error = dialog.locator(".ant-form-item-explain-error", { hasText: CODE_TAKEN });

    // Typing alone asks nothing; leaving the box does.
    await codeBox.fill(`9${id}`);
    await expect(error).toHaveCount(0);
    await dialog.getByRole("textbox", { name: "Họ và tên *" }).focus();
    await expect(error).toBeVisible();

    // Editing clears the flag; a free code passes its own blur.
    const freeCode = `${prefix}8${id}`;
    await codeBox.fill(`8${id}`);
    await expect(error).toHaveCount(0);
    await dialog.getByRole("textbox", { name: "Họ và tên *" }).fill(`E2E ${id} Mã UI`);
    await expect(error).toHaveCount(0);

    await dialog.getByRole("textbox", { name: "Điện thoại *" }).fill(`09${id}82`);
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText(`[${freeCode}]`).first()).toBeVisible();
    expect((await checkCode(page, freeCode, { branch: BRANCH_ONE })).body).toEqual({ exists: true });
  });
});
