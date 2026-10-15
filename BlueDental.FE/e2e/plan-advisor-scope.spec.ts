import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { addExtraService, openExtraServiceDialog } from "./fixtures/extraService";
import { createSlipViaApi, openDropdown } from "./fixtures/ledgerReceipt";
import { call, createRunStaff, deleteStaff, RUN_STAFF_PASSWORD, type RunStaff } from "./fixtures/timekeepingStaff";

/**
 * R-954 (BA 2026-10-15): on "Thêm dịch vụ" the "Bác sĩ tư vấn" picker offers
 * only dentists, narrowed to the signed-in dentist's part of the Sơ đồ tổ chức,
 * the signed-in dentist first and the rest by "Mức độ ưu tiên".
 *
 * Real stack only: a run team (head H, members D and lễ tân N) and a dentist O
 * outside it are made through the real API; D signs in through the login
 * screen, adds a service to a fresh slip and the saved line names D after a
 * reload.
 */

const ORG = "/api/v1/app/org-chart";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const ROOT_ID = "0f9a0000-0000-4000-8000-000000000001";
const DOCTOR_TEAM = 3;
const DETAIL_URL = /\/patient\/[0-9a-f-]{36}\/treatment-plan\/[0-9a-f-]{36}/;

test.describe.serial("Thêm dịch vụ — Bác sĩ tư vấn theo Sơ đồ tổ chức", () => {
  const run = `pa${runId()}`;
  let admin: Page;
  const staff: Record<"h" | "d" | "n" | "o", RunStaff> = {} as Record<"h" | "d" | "n" | "o", RunStaff>;
  let teamId = "";

  test.beforeAll(async ({ browser }) => {
    admin = await (await browser.newContext()).newPage();
    await login(admin);
    // H outranks D on "Mức độ ưu tiên", so D coming first is the signed-in rule, not the priority.
    staff.h = await createRunStaff(admin, BRANCH_ONE, `${run}h`, { name: `BS H ${run}`, isDentist: true, roleNames: ["admin"], priority: 1 });
    staff.d = await createRunStaff(admin, BRANCH_ONE, `${run}d`, { name: `BS D ${run}`, isDentist: true, roleNames: ["admin"], priority: 9 });
    staff.n = await createRunStaff(admin, BRANCH_ONE, `${run}n`, { name: `NV N ${run}` });
    staff.o = await createRunStaff(admin, BRANCH_ONE, `${run}o`, { name: `BS O ${run}`, isDentist: true, priority: 0 });
    const team = await call<{ id: string }>(admin, `${ORG}/units`, {
      method: "POST",
      branchId: BRANCH_ONE,
      json: { kind: DOCTOR_TEAM, name: `E2E Team TV ${run}`, parentId: ROOT_ID, headStaffId: staff.h.id, memberStaffIds: [staff.d.id, staff.n.id] },
    });
    expect(team.status, JSON.stringify(team.body.error)).toBe(200);
    teamId = team.body.id;
  });

  test.afterAll(async () => {
    if (teamId) await call(admin, `${ORG}/units/${teamId}`, { method: "DELETE", branchId: BRANCH_ONE });
    for (const s of Object.values(staff)) await deleteStaff(admin, s.id);
    await admin.context().close();
  });

  test("a member dentist is offered their own team's dentists, themselves first, and the saved line names them", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await context.newPage();
    await login(page, { userName: `tk-e2e-${run}d`, password: RUN_STAFF_PASSWORD });

    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
    const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
    await expect(firstName).toBeVisible();
    await firstName.click();
    await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
    const patientId = /\/patient\/([0-9a-f-]{36})/.exec(page.url())![1];
    // Opened by the admin through the real API — the fixture reads the patient without a branch header.
    const slip = await createSlipViaApi(admin, patientId);
    await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
    await page.locator(".tp-table .tp-code", { hasText: new RegExp(`^${slip.code}$`) }).click();
    await expect(page).toHaveURL(DETAIL_URL);
    const slipUrl = page.url().split("?")[0];

    const dialog = await openExtraServiceDialog(page);
    await expect(dialog.getByRole("combobox", { name: /Nhân sự tư vấn/ })).toHaveCount(0);
    await dialog.getByRole("combobox", { name: /Bác sĩ tư vấn(?! 2)/ }).click();
    const options = openDropdown(page).locator(".ant-select-item-option");
    // H heads the team, N is a lễ tân in it, O a dentist outside it.
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toContainText(`BS D ${run}`);
    await expect(options.nth(1)).toContainText(`BS H ${run}`);
    await page.keyboard.press("Escape");
    await page.locator(".tp-dialog .ant-modal-close").click();
    await expect(dialog).toBeHidden();

    // The fixture picks the first option: D.
    const { name } = await addExtraService(page, { except: slip.serviceName });
    await page.goto(slipUrl);
    const row = page.locator(".pdt-table tbody tr.ant-table-row", { has: page.locator(".pdt-service-name", { hasText: name }) });
    await expect(row).toContainText(`BS D ${run}`);

    // The column, the eye's "Chi tiết dịch vụ" and the pencil all say "Bác sĩ tư vấn".
    await expect(page.getByRole("columnheader", { name: "Bác sĩ tư vấn", exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Bác sĩ tư vấn 2", exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Nhân sự tư vấn/ })).toHaveCount(0);

    await row.getByRole("button", { name: "Xem chi tiết" }).click();
    const detail = page.getByRole("dialog", { name: "Chi tiết dịch vụ" });
    await expect(detail.locator(".pdt-detail-fact", { hasText: /^Bác sĩ tư vấn:/ })).toContainText(`BS D ${run}`);
    await expect(detail.locator(".pdt-detail-fact", { hasText: /^Bác sĩ tư vấn 2:/ })).toHaveCount(1);
    await expect(detail).not.toContainText("Nhân sự tư vấn");
    await detail.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(detail).toBeHidden();

    // Editing the line offers the same scoped dentists as the dialog, D first.
    await row.getByRole("button", { name: "Chỉnh sửa" }).click();
    const advisor = row.getByRole("combobox", { name: "Bác sĩ tư vấn", exact: true });
    await expect(row.getByRole("combobox", { name: /Nhân sự tư vấn|Tư vấn 1/ })).toHaveCount(0);
    await advisor.click();
    const editOptions = openDropdown(page).locator(".ant-select-item-option");
    await expect(editOptions).toHaveCount(2);
    await expect(editOptions.nth(0)).toContainText(`BS D ${run}`);
    await expect(editOptions.nth(1)).toContainText(`BS H ${run}`);
    await page.keyboard.press("Escape");
    await row.getByRole("combobox", { name: "Bác sĩ tư vấn 2", exact: true }).click();
    await expect(openDropdown(page).locator(".ant-select-item-option")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await context.close();
  });
});
