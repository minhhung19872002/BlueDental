import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import {
  MAIN_BRANCH,
  createDentist,
  deleteDentist,
  openDentistSession,
  resetDentistLeaves,
  setDentistLeaf,
} from "./fixtures/restrictedDentist";

/**
 * Feature: Phân quyền theo vai trò — the 378 ability leaves reach every
 * service, and the page buttons follow them.
 *
 * Runs against the real stack only. What it proves, with a dentist created
 * through the Nhân sự dialog and a second real cookie session:
 *
 *  - a service still guarded by a legacy module permission (Danh mục, i.e.
 *    `BlueDental.Catalogs.View`) opens once the role holds any Danh mục leaf;
 *  - the header branch list is readable without the Organizations permission,
 *    while the branch admin list is still refused;
 *  - a Vận hành report is refused without that division's report leaf;
 *  - "Tạo hồ sơ" / "Xuất file" on the patient list appear only with
 *    `patient.create` / `patient.export`.
 *
 * The seeded `dentist` role carries no grants; every leaf touched here is
 * reset at the start and at the end.
 */

const LEAVES = ["patient.read", "patient.create", "catalogService.read"];

/** The Báo cáo of Khối lễ tân, asked the way WorkLogReport asks. */
const RECEPTION_WORK_LOG =
  "/api/v1/app/operations/reports/work-log?Department=3&Period=2&Anchor=2026-09-01&SkipCount=0&MaxResultCount=1";

test.describe("Phân quyền theo vai trò — ability leaves reach every service", () => {
  test("legacy-guarded services, the branch list and page buttons follow the leaves", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);

    const id = runId();
    const userName = `bs${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI ${id}`;

    await login(page);
    // R-405: the claims table used to lack its BranchId column (500 for admin).
    const claims = await page.request.get("/api/v1/app/insurance-claims?maxResultCount=1");
    expect(claims.status()).toBe(200);
    await resetDentistLeaves(page, LEAVES);
    await createDentist(page, fullName, userName, password);

    const dentist = await openDentistSession(browser, userName, password);
    try {
      // ── nothing granted: legacy-guarded and ability-guarded alike refuse ──
      const procedures0 = await dentist.page.request.get("/api/v1/app/dental-procedures?maxResultCount=1");
      expect(procedures0.status()).toBe(403);
      const patients0 = await dentist.page.request.get("/api/v1/app/patients?maxResultCount=1");
      expect(patients0.status()).toBe(403);

      // The header branch list is for every signed-in user; branch admin is not.
      const accessible = await dentist.page.request.get("/api/v1/app/clinic-branches/accessible");
      expect(accessible.status()).toBe(200);
      const branches = (await accessible.json()) as { items: { name: string }[] };
      expect(branches.items.map((b) => b.name)).toContain(MAIN_BRANCH);
      const adminList = await dentist.page.request.get("/api/v1/app/clinic-branches?maxResultCount=1");
      expect(adminList.status()).toBe(403);

      // A Vận hành report without that division's report leaf.
      const workLog = await dentist.page.request.get(RECEPTION_WORK_LOG);
      expect(workLog.status()).toBe(403);

      // ── admin grants Danh mục > Dịch vụ > Xem and Khách hàng > Xem ─────
      await setDentistLeaf(page, "catalogService.read", true);
      await setDentistLeaf(page, "patient.read", true);

      // The legacy Catalogs.View guard is satisfied by the catalog leaf…
      const procedures1 = await dentist.page.request.get("/api/v1/app/dental-procedures?maxResultCount=1");
      expect(procedures1.status()).toBe(200);
      // …the report is still refused…
      const workLogStill = await dentist.page.request.get(RECEPTION_WORK_LOG);
      expect(workLogStill.status()).toBe(403);

      // …and the patient list opens read-only: no "Tạo hồ sơ", no "Xuất file".
      await dentist.page.goto("/patient");
      await assertRealApiTraffic(dentist.page, "/api/v1/app/patients");
      await expect(dentist.page.getByText("Không có quyền truy cập")).toHaveCount(0);
      await expect(dentist.page.locator(".bd-patient-toolbar")).toBeVisible();
      await expect(dentist.page.getByRole("button", { name: /Tạo hồ sơ/ })).toHaveCount(0);
      await expect(dentist.page.getByRole("button", { name: /Xuất file/ })).toHaveCount(0);

      // ── admin grants Khách hàng > Thêm ──────────────────────────────────
      await setDentistLeaf(page, "patient.create", true);

      await dentist.page.reload();
      await expect(dentist.page.locator(".bd-patient-toolbar")).toBeVisible();
      await expect(dentist.page.getByRole("button", { name: /Tạo hồ sơ/ }).first()).toBeVisible();
      await expect(dentist.page.getByRole("button", { name: /Xuất file/ })).toHaveCount(0);
    } finally {
      await dentist.context.close();
      await resetDentistLeaves(page, LEAVES);
      await deleteDentist(page, fullName);
    }
  });
});
