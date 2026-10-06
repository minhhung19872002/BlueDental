import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import {
  BRANCH_ONE,
  COMBO,
  ENTRIES,
  TAX_EIGHT,
  call,
  config,
  createGroup,
  createSingle,
  getEntry,
  type Entry,
} from "./fixtures/catalogApi";

/**
 * Feature: a Danh mục combo (F-48, BA 2026-10-06) sold to a patient. The
 * combo is one catalogue entry, so wherever a service is picked it lands as
 * **one** line priced by the combo, never as its component services.
 *
 * - Tạo kế hoạch mới (and the server behind it) prices the line at the
 *   catalogue price, i.e. Giá combo.
 * - Chọn Dịch Vụ on Chẩn đoán & Tư vấn starts the line at "Giá sau giảm",
 *   `serviceConfig.priceAfterDiscount`.
 *
 * The combo is "Sau thuế 8 %" at 900.000 đ, the case where the two differ
 * (900.000 / 1,08 = 833.333 đ), so each path is told apart.
 *
 * Real stack: real login, real API, real PostgreSQL; nothing is intercepted.
 */

const PLANS = "/api/v1/app/patient-treatments";
const COMBO_PRICE = 900_000;

interface Slip {
  id: string;
  code: string;
  services: { serviceId: string; serviceName: string | null; price: number; originalPrice: number; quantity: number }[];
}

interface ComboFixture {
  combo: Entry;
  parts: string[];
}

/** 900000 → "900.000", the way the app prints it. */
function vnd(value: number): string {
  return Math.round(value).toLocaleString("vi-VN");
}

/** Two single services and a "Sau thuế 8 %" combo of them, typed at 900.000 đ. */
async function seedCombo(page: Page, id: string): Promise<ComboFixture> {
  await page.goto("/taxonomy/service");
  await assertRealApiTraffic(page, ENTRIES);
  const groupId = await createGroup(page, BRANCH_ONE, `Nhóm combo KH ${id}`);
  const scaling = await createSingle(page, groupId, `Cạo vôi KH ${id}`, 300_000);
  const filling = await createSingle(page, groupId, `Trám răng KH ${id}`, 500_000);
  const created = await call<Entry>(page, "POST", ENTRIES, {
    taxonomyId: groupId,
    name: `Combo KH ${id}`,
    price: COMBO_PRICE,
    unit: "Combo",
    serviceConfig: config(COMBO, TAX_EIGHT, true),
    comboItems: [
      { componentEntryId: scaling.id, quantity: 2, unitAmount: 250_000 },
      { componentEntryId: filling.id, quantity: 1, unitAmount: 500_000 },
    ],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  const combo = await getEntry(page, created.body.id);
  expect(combo.price).toBe(COMBO_PRICE);
  expect(Math.round(combo.serviceConfig?.priceAfterDiscount ?? 0)).toBe(833_333);
  return { combo, parts: [scaling.name, filling.name] };
}

/** GET with the branch header the app itself sends. */
async function getAsBranch<T>(page: Page, url: string): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ({ target, branch }) => {
      const res = await fetch(target, {
        credentials: "include",
        headers: { accept: "application/json", "X-Clinic-Branch-Id": branch },
      });
      return { status: res.status, body: (await res.json()) as never };
    },
    { target: url, branch: BRANCH_ONE },
  );
}

async function openFirstPatient(page: Page): Promise<string> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
  await expect(firstName).toBeVisible();
  await firstName.click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  return page.url().split("?")[0].split("/").pop() ?? "";
}

/** The AntD dropdown that is actually open; closed ones stay in the DOM. */
function openDropdown(page: Page, panel = ".ant-select-dropdown:not(.tp-service-dropdown)"): Locator {
  return page.locator(`${panel}:not(.ant-select-dropdown-hidden)`).last();
}

