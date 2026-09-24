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
 * Feature: Labo → Mẫu Labo — which buttons a user sees, by permission leaf,
 * exactly as staging's bundle gates them (docs/clone/pages/labo.md §2.6;
 * R-532):
 *
 *  - `laboTemplate:read`   — the list, the eye, "In Phiếu Labo"; the Trạng
 *                            thái select is on screen but greyed;
 *  - `treatmentLabo:create` — the plus and the shield on the row;
 *  - `appointment:create`  — "Tạo Lịch Hẹn Mới" in the detail's footer;
 *  - `laboTemplate:update` — the select enabled, the "Tải ảnh" well, "Lưu";
 *  - `laboTemplate:export` — Xuất Excel (never granted here, so never shown).
 *
 * There is no Đóng in this footer, whatever the user holds.
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
  test("the eye, plus, shield, select, well and footer follow four leaves, as on staging", async ({
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
      // ── laboTemplate:read only: the eye, a greyed select, In Phiếu Labo ──
      let row = await reopenList(dentist.page, seeded.orderCode);
      expect(await actionNames(row)).toEqual(["Xem"]);
      await expect(dentist.page.getByRole("button", { name: "Xuất Excel" })).toHaveCount(0);

      let detail = await openDetail(dentist.page, row);
      const status = detail.getByLabel("Trạng thái", { exact: true });
      await expect(status).toBeVisible();
      await expect(status).toBeDisabled();
      await expect(detail.locator(".pd-labo-well")).toHaveCount(0);
      await expect(footerButtons(detail)).toHaveText(["In Phiếu Labo"]);
      // The letterhead comes from the accessible-branch list, which any
      // signed-in user may read — so the sheet prints for a labo reader too.
      await expect(footerButtons(detail).first()).toBeEnabled();
      await closeDetail(dentist.page, detail);

      // ── + treatmentLabo:create: the plus and the shield ──────────────────
      await setDentistLeaf(page, "treatmentLabo.create", true);
      row = await reopenList(dentist.page, seeded.orderCode);
      expect(await actionNames(row)).toEqual(["Xem", "Tiếp tục công đoạn", "Bảo hành"]);

      // ── + appointment:create: Tạo Lịch Hẹn Mới, still nothing to edit ────
      await setDentistLeaf(page, "appointment.create", true);
      row = await reopenList(dentist.page, seeded.orderCode);
      detail = await openDetail(dentist.page, row);
      await expect(detail.getByLabel("Trạng thái", { exact: true })).toBeDisabled();
      await expect(detail.locator(".pd-labo-well")).toHaveCount(0);
      await expect(footerButtons(detail)).toHaveText(["In Phiếu Labo", "Tạo Lịch Hẹn Mới"]);
      await closeDetail(dentist.page, detail);

      // ── + laboTemplate:update: the select, the well and Lưu ──────────────
      await setDentistLeaf(page, "laboTemplate.update", true);
      row = await reopenList(dentist.page, seeded.orderCode);
      detail = await openDetail(dentist.page, row);
      await expect(detail.getByLabel("Trạng thái", { exact: true })).toBeEnabled();
      await expect(detail.locator(".pd-labo-well")).toHaveCount(1);
      await expect(footerButtons(detail)).toHaveText(["In Phiếu Labo", "Tạo Lịch Hẹn Mới", "Lưu"]);
      await closeDetail(dentist.page, detail);
    } finally {
      await dentist.context.close();
      await resetDentistLeaves(page, LEAVES);
      await deleteDentist(page, fullName);
    }
  });
});
