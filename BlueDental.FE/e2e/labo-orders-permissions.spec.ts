import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { findLaboPatient, seedLaboOrder } from "./fixtures/laboSeed";
import {
  createDentist,
  deleteDentist,
  openDentistSession,
  resetDentistLeaves,
  setDentistLeaf,
} from "./fixtures/restrictedDentist";

/**
 * Feature: Labo → Mẫu Labo — which buttons a user sees, by permission leaf
 * (docs/clone/pages/labo.md §2.6; R-532, reworked by P2910_03 / F-85):
 *
 *  - `laboTemplate:read`   — the list, the eye, "In Phiếu Labo" and Đóng;
 *  - `appointment:create`  — "Tạo Lịch Hẹn Mới" in the detail's footer;
 *  - `laboTemplate:export` — Xuất Excel (never granted here, so never shown).
 *
 * Since F-85 every step of an order runs in the patient record's Labo
 * dialog (labo-workflow.spec.ts covers its treatmentLabo leaves), so
 * `treatmentLabo:create` and `laboTemplate:update` no longer add anything
 * here: no plus, no shield, no Trạng thái select, no "Tải ảnh" well, no Lưu.
 *
 * Real stack: a dentist is created through the Nhân sự dialog, the admin
 * grants leaves one at a time on Cài đặt → Phân quyền, and the dentist's
 * own cookie session reloads Mẫu Labo after each grant. Nothing is
 * intercepted, no token is injected.
 */

const LEAVES = ["laboTemplate.read", "treatmentLabo.create", "appointment.create", "laboTemplate.update"];

/** The row whose Mã phiếu cell is exactly this code. */
function rowWithCode(page: Page, code: string) {
  return page
    .locator(".bd-labo-screen tbody tr.ant-table-row")
    .filter({ has: page.locator("td", { hasText: new RegExp(`^${code}$`) }) })
    .first();
}

/** The aria-labels of the row's Thao tác buttons, in order. */
function actionNames(row: Locator) {
  return row.locator(".pd-icon-actions .ant-btn").evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-label")),
  );
}

/** Reloads Mẫu Labo, so the session picks up the leaves granted since. */
async function reopenList(page: Page, code: string) {
  await page.goto("/labo/mau-labo");
  await assertRealApiTraffic(page, "/api/v1/app/labo-orders");
  const row = rowWithCode(page, code);
  await expect(row).toBeVisible();
  return row;
}

async function openDetail(page: Page, row: Locator) {
  await row.getByRole("button", { name: "Xem", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Thông tin chung" });
  await expect(detail).toBeVisible();
  return detail;
}

/** The footer's buttons, by text, in order. */
function footerButtons(detail: Locator) {
  return detail.locator(".pd-labo-detail-footer .ant-btn");
}

async function closeDetail(page: Page, detail: Locator) {
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
}

test.describe("Mẫu Labo — buttons by permission leaf", () => {
  test("the eye and the detail's footer follow their leaves; the workflow leaves add nothing", async ({
    page,
    browser,
  }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1600, height: 900 });

    const id = runId();
    const userName = `bslabo${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI LABO ${id}`;

    await login(page);
    const target = await findLaboPatient(page);
    const seeded = await seedLaboOrder(page, target, id);

    await resetDentistLeaves(page, LEAVES);
    await createDentist(page, fullName, userName, password);
    await setDentistLeaf(page, "laboTemplate.read", true);

    const dentist = await openDentistSession(browser, userName, password);
    try {
      // ── laboTemplate:read only: the eye, In Phiếu Labo, Đóng ─────────────
      let row = await reopenList(dentist.page, seeded.orderCode);
      expect(await actionNames(row)).toEqual(["Xem"]);
      await expect(dentist.page.getByRole("button", { name: "Xuất Excel" })).toHaveCount(0);

      let detail = await openDetail(dentist.page, row);
      await expect(detail.getByLabel("Trạng thái", { exact: true })).toHaveCount(0);
      await expect(detail.locator(".pd-labo-well")).toHaveCount(0);
      await expect(footerButtons(detail)).toHaveText(["In Phiếu Labo", "Đóng"]);
      // The letterhead comes from the accessible-branch list, which any
      // signed-in user may read — so the sheet prints for a labo reader too.
      await expect(footerButtons(detail).first()).toBeEnabled();
      await closeDetail(dentist.page, detail);

      // ── + treatmentLabo:create: still the eye alone on Mẫu Labo ──────────
      await setDentistLeaf(page, "treatmentLabo.create", true);
      row = await reopenList(dentist.page, seeded.orderCode);
      expect(await actionNames(row)).toEqual(["Xem"]);

      // ── + appointment:create: Tạo Lịch Hẹn Mới joins the footer ──────────
      await setDentistLeaf(page, "appointment.create", true);
      row = await reopenList(dentist.page, seeded.orderCode);
      detail = await openDetail(dentist.page, row);
      await expect(footerButtons(detail)).toHaveText(["In Phiếu Labo", "Tạo Lịch Hẹn Mới", "Đóng"]);
      await closeDetail(dentist.page, detail);

      // ── + laboTemplate:update: nothing to edit here any more ─────────────
      await setDentistLeaf(page, "laboTemplate.update", true);
      row = await reopenList(dentist.page, seeded.orderCode);
      expect(await actionNames(row)).toEqual(["Xem"]);
      detail = await openDetail(dentist.page, row);
      await expect(detail.getByLabel("Trạng thái", { exact: true })).toHaveCount(0);
      await expect(detail.locator(".pd-labo-well")).toHaveCount(0);
      await expect(footerButtons(detail)).toHaveText(["In Phiếu Labo", "Tạo Lịch Hẹn Mới", "Đóng"]);
      await closeDetail(dentist.page, detail);
    } finally {
      await dentist.context.close();
      await resetDentistLeaves(page, LEAVES);
      await deleteDentist(page, fullName);
    }
  });
});
