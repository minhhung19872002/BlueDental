import { expect, test, type Browser, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { createSlipViaApi } from "./fixtures/ledgerReceipt";
import { currentUserId } from "./fixtures/treatingSlip";

/**
 * Feature: the Bệnh nhân record follows the ability leaves.
 *
 * Runs against the real stack only — a dentist created through the Nhân sự
 * dialog, in a second real cookie session, with leaves toggled on the Phân
 * quyền tab by admin. Nothing is stubbed and no token is injected.
 *
 * What it proves, one leaf at a time:
 *
 *  - Hóa đơn **and** Lịch sử dư nợ are the same `payment.read` — the ledger
 *    tab used to stay behind while its sibling went;
 *  - Kế hoạch điều trị and Chẩn đoán & Tư vấn need `treatmentConsultation
 *    .read`, which the slip list is checked against server-side;
 *  - the patient tab offers no "Tạo kế hoạch mới" to anyone (owner
 *    2026-10-15); its dialog opens from "Thêm dịch vụ phát sinh" on a slip,
 *    which needs `treatmentConsultation.update`, the leaf the server reads at
 *    `POST patient-treatments/{id}/services`.
 *
 * The seeded `dentist` role carries no grants; every leaf is reset at the
 * start and again at the end.
 */

const DENTIST_ROLE = "dentist";
const MAIN_BRANCH = "Nha Khoa Đức Hạnh Premium";
const LEAVES = [
  "patient.read",
  "payment.read",
  "treatmentConsultation.read",
  "treatmentConsultation.update",
] as const;
type Leaf = (typeof LEAVES)[number];

/** The tab strip of the record, so "Hồ sơ" is not matched in the page body. */
const tabs = (page: Page) => page.getByRole("navigation", { name: "Chi tiết bệnh nhân" });
const tab = (page: Page, name: string) => tabs(page).getByRole("link", { name, exact: true });

async function setDentistLeaf(page: Page, leaf: Leaf, granted: boolean) {
  await page.goto("/settings?tab=permission");
  await page.locator(".perm-role-item").filter({ hasText: DENTIST_ROLE }).click();
  await expect(page.locator(".perm-editor-title")).toHaveText(DENTIST_ROLE);

  await page.getByPlaceholder("Tìm quyền...").fill(leaf);
  const leaves = page.locator(".perm-leaf");
  await expect(leaves).toHaveCount(1);
  const box = leaves.locator('input[type="checkbox"]');
  if ((await box.isChecked()) === granted) return;

  await box.click();
  await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
  await expect(page.getByText("Lưu quyền thành công")).toBeVisible();
  await expect(box).toBeChecked({ checked: granted });
}

async function resetDentistLeaves(page: Page) {
  for (const leaf of LEAVES) await setDentistLeaf(page, leaf, false);
}

async function createDentist(page: Page, fullName: string, userName: string, password: string) {
  await page.goto("/staff");
  await assertRealApiTraffic(page, "/api/v1/app/staff");
  await page.getByRole("button", { name: /Tạo/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/Họ và tên/).fill(fullName);
  await dialog.getByLabel(/Email/).fill(`${userName}@bluedental.local`);
  await dialog.getByLabel(/^Mật khẩu/).fill(password);
  await dialog.getByLabel(/Nhập lại mật khẩu/).fill(password);
  await dialog.getByLabel(/Nhóm quyền/).click();
  await page.locator(`.ant-select-item-option[title="${DENTIST_ROLE}"]`).click();
  // By the seeded id: the select searches option values, and test runs pile
  // up branches that push this one out of the virtual list.
  await dialog.getByLabel(/Chi nhánh/).click();
  await dialog.getByLabel(/Chi nhánh/).fill("11111111-1111-1111-1111-111111111111");
  await page.locator(`.ant-select-item-option[title="${MAIN_BRANCH}"]`).click();
  await dialog.getByLabel(/Họ và tên/).click();
  await dialog.getByRole("button", { name: /Lưu/ }).click();
  await expect(dialog).toBeHidden();
  await page.getByPlaceholder("Tìm theo tên, email, số điện thoại...").fill(fullName);
  await expect(page.getByRole("row").filter({ hasText: fullName })).toBeVisible();
}

async function deleteDentist(page: Page, fullName: string) {
  await page.goto("/staff");
  await page.getByPlaceholder("Tìm theo tên, email, số điện thoại...").fill(fullName);
  const row = page.getByRole("row").filter({ hasText: fullName });
  await expect(row).toBeVisible();
  await row.getByRole("button").nth(1).click();
  const confirm = page.getByRole("dialog").filter({ hasText: "Xác nhận xoá" });
  await confirm.getByRole("button", { name: /Xoá$/ }).click();
  await expect(row).toHaveCount(0);
}

/**
 * A record this session may open, taken off the real list page.
 *
 * Not the raw list API: only the app's axios sends `X-Clinic-Branch-Id`, and
 * without it a branch-scoped list answers 403 whatever the leaves say.
 */
async function firstPatientPath(page: Page): Promise<string> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const first = page.locator('a[href^="/patient/"]').first();
  await expect(first).toBeVisible();
  const href = await first.getAttribute("href");
  expect(href).toBeTruthy();
  return href!;
}

/** The record path with a tab named on it, whatever query the href carries. */
const withTab = (path: string, name: string) =>
  `${path}${path.includes("?") ? "&" : "?"}tab=${name}`;

test.describe("Hồ sơ bệnh nhân — the tabs and their buttons follow the leaves", () => {
  test("Hóa đơn, Lịch sử dư nợ, Kế hoạch điều trị and Thêm dịch vụ phát sinh", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);

    const id = runId();
    const userName = `bs${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI ${id}`;

    await login(page);
    await resetDentistLeaves(page);
    await createDentist(page, fullName, userName, password);

    const context = await browser.newContext();
    const dentist = await context.newPage();
    try {
      await login(dentist, { userName, password });

      // ── only Khách hàng > Xem: the record opens, most tabs do not ────────
      await setDentistLeaf(page, "patient.read", true);
      await dentist.reload();
      const path = await firstPatientPath(dentist);
      await dentist.goto(path);
      await expect(tabs(dentist)).toBeVisible();

      await expect(tab(dentist, "Hồ sơ")).toBeVisible();
      await expect(tab(dentist, "Hóa đơn")).toHaveCount(0);
      await expect(tab(dentist, "Lịch sử dư nợ")).toHaveCount(0);
      await expect(tab(dentist, "Kế hoạch điều trị")).toHaveCount(0);
      await expect(tab(dentist, "Chẩn đoán & Tư vấn")).toHaveCount(0);

      // ── Thanh toán > Xem brings BOTH money tabs, not just Hóa đơn ────────
      await setDentistLeaf(page, "payment.read", true);
      await dentist.goto(path);
      await expect(tab(dentist, "Hóa đơn")).toBeVisible();
      await expect(tab(dentist, "Lịch sử dư nợ")).toBeVisible();
      await expect(tab(dentist, "Kế hoạch điều trị")).toHaveCount(0);

      // ── Tư vấn > Xem opens the slip tabs, still with no command ──────────
      await setDentistLeaf(page, "treatmentConsultation.read", true);
      await dentist.goto(withTab(path, "treatment-plan"));
      await expect(tab(dentist, "Kế hoạch điều trị")).toBeVisible();
      await expect(tab(dentist, "Chẩn đoán & Tư vấn")).toBeVisible();
      // The panel spins until the real slip list answers, so its own toolbar
      // being on screen is the list having loaded.
      await expect(dentist.getByRole("button", { name: "Xem tất cả dịch vụ" })).toBeVisible();
      await expect(dentist.getByRole("button", { name: "Tạo kế hoạch mới" })).toHaveCount(0);

      // A slip of this patient, written by admin, to open as the dentist. Its
      // "Bác sĩ tiếp nhận" is the dentist: without "Chi phí › Xem" a user
      // opens only the slips they received (BA P2010).
      const patientId = /\/patient\/([0-9a-f-]{36})/.exec(path)![1];
      const slip = await createSlipViaApi(page, patientId, [14], await currentUserId(dentist));
      const slipPath = `/patient/${patientId}/treatment-plan/${slip.id}`;
      const addExtra = dentist.locator(".pdt-toolbar").getByRole("button", { name: "Thêm dịch vụ phát sinh" });
      await dentist.goto(slipPath);
      await expect(dentist.locator(".pdt-crumb--current")).toHaveText(slip.code, { timeout: 20_000 });
      await expect(dentist.locator(".pdt-toolbar")).toBeVisible();
      await expect(addExtra).toHaveCount(0);

      // ── Tư vấn > Sửa is the leaf the server reads at POST …/services ─────
      await setDentistLeaf(page, "treatmentConsultation.update", true);
      await dentist.goto(slipPath);
      await expect(addExtra).toBeVisible({ timeout: 20_000 });
      await expect(dentist.getByRole("button", { name: "Tạo kế hoạch mới" })).toHaveCount(0);
    } finally {
      await context.close();
      await resetDentistLeaves(page);
      await deleteDentist(page, fullName);
    }
  });
});
