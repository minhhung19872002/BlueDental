import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { createSlipViaApi } from "./fixtures/ledgerReceipt";

/**
 * R-1207 — "Chuyển đổi dịch vụ" counts a whole jaw once. The reference stores
 * "Nguyên hàm" as one tooth code, so a 32.000.000 đ line on it converts at
 * 32.000.000 đ, while 17, 16, 15 is three times the price. BlueDental keeps the
 * jaw as its 32 teeth; before the fix a Hai hàm line at 24.000.000 đ read
 * 768.000.000 đ in the dialog and was saved so.
 *
 * R-1208 — the hồ sơ treatment table's SL prints 1 on a Hai hàm công đoạn, as
 * the reference does for "Nguyên hàm".
 *
 * Real stack: real login, real API, real PostgreSQL; the fixtures are written
 * through the API with the browser's own session, nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";
const PLANS = "/api/v1/app/patient-treatments";
const STAGES = "/api/v1/app/treatment-stages";
const BOTH_JAWS = [11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28,
  31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48];
const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;
const whole = (toothCode: number) =>
  ({ toothCode, selected: true, top: false, right: false, bottom: false, left: false, center: false });

interface Reply {
  status: number;
  json: Record<string, unknown> | null;
  text: string;
}

interface PlanLine {
  id: string;
  serviceId: string;
  serviceName: string | null;
  price: number;
  quantity: number;
  grossAmount: number;
  effectiveAmount: number;
  replacedId: string | null;
}

/** One API call from inside the page, with the session, the antiforgery and the branch header. */
async function api(page: Page, method: "GET" | "POST", url: string, body?: unknown): Promise<Reply> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let json: Record<string, unknown> | null;
      try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
      } catch {
        json = null; // a non-JSON body: the status and the text tell
      }
      return { status: res.status, json, text };
    },
    { method, url, body, branch: BRANCH },
  );
}

async function linesOf(page: Page, planId: string): Promise<PlanLine[]> {
  const plan = await api(page, "GET", `${PLANS}/${planId}`);
  expect(plan.status, plan.text).toBe(200);
  return (plan.json as { services: PlanLine[] }).services;
}

/** A patient of its own and a one-line slip on `teeth`. */
async function slipOn(page: Page, teeth: number[], label: string) {
  const suffix = runId();
  const patient = await api(page, "POST", "/api/v1/app/patients", {
    firstName: `${label} ${suffix}`,
    lastName: "E2E",
    dateOfBirth: null,
    gender: "male",
    phoneNumber: `0388${suffix}`,
  });
  expect(patient.status, patient.text).toBe(200);
  const patientId = String(patient.json?.id);
  const slip = await createSlipViaApi(page, patientId, teeth);
  const [line] = await linesOf(page, slip.id);
  return { patientId, slip, line };
}

/** Chuyển đổi → Dịch vụ cũ on the slip's only line, up to the point of Lưu. */
async function openOldServiceConversion(page: Page, patientId: string, planId: string) {
  await page.goto(`/patient/${patientId}/treatment-plan/${planId}?branchId=${BRANCH}`);
  const row = page.locator(".pdt-table tbody tr.ant-table-row").first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.locator(".pdt-status-trigger").click();
  await page.getByRole("menuitem", { name: "Chuyển đổi" }).click();
  const dialog = page.getByRole("dialog", { name: "Chuyển đổi dịch vụ" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: "Dịch vụ cũ" }).check();
  return dialog;
}

/** Ghi chú and both required staff pickers, then Lưu; returns once the POST came back. */
async function fillAndSave(page: Page, dialog: ReturnType<Page["getByRole"]>, note: string): Promise<void> {
  await dialog.getByRole("textbox", { name: /Ghi chú/ }).fill(note);
  for (const label of ["Bác sĩ chẩn đoán 1", "Nhân sự tư vấn 1"]) {
    await dialog.getByRole("combobox", { name: label }).click();
    const first = page
      .locator(".ant-select-dropdown:not(.tp-service-dropdown):not(.ant-select-dropdown-hidden)")
      .last()
      .locator(".ant-select-item-option")
      .first();
    await expect(first).toBeVisible();
    await first.click();
  }
  const converted = page.waitForResponse(
    (res) => res.url().includes("/convert") && res.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Lưu" }).click();
  const reply = await converted;
  expect(reply.ok(), await reply.text()).toBeTruthy();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 950 });
  await login(page);
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
});

