import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Bug list 2026-10-06 #11 (Danh mục > Dịch vụ): deleting a service a treatment
 * plan already uses did nothing visible. The server now refuses it with
 * "Dịch vụ đang được sử dụng, không thể xóa", whichever door the delete comes
 * through — the bin icon or the dialog's "Đã xoá" status. A service nobody uses
 * still deletes as before.
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted;
 * every "nothing was saved" check is a separate read after a reload.
 */

const TAXONOMIES = "/api/v1/app/taxonomies";
const ENTRIES = "/api/v1/app/catalog-entries";
const BRANCH = "11111111-1111-1111-1111-111111111111";
const IN_USE_CODE = "BlueDental:Catalogs:0033";
const IN_USE_MESSAGE = "Dịch vụ đang được sử dụng, không thể xóa";

interface Reply<T> {
  status: number;
  body: T & { error?: { code?: string; message?: string } };
}

async function call<T>(page: Page, method: string, url: string, body?: unknown): Promise<Reply<T>> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const init: RequestInit = {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": "vi",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await fetch(url, init);
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : {}) as never };
    },
    { method, url, body, branch: BRANCH },
  );
}

interface Entry {
  id: string;
  name: string;
  isDeleted: boolean;
}

/** Read through the list, which — unlike GET by id — still carries a soft-deleted service. */
async function isDeleted(page: Page, taxonomyId: string, id: string) {
  const res = await call<{ items: Entry[] }>(
    page, "GET", `${ENTRIES}?group=care_service&clinicBranchId=${BRANCH}&taxonomyId=${taxonomyId}&maxResultCount=100`,
  );
  const entry = res.body.items.find((e) => e.id === id);
  expect(entry, "the service should still be listed").toBeTruthy();
  return entry!.isDeleted;
}

/** Puts `serviceId` on an open treatment slip of the branch — the "used in a plan" of the bug. */
async function useInPlan(page: Page, serviceId: string, price = 200000) {
  const slips = await call<{ items: { id: string; branchId: string; status: number }[] }>(
    page, "GET", "/api/v1/app/patient-treatments?maxResultCount=300",
  );
  const slip = slips.body.items.find((s) => s.branchId === BRANCH && s.status !== 5 && s.status !== 6);
  expect(slip, "the demo clinic should have an open treatment slip").toBeTruthy();

  const tooth = { toothCode: 16, selected: true, top: false, right: false, bottom: false, left: false, center: false };
  const added = await call(page, "POST", `/api/v1/app/patient-treatments/${slip!.id}/services`, {
    serviceId, price, quantity: 1, discountType: 0, discountValue: 0, status: 1, teeth: [tooth],
  });
  expect(added.status, JSON.stringify(added.body)).toBe(200);
}

