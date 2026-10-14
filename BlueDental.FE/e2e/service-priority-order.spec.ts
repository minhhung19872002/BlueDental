import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: a service list that spans groups runs by "Mức độ ưu tiên" group by
 * group — the groups in their own priority order, each group's services in
 * theirs, a tie newest first — the order Danh mục shows (owner, 2026-10-14).
 * A service's priority only ranks it inside its group (Danh mục reorders one
 * group at a time), so comparing it across groups dealt the groups out like
 * cards: "Cạo vôi 1, Trám răng, Tháo mắc cài, …, Cạo vôi 2, …".
 *
 * Real stack: two groups and their services are created through the real API
 * on the first branch, read back from the API and off the "Thêm dịch vụ mới"
 * picker of a patient's Tạo phiếu dịch vụ, then deleted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";
const ENTRIES = "/api/v1/app/catalog-entries";
const GROUPS = "/api/v1/app/taxonomies";

const SERVICE_CONFIG = {
  taxRate: 0,
  priceIncludesTax: false,
  discountIsPercent: true,
  discountValue: 0,
  requireImage: false,
  deductDoctorOnWarranty: false,
  separateRevenue: false,
  showToothOnInvoice: false,
  revenueByStage: false,
  requireStageSequence: false,
  warrantyDays: 0,
  laboSupplierIds: [],
};

interface Row {
  id: string;
  name: string;
}

async function call<T>(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    },
    { method, url, body, branch: BRANCH },
  ) as Promise<{ status: number; body: T }>;
}

async function ok<T>(page: Page, method: string, url: string, body?: unknown): Promise<T> {
  const res = await call<T>(page, method, url, body);
  if (res.status >= 300) throw new Error(`${method} ${url} ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

const group = (page: Page, name: string, sortOrder: number) =>
  ok<Row>(page, "POST", GROUPS, { clinicBranchId: BRANCH, group: "care_service", name, sortOrder });

const service = (page: Page, taxonomyId: string, name: string, sortOrder: number) =>
  ok<Row>(page, "POST", ENTRIES, {
    clinicBranchId: BRANCH,
    taxonomyId,
    name,
    price: 100000,
    sortOrder,
    serviceConfig: SERVICE_CONFIG,
    stages: [],
  });

/** The live services the patient screens offer, in the order the API lists them. */
async function listed(page: Page, count: number, taxonomyId?: string): Promise<string[]> {
  const scope = taxonomyId ? `&TaxonomyId=${taxonomyId}` : "";
  const res = await ok<{ items: Row[] }>(
    page,
    "GET",
    `${ENTRIES}?ClinicBranchId=${BRANCH}&Group=care_service&IsDeleted=false&IsActive=true&MaxResultCount=${count}${scope}`,
  );
  return res.items.map((item) => item.name);
}

/** The first option names of the "Thêm dịch vụ mới" picker on a fresh Tạo phiếu dịch vụ. */
async function pickerNames(page: Page, count: number): Promise<string[]> {
  await page.goto("/patient?branch=BD-001");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const firstName = page.locator("tr.ant-table-row .bd-patient-name").first();
  await expect(firstName).toBeVisible();
  await firstName.click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);
  await page.getByRole("link", { name: "Kế hoạch điều trị" }).click();
  await page.getByRole("button", { name: "Tạo kế hoạch mới" }).click();
  const slip = page.getByRole("dialog", { name: "Tạo phiếu dịch vụ" });
  await expect(slip).toBeVisible();

  await slip.getByRole("combobox", { name: /Thêm dịch vụ mới/ }).click();
  const names = page
    .locator(".tp-service-dropdown:not(.ant-select-dropdown-hidden)")
    .last()
    .locator(".ant-select-item-option .tp-opt-name");
  await expect(names.nth(count - 1)).toBeVisible({ timeout: 15_000 });
  return (await names.allTextContents()).slice(0, count);
}

test("services spanning groups list group by group, each by Mức độ ưu tiên", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await login(page);
  await page.goto("/patient?branch=BD-001");

  const id = runId();
  // Far below any real priority, so the run's groups lead the whole catalog.
  const first = await group(page, `Nhóm ưu tiên A ${id}`, -100001);
  const second = await group(page, `Nhóm ưu tiên B ${id}`, -100000);
  const name = (label: string) => `DV ưu tiên ${label} ${id}`;
  const made: Row[] = [];

  try {
    // Second's services carry the lower numbers: compared across groups they
    // would come out ahead of first's.
    made.push(await service(page, first.id, name("A5 cũ"), 5));
    made.push(await service(page, second.id, name("B0"), 0));
    made.push(await service(page, first.id, name("A5 mới"), 5));
    made.push(await service(page, second.id, name("B1"), 1));
    made.push(await service(page, first.id, name("A6"), 6));

    const byGroup = [name("A5 mới"), name("A5 cũ"), name("A6"), name("B0"), name("B1")];
    expect(await listed(page, 5)).toEqual(byGroup);
    // Inside one group (what Danh mục shows) the order is the group's own.
    expect(await listed(page, 10, first.id)).toEqual(byGroup.slice(0, 3));
    expect(await listed(page, 10, second.id)).toEqual(byGroup.slice(3));

    expect(await pickerNames(page, 5)).toEqual(byGroup);

    // Ranking B ahead of A moves its services ahead as a block.
    await ok(page, "PUT", `${GROUPS}/${second.id}`, { name: `Nhóm ưu tiên B ${id}`, sortOrder: -100002 });
    const swapped = [...byGroup.slice(3), ...byGroup.slice(0, 3)];
    expect(await listed(page, 5)).toEqual(swapped);

    await page.reload();
    expect(await pickerNames(page, 5)).toEqual(swapped);
  } finally {
    for (const row of made) await call(page, "DELETE", `${ENTRIES}/${row.id}`);
    await call(page, "DELETE", `${GROUPS}/${first.id}`);
    await call(page, "DELETE", `${GROUPS}/${second.id}`);
  }
});
