import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: Danh mục → Vật liệu nha khoa (BlueDental's own, clinic 2026-10-16).
 * The crown and implant types mẫu 5 lists under "Loại": laid out like Dịch vụ,
 * with the fixed groups "Răng sứ" and "Răng Implant" on the left — which say
 * whether a material is a crown or an implant — and each row carrying a brand,
 * an origin and a warranty; soft-deleted like Dịch vụ.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";

interface Group {
  id: string;
  name: string;
  subGroup: string | null;
  isSystem: boolean;
}

interface Entry {
  id: string;
  name: string;
  taxonomyId: string;
  restoration: { kind: number; brand: string | null; origin: string | null; warranty: string | null } | null;
  error?: { code?: string };
}

async function groups(page: Page): Promise<Group[]> {
  const listed = await call<{ items: Group[] }>(
    page,
    `/api/v1/app/taxonomies?clinicBranchId=${BRANCH}&group=dental_material&maxResultCount=20`,
    { branchId: BRANCH },
  );
  return listed.body.items;
}

async function entryNamed(page: Page, name: string): Promise<Entry | undefined> {
  const listed = await call<{ items: Entry[] }>(
    page,
    `/api/v1/app/catalog-entries?clinicBranchId=${BRANCH}&group=dental_material&filter=${encodeURIComponent(name)}`,
    { branchId: BRANCH },
  );
  return listed.body.items.find((item) => item.name === name);
}

test.describe("Danh mục — Vật liệu nha khoa", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a material is filed under its fixed group, corrected, moved, deleted and brought back", async ({ page }) => {
    const name = `Vật liệu E2E ${runId()}`;

    await page.goto("/taxonomy/dental-material");
    await assertRealApiTraffic(page, "group=dental_material");
    await expect(page.getByRole("link", { name: "Vật liệu nha khoa" })).toHaveAttribute("aria-current", "page");

    // The two fixed groups, and no way to add, rename or delete one.
    const panel = page.getByRole("navigation", { name: /^Nhóm / });
    await expect(panel.getByText("Răng sứ", { exact: true })).toBeVisible();
    await expect(panel.getByText("Răng Implant", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Thêm nhóm/ })).toHaveCount(0);
    for (const column of ["Tên vật liệu", "Nhóm phân loại", "Hãng", "Xuất xứ", "Bảo hành"]) {
      await expect(page.getByRole("columnheader", { name: column })).toBeVisible();
    }

    // Added from the "Răng Implant" group: the dialog starts on it.
    await panel.getByText("Răng Implant", { exact: true }).click();
    await page.getByRole("button", { name: "Thêm vật liệu" }).click();
    let dialog = page.getByRole("dialog", { name: "Thêm vật liệu" });
    await expect(dialog.getByText("Răng Implant")).toBeVisible();
    await dialog.getByLabel(/Tên loại/).fill(name);
    await dialog.getByLabel(/Hãng/).fill("Straumann");
    await dialog.getByLabel(/Xuất xứ/).fill("Thụy Sĩ");
    await dialog.getByLabel(/Bảo hành/).fill("Trọn đời");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toContainText("Răng Implant");
    await expect(row).toContainText("Straumann");
    await expect(row).toContainText("Thụy Sĩ");
    await expect(row).toContainText("Trọn đời");
    expect((await entryNamed(page, name))?.restoration).toEqual({
      kind: 2,
      brand: "Straumann",
      origin: "Thụy Sĩ",
      warranty: "Trọn đời",
    });

    // Corrected, and moved to "Răng sứ": the kind follows the group.
    await row.getByRole("button", { name: `Chỉnh sửa ${name}` }).click();
    dialog = page.getByRole("dialog", { name: "Cập nhật vật liệu" });
    await expect(dialog.getByLabel(/Hãng/)).toHaveValue("Straumann");
    await dialog.getByLabel(/Bảo hành/).fill("10 năm");
    await dialog.getByLabel(/Nhóm vật liệu/).click();
    await page.locator(".ant-select-item-option", { hasText: /^Răng sứ$/ }).click();
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toBeHidden();
    await panel.getByText("Răng sứ", { exact: true }).click();
    await expect(row).toContainText("10 năm");
    expect((await entryNamed(page, name))?.restoration?.kind).toBe(1);

    // A soft delete keeps the row and takes its bin away; "Đang hoạt động" brings it back.
    await row.getByRole("button", { name: `Xoá ${name}` }).click();
    await page.getByRole("dialog", { name: /Xác nhận xoá/ }).getByRole("button", { name: "Xoá" }).click();
    await expect(row.getByRole("button", { name: `Xoá ${name}` })).toHaveCount(0);
    await row.getByRole("button", { name: `Chỉnh sửa ${name}` }).click();
    dialog = page.getByRole("dialog", { name: "Cập nhật vật liệu" });
    await dialog.getByText("Đang hoạt động", { exact: true }).click();
    await expect(dialog.getByRole("checkbox", { name: "Đang hoạt động" })).toBeChecked();
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(row.getByRole("button", { name: `Xoá ${name}` })).toBeVisible();

    await page.reload();
    await page.getByRole("navigation", { name: /^Nhóm / }).getByText("Răng sứ", { exact: true }).click();
    const reloaded = page.getByRole("row", { name: new RegExp(name) });
    await expect(reloaded).toContainText("10 năm");
  });

  test("the server keeps the groups fixed, the kind to the group and the details to this catalog", async ({ page }) => {
    await page.goto("/taxonomy/dental-material");

    // Made by the server for the branch: one system group per kind.
    const fixed = await groups(page);
    expect(fixed.map((group) => [group.subGroup, group.name, group.isSystem])).toEqual(
      expect.arrayContaining([
        ["crown", "Răng sứ", true],
        ["implant", "Răng Implant", true],
      ]),
    );
    const implant = fixed.find((group) => group.subGroup === "implant")!;

    // No group is added or renamed.
    const added = await call<Entry>(page, "/api/v1/app/taxonomies", {
      method: "POST",
      branchId: BRANCH,
      json: { clinicBranchId: BRANCH, group: "dental_material", name: `Nhóm E2E ${runId()}`, sortOrder: 0 },
    });
    expect(added.status).toBe(403);
    expect(added.body.error?.code).toBe("BlueDental:Catalogs:0038");
    const renamed = await call<Entry>(page, `/api/v1/app/taxonomies/${implant.id}`, {
      method: "PUT",
      branchId: BRANCH,
      json: { name: "Đổi tên", sortOrder: 0 },
    });
    expect(renamed.status).toBe(403);
    expect(renamed.body.error?.code).toBe("BlueDental:Catalogs:0038");

    // The kind is the group's, whatever the client sends.
    const name = `Kind E2E ${runId()}`;
    const created = await call<Entry>(page, "/api/v1/app/catalog-entries", {
      method: "POST",
      branchId: BRANCH,
      json: {
        clinicBranchId: BRANCH,
        taxonomyId: implant.id,
        name,
        sortOrder: 0,
        restoration: { kind: 1, brand: "Nobel", origin: null, warranty: null },
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    expect(created.body.restoration).toMatchObject({ kind: 2, brand: "Nobel" });

    // Brand / origin / warranty sent with a diagnosis are refused.
    const diagnosis = await call<{ items: Array<{ id: string }> }>(
      page,
      `/api/v1/app/taxonomies?clinicBranchId=${BRANCH}&group=diagnosis&maxResultCount=1`,
      { branchId: BRANCH },
    );
    const diagnosisGroup = diagnosis.body.items[0]?.id;
    test.skip(!diagnosisGroup, "the branch has no diagnosis group to post into");
    const outside = await call<Entry>(page, "/api/v1/app/catalog-entries", {
      method: "POST",
      branchId: BRANCH,
      json: {
        clinicBranchId: BRANCH,
        taxonomyId: diagnosisGroup,
        name: `Chẩn đoán E2E ${runId()}`,
        sortOrder: 0,
        restoration: { kind: 1, brand: "Lava", origin: null, warranty: null },
      },
    });
    expect(outside.status).toBe(403);
    expect(outside.body.error?.code).toBe("BlueDental:Catalogs:0037");
  });
});
