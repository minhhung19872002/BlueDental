import { expect, test, type Browser, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

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
 *  - "Tạo kế hoạch mới" needs `treatmentConsultation.create`, the leaf the
 *    server reads at `POST patient-treatments` (R-467 gated it on a subject
 *    that does not exist, so the button was hidden from everyone).
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
  "treatmentConsultation.create",
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
  await dialog.getByLabel(/Chi nhánh/).click();
  await page.locator(`.ant-select-item-option[title="${MAIN_BRANCH}"]`).click();
  await dialog.getByLabel(/Họ và tên/).click();
  await dialog.getByRole("button", { name: /Lưu/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("row").filter({ hasText: fullName })).toBeVisible();
}

async function deleteDentist(page: Page, fullName: string) {
  await page.goto("/staff");
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
  test("Hóa đơn, Lịch sử dư nợ, Kế hoạch điều trị and Tạo kế hoạch mới", async ({
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

      // ── Tư vấn > Thêm is the leaf the server reads at POST ───────────────
      await setDentistLeaf(page, "treatmentConsultation.create", true);
      await dentist.goto(withTab(path, "treatment-plan"));
      await expect(dentist.getByRole("button", { name: "Tạo kế hoạch mới" })).toBeVisible();
    } finally {
      await context.close();
      await resetDentistLeaves(page);
      await deleteDentist(page, fullName);
    }
  });
});