test.describe("Kế hoạch điều trị — combo dịch vụ", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await login(page);
  });

  test("Tạo kế hoạch mới takes a combo as one line at Giá combo, and it survives a reload", async ({ page }) => {
    const id = runId();
    const { combo, parts } = await seedCombo(page, id);
    const patientId = await openFirstPatient(page);

    const listed = page.waitForResponse((res) => res.url().includes(PLANS) && res.request().method() === "GET");
    await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
    expect((await listed).ok()).toBeTruthy();

    await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo phiếu dịch vụ" });
    await expect(dialog).toBeVisible();

    const consultant = dialog.getByRole("combobox", { name: /Nhân sự tư vấn 1/ });
    await consultant.click();
    await openDropdown(page).locator(".ant-select-item-option").first().click();

    // The picker searches the server; the run id matches the combo and both its parts.
    const picker = dialog.getByRole("combobox", { name: /Thêm dịch vụ mới/ });
    await picker.click();
    await picker.fill(`KH ${id}`);
    const options = openDropdown(page, ".tp-service-dropdown").locator(".ant-select-item-option:has(.tp-opt-service)");
    await expect(options).toHaveCount(3);
    const comboOption = options.filter({ hasText: combo.name });
    await expect(comboOption.locator(".tp-opt-price")).toHaveText(`${vnd(COMBO_PRICE)} đ`);
    await comboOption.click();

    // One service, one unit, at the combo's own price — not the parts' 1.100.000 đ.
    await expect(dialog.getByRole("textbox", { name: "Đơn giá" })).toHaveValue(vnd(COMBO_PRICE));
    await expect(dialog.getByRole("spinbutton", { name: "Số lượng" })).toHaveValue("1");

    await dialog.locator(".tp-tooth-btn").click();
    const teeth = page.getByRole("dialog", { name: "Chọn răng" });
    await teeth.getByRole("button", { name: "Răng 14", exact: true }).click();
    await teeth.locator(".tp-teeth-foot button").click();
    await expect(teeth).toBeHidden();

    const opened = page.waitForResponse((res) => res.url().endsWith(PLANS) && res.request().method() === "POST");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    const response = await opened;
    expect(response.ok()).toBeTruthy();
    const slip = (await response.json()) as Slip;
    await expect(dialog).toBeHidden();

    // A separate request reads the slip back: exactly one line, the combo itself.
    const stored = await getAsBranch<Slip>(page, `${PLANS}/${slip.id}`);
    expect(stored.status).toBe(200);
    expect(stored.body.services).toHaveLength(1);
    const [line] = stored.body.services;
    expect(line.serviceId).toBe(combo.id);
    expect(line.serviceName).toBe(combo.name);
    expect(line.quantity).toBe(1);
    expect(line.price).toBe(COMBO_PRICE);
    expect(line.originalPrice).toBe(COMBO_PRICE);
    for (const part of parts) expect(stored.body.services.some((s) => s.serviceName === part)).toBe(false);

    // After a reload the slip is listed and opens on that single line.
    await page.goto(`/patient/${patientId}?tab=treatment-plan&branchId=${BRANCH_ONE}`);
    const row = page.locator(".tp-table tr.ant-table-row", { hasText: slip.code });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.locator(".tp-code").click();
    await expect(page).toHaveURL(new RegExp(slip.id));
    await expect(page.getByText(combo.name).first()).toBeVisible();
    for (const part of parts) await expect(page.getByText(part)).toHaveCount(0);
  });

  test("Chọn Dịch Vụ on Tư vấn takes a combo as one line at its Giá sau giảm", async ({ page }) => {
    const id = runId();
    const { combo } = await seedCombo(page, id);
    const salePrice = combo.serviceConfig?.priceAfterDiscount ?? 0;

    // A fresh diagnosis slip on a branch-1 patient to hang the consulting line on.
    const slip = await page.evaluate(
      async ({ branch, note }) => {
        const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
        const get = async (url: string) => (await fetch(url, { credentials: "include", headers })).json();
        const patient = (await get("/api/v1/app/patients?maxResultCount=1")).items[0];
        const diagnosis = (
          await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=1`)
        ).items[0];
        const staff = (await get("/api/v1/app/staff?MaxResultCount=1")).items[0];
        const res = await fetch("/api/v1/app/patient-diagnoses", {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            patientId: patient.id,
            clinicBranchId: branch,
            diagnosisId: diagnosis.id,
            staffId: staff.id,
            note,
            teeth: [{ toothCode: 36, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
          }),
        });
        if (!res.ok) return { error: `diagnosis ${res.status} ${await res.text()}` };
        const made = await res.json();
        return { patientId: patient.id as string, code: made.code as string };
      },
      { branch: BRANCH_ONE, note: `e2e combo tư vấn ${id}` },
    );
    expect("error" in slip ? slip.error : null, "the diagnosis slip should be written").toBeNull();
    const { patientId, code } = slip as { patientId: string; code: string };

    await page.goto(`/patient/${patientId}?branchId=${BRANCH_ONE}&tab=consulting`);
    const slipRow = page.locator(".pd-diagnosis-card tbody tr.ant-table-row", { hasText: code });
    await expect(slipRow).toBeVisible({ timeout: 20_000 });
    await slipRow.getByRole("button", { name: "Tạo Dịch Vụ" }).click();
    const dialog = page.getByRole("dialog", { name: /Chọn Dịch Vụ/ });
    await expect(dialog).toBeVisible();

    const searched = page.waitForResponse(
      (res) => res.url().includes(ENTRIES) && res.url().includes("filter="),
    );
    await dialog.getByPlaceholder("Tìm dịch vụ").fill(combo.name);
    expect((await searched).ok()).toBeTruthy();
    const row = dialog.locator(".am-table tbody tr", { hasText: combo.name });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(vnd(salePrice));
    await row.getByRole("checkbox").check();

    const posts: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/v1/app/patient-advises")) posts.push(req.postData() ?? "");
    });
    const created = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes("/api/v1/app/patient-advises"),
    );
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    const response = await created;
    expect(response.ok()).toBeTruthy();
    await expect(dialog).toBeHidden();

    // One line for the whole combo, priced at Giá sau giảm.
    expect(posts).toHaveLength(1);
    const body = JSON.parse(posts[0]) as { serviceId: string; originalPrice: number; price: number; quantity: number };
    expect(body.serviceId).toBe(combo.id);
    expect(body.quantity).toBe(1);
    expect(body.price).toBeCloseTo(salePrice, 2);
    expect(body.originalPrice).toBeCloseTo(salePrice, 2);

    const advise = (await response.json()) as { id: string };
    const stored = await getAsBranch<{ serviceId: string; price: number }>(page, `/api/v1/app/patient-advises/${advise.id}`);
    expect(stored.status).toBe(200);
    expect(stored.body.serviceId).toBe(combo.id);
    expect(stored.body.price).toBeCloseTo(salePrice, 2);

    // It is still there, alone, after a reload.
    await page.reload();
    const line = page.locator(".pd-advise-table tbody tr.ant-table-row", { hasText: combo.name });
    await expect(line).toHaveCount(1, { timeout: 20_000 });
  });
});