test("Hai hàm converts at one price, and its công đoạn reads SL 1", async ({ page }) => {
  test.setTimeout(180_000);
  const { patientId, slip, line } = await slipOn(page, BOTH_JAWS, "Chuyển đổi hai hàm");
  expect(line.quantity).toBe(1);

  // ── R-1208: a Hai hàm công đoạn is one unit in the hồ sơ treatment table ─
  const staff = await api(page, "GET", "/api/v1/app/staff?MaxResultCount=1&Role=1");
  const staffId = (staff.json as { items: { id: string }[] }).items[0].id;
  const stage = await api(page, "POST", STAGES, {
    patientId,
    clinicBranchId: BRANCH,
    treatmentId: slip.id,
    treatmentServiceId: line.id,
    serviceId: line.serviceId,
    name: line.serviceName || "e2e",
    note: "R-1208 công đoạn hai hàm",
    staffId,
    teeth: BOTH_JAWS.map(whole),
  });
  expect(stage.status, stage.text).toBe(200);

  await page.goto(`/patient/${patientId}?branchId=${BRANCH}&tab=profile`);
  const table = page.locator(".pd-treatment-table");
  const stageRow = table.locator(`tbody tr[data-row-key="${line.id}:${String(stage.json?.id)}"]`);
  await expect(stageRow).toBeVisible({ timeout: 20_000 });
  const heads = await table.locator("thead th").allInnerTexts();
  const slAt = heads.indexOf("SL");
  expect(slAt, heads.join(" | ")).toBeGreaterThan(0);
  await expect(stageRow.locator("td").nth(slAt)).toHaveText("1");

  // ── R-1207: Dịch vụ cũ on Hai hàm — Tổng tiền is the price once, not ×32 ─
  const dialog = await openOldServiceConversion(page, patientId, slip.id);
  await expect(dialog.locator(".cvt-teeth")).toContainText("Hai hàm");
  const facts = dialog.locator(".cvt-section").last().locator(".cvt-fact-value");
  // Tổng tiền, Giảm giá, Đã thanh toán, Hoàn trả chênh lệch, Còn lại.
  await expect(facts).toHaveText([money(slip.price), money(0), money(0), money(0), money(slip.price)]);
  await expect(dialog).not.toContainText(money(slip.price * 32));

  await fillAndSave(page, dialog, "R-1207 hai hàm một đơn vị");

  // Read back on its own request: the new line holds the jaw once, at the price.
  const lines = await linesOf(page, slip.id);
  const closed = lines.find((item) => item.id === line.id);
  const replacement = lines.find((item) => item.id === closed?.replacedId);
  expect(replacement, JSON.stringify(lines)).toBeDefined();
  expect(replacement!.price).toBe(slip.price);
  expect(replacement!.quantity).toBe(1);
  expect(replacement!.grossAmount).toBe(slip.price);
  expect(replacement!.effectiveAmount).toBe(slip.price);

  // And the slip table, reloaded, prints it so.
  await page.reload();
  const newRow = page.locator(`.pdt-table tbody tr.ant-table-row[data-row-key="${replacement!.id}"]`);
  await expect(newRow).toContainText(money(slip.price), { timeout: 20_000 });
  await expect(newRow).not.toContainText(money(slip.price * 32));
});

test("single teeth still multiply: 17, 16, 15 converts at three times the price", async ({ page }) => {
  test.setTimeout(180_000);
  const { patientId, slip, line } = await slipOn(page, [17, 16, 15], "Chuyển đổi ba răng");

  const dialog = await openOldServiceConversion(page, patientId, slip.id);
  await expect(dialog.locator(".cvt-teeth")).not.toContainText("hàm");
  const facts = dialog.locator(".cvt-section").last().locator(".cvt-fact-value");
  const total = slip.price * 3;
  await expect(facts).toHaveText([money(total), money(0), money(0), money(0), money(total)]);

  await fillAndSave(page, dialog, "R-1207 ba răng lẻ");

  const lines = await linesOf(page, slip.id);
  const closed = lines.find((item) => item.id === line.id);
  const replacement = lines.find((item) => item.id === closed?.replacedId);
  expect(replacement, JSON.stringify(lines)).toBeDefined();
  expect(replacement!.price).toBe(slip.price);
  expect(replacement!.quantity).toBe(3);
  expect(replacement!.effectiveAmount).toBe(total);
});