test.describe("Danh mục > Dịch vụ — không xoá dịch vụ đang được sử dụng", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/taxonomy/service");
  });

  test("bug 11: the bin icon on a service used in a plan shows the refusal and deletes nothing", async ({ page }) => {
    const id = runId();
    // At the top, so the tab opens on it whatever else the clinic holds; it is
    // never empty, so the specs that add to the first group still find rows.
    const group = await call<{ id: string }>(page, "POST", TAXONOMIES, {
      clinicBranchId: BRANCH, group: "care_service", name: `DUNG-TEST Đang dùng ${id}`, sortOrder: 0,
    });
    expect(group.status).toBe(200);

    const usedName = `DUNG-TEST Dịch vụ dùng ${id}`;
    const freeName = `DUNG-TEST Dịch vụ trống ${id}`;
    const used = await call<Entry>(page, "POST", ENTRIES, { taxonomyId: group.body.id, name: usedName, price: 200000, sortOrder: 0 });
    const free = await call<Entry>(page, "POST", ENTRIES, { taxonomyId: group.body.id, name: freeName, price: 100000, sortOrder: 0 });
    expect(used.status).toBe(200);
    expect(free.status).toBe(200);
    await useInPlan(page, used.body.id);

    await page.goto(`/taxonomy/service?group=${group.body.id}`);
    const usedRow = page.getByRole("row", { name: new RegExp(usedName) });
    await expect(usedRow).toBeVisible();

    // ── The bug: bin icon → confirm → a message, and the row stays live ──────
    await usedRow.getByRole("button", { name: /^Xoá / }).click();
    const confirm = page.getByRole("dialog").filter({ hasText: "Xác nhận xoá" });
    const refused = page.waitForResponse(
      (res) => res.request().method() === "DELETE" && res.url().includes(`${ENTRIES}/${used.body.id}`),
    );
    await confirm.getByRole("button", { name: /Xoá$/ }).click();
    expect((await refused).status()).toBeGreaterThanOrEqual(400);
    await expect(page.getByText(IN_USE_MESSAGE)).toBeVisible();
    await expect(page.getByText("Đã xoá", { exact: true })).toHaveCount(0);

    await page.reload();
    await expect(usedRow).toBeVisible();
    await expect(usedRow.getByRole("button", { name: /^Xoá / })).toBeVisible();
    expect(await isDeleted(page, group.body.id, used.body.id)).toBe(false);

    // ── The other door: the dialog's "Đã xoá" status is the same delete ──────
    const parked = await call(page, "PUT", `${ENTRIES}/${used.body.id}`, {
      taxonomyId: group.body.id, name: usedName, price: 200000, sortOrder: 0, isActive: true, isDeleted: true,
    });
    expect(parked.status).toBeGreaterThanOrEqual(400);
    expect(parked.body.error?.code).toBe(IN_USE_CODE);
    expect(parked.body.error?.message).toBe(IN_USE_MESSAGE);
    expect(await isDeleted(page, group.body.id, used.body.id)).toBe(false);

    // ── A service nobody uses still deletes, from the same table ─────────────
    const freeRow = page.getByRole("row", { name: new RegExp(freeName) });
    await freeRow.getByRole("button", { name: /^Xoá / }).click();
    await confirm.getByRole("button", { name: /Xoá$/ }).click();
    await expect(confirm).toBeHidden();
    await page.reload();
    await expect(freeRow.getByRole("button", { name: /^Xoá / })).toHaveCount(0);
    expect(await isDeleted(page, group.body.id, free.body.id)).toBe(true);
  });

  test("a combo picked into a plan cannot be deleted; a combo whose services are in use still can", async ({ page }) => {
    const id = runId();
    const group = await call<{ id: string }>(page, "POST", TAXONOMIES, {
      clinicBranchId: BRANCH, group: "care_service", name: `DUNG-TEST Combo đang dùng ${id}`, sortOrder: 0,
    });
    expect(group.status).toBe(200);
    const taxonomyId = group.body.id;

    const single = (name: string) =>
      call<Entry>(page, "POST", ENTRIES, { taxonomyId, name, price: 100000, sortOrder: 0 });
    const combo = (name: string, parts: Entry[]) =>
      call<Entry>(page, "POST", ENTRIES, {
        taxonomyId, name, sortOrder: 0, isCombo: true,
        comboItems: parts.map((p) => ({ componentEntryId: p.id, quantity: 1, unitPrice: 90000 })),
      });

    const partA = await single(`DUNG-TEST Thành phần A ${id}`);
    const partB = await single(`DUNG-TEST Thành phần B ${id}`);
    expect(partA.status, JSON.stringify(partA.body)).toBe(200);
    expect(partB.status, JSON.stringify(partB.body)).toBe(200);

    // ── A combo is picked as one line under its own id — that line holds it ──
    const usedCombo = await combo(`DUNG-TEST Combo dùng ${id}`, [partA.body, partB.body]);
    expect(usedCombo.status, JSON.stringify(usedCombo.body)).toBe(200);
    await useInPlan(page, usedCombo.body.id, 180000);

    const refused = await call(page, "DELETE", `${ENTRIES}/${usedCombo.body.id}`);
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(refused.body.error?.code).toBe(IN_USE_CODE);
    expect(refused.body.error?.message).toBe(IN_USE_MESSAGE);
    expect(await isDeleted(page, taxonomyId, usedCombo.body.id)).toBe(false);

    // ── A combo nobody picked deletes, though one of its services is in a plan ──
    await useInPlan(page, partA.body.id, 100000);
    const freeCombo = await combo(`DUNG-TEST Combo trống ${id}`, [partA.body, partB.body]);
    expect(freeCombo.status, JSON.stringify(freeCombo.body)).toBe(200);
    const gone = await call(page, "DELETE", `${ENTRIES}/${freeCombo.body.id}`);
    expect(gone.status, JSON.stringify(gone.body)).toBeLessThan(300);
    expect(await isDeleted(page, taxonomyId, freeCombo.body.id)).toBe(true);
    // …and that leaves the service itself alone.
    expect(await isDeleted(page, taxonomyId, partA.body.id)).toBe(false);

    // ── A service that is only a combo component is not "in use" (F-48: a combo keeps deleted components) ──
    const partOnly = await call(page, "DELETE", `${ENTRIES}/${partB.body.id}`);
    expect(partOnly.status, JSON.stringify(partOnly.body)).toBeLessThan(300);
    expect(await isDeleted(page, taxonomyId, partB.body.id)).toBe(true);

    // …and the combo that holds it keeps working: still named, priced, saved and sold.
    const combos = await call<{ items: (Entry & { retailPrice: number; comboItems: { componentEntryId: string; componentName: string | null; quantity: number; unitPrice: number }[] })[] }>(
      page, "GET", `${ENTRIES}?group=care_service&clinicBranchId=${BRANCH}&taxonomyId=${taxonomyId}&isCombo=true&isDeleted=false&maxResultCount=100`,
    );
    const held = combos.body.items.find((e) => e.id === usedCombo.body.id);
    expect(held?.comboItems.map((i) => i.componentName)).toEqual([`DUNG-TEST Thành phần A ${id}`, `DUNG-TEST Thành phần B ${id}`]);
    expect(held?.retailPrice).toBe(200000);
    const resaved = await call(page, "PUT", `${ENTRIES}/${usedCombo.body.id}`, {
      taxonomyId, name: held!.name, sortOrder: 0, isActive: true, isDeleted: false, isCombo: true,
      comboItems: held!.comboItems.map(({ componentEntryId, quantity, unitPrice }) => ({ componentEntryId, quantity, unitPrice })),
    });
    expect(resaved.status, JSON.stringify(resaved.body)).toBe(200);
    await useInPlan(page, usedCombo.body.id, 180000);
  });
});
