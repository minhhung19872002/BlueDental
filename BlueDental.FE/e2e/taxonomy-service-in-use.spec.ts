import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";

/**
 * Bug list 2026-10-06 #11 (Danh mục > Dịch vụ): deleting a service a treatment
 * plan already uses did nothing visible. The server now refuses it with
 * "Dịch vụ đang được sử dụng, không thể xóa", whichever door the delete comes
 * through — the bin icon or the dialog's "Đã xoá" status. A service nobody uses
 * still deletes as before.
 *
 * BA rule (R-771): a service that only sits in combos may be deleted, but the
 * confirmation names those combos first; the delete takes it out of them (the
 * combo price drops by its row), and the deleter and the time are kept. A
 * combo the service is the only part of refuses the delete (Catalogs:0034).
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted;
 * every "nothing was saved" check is a separate read after a reload.
 */

const TAXONOMIES = "/api/v1/app/taxonomies";
const ENTRIES = "/api/v1/app/catalog-entries";
const BRANCH = "11111111-1111-1111-1111-111111111111";
const IN_USE_CODE = "BlueDental:Catalogs:0033";
const IN_USE_MESSAGE = "Dịch vụ đang được sử dụng, không thể xóa";
const LAST_PART_CODE = "BlueDental:Catalogs:0034";
const IN_COMBOS = (names: string) =>
  `Dịch vụ đang được sử dụng trong combo: ${names}. Nếu xoá, dịch vụ sẽ bị gỡ khỏi các combo này và giá combo giảm theo.`;

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
  code: string | null;
  isDeleted: boolean;
}

interface ListedEntry extends Entry {
  price: number | null;
  deleterId: string | null;
  deletionTime: string | null;
  comboItems: { componentEntryId: string; componentName: string | null; quantity: number; unitPrice: number }[];
}

/** One entry as the list reads it — deleted rows included. */
async function listed(page: Page, taxonomyId: string, id: string) {
  const res = await call<{ items: ListedEntry[] }>(
    page, "GET", `${ENTRIES}?group=care_service&clinicBranchId=${BRANCH}&taxonomyId=${taxonomyId}&maxResultCount=100`,
  );
  const entry = res.body.items.find((e) => e.id === id);
  expect(entry, "the entry should still be listed").toBeTruthy();
  return entry!;
}

/** Read through the list, which — unlike GET by id — still carries a soft-deleted service. */
async function isDeleted(page: Page, taxonomyId: string, id: string) {
  return (await listed(page, taxonomyId, id)).isDeleted;
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

  test("bug 21: the delete confirm shows the service code and says the row is only struck through", async ({ page }) => {
    const id = runId();
    const group = await call<{ id: string }>(page, "POST", TAXONOMIES, {
      clinicBranchId: BRANCH, group: "care_service", name: `DUNG-TEST Xoá mềm ${id}`, sortOrder: 0,
    });
    expect(group.status).toBe(200);
    const name = `DUNG-TEST Dịch vụ xoá mềm ${id}`;
    const entry = await call<Entry>(page, "POST", ENTRIES, { taxonomyId: group.body.id, name, price: 100000, sortOrder: 0 });
    expect(entry.status).toBe(200);
    expect(entry.body.code, "the server draws a service code").toBeTruthy();

    await page.goto(`/taxonomy/service?group=${group.body.id}`);
    const row = page.getByRole("row", { name: new RegExp(name) });
    await row.getByRole("button", { name: /^Xoá / }).click();

    const confirm = page.getByRole("dialog").filter({ hasText: "Xác nhận xoá dịch vụ" });
    await expect(confirm).toContainText(`Bạn có chắc muốn xoá dịch vụ ${name} (mã ${entry.body.code}) không?`);
    await expect(confirm).toContainText("Mục này chỉ bị gạch ngang, có thể khôi phục lại.");
    await expect(confirm).not.toContainText("không thể hoàn tác");

    // …and that is what happens: the row stays, struck through, without its bin.
    await confirm.getByRole("button", { name: /Xoá$/ }).click();
    await expect(confirm).toBeHidden();
    await page.reload();
    await expect(row).toBeVisible();
    await expect(row.locator(".bd-cat-name--deleted")).toHaveText(name);
    await expect(row.getByRole("button", { name: /^Xoá / })).toHaveCount(0);
    expect(await isDeleted(page, group.body.id, entry.body.id)).toBe(true);
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

    // ── A service that is only a combo component is not "in use": it deletes,
    // and leaves the live combo that held it (BA rule) ──────────────────────
    const partOnly = await call(page, "DELETE", `${ENTRIES}/${partB.body.id}`);
    expect(partOnly.status, JSON.stringify(partOnly.body)).toBeLessThan(300);
    expect(await isDeleted(page, taxonomyId, partB.body.id)).toBe(true);

    // The combo keeps working with what is left: named, priced by its rows, saved and sold.
    const held = await listed(page, taxonomyId, usedCombo.body.id);
    expect(held.comboItems.map((i) => i.componentName)).toEqual([`DUNG-TEST Thành phần A ${id}`]);
    expect(held.price).toBe(90000);
    // A deleted combo is left as it was.
    expect((await listed(page, taxonomyId, freeCombo.body.id)).comboItems).toHaveLength(2);

    const resaved = await call(page, "PUT", `${ENTRIES}/${usedCombo.body.id}`, {
      taxonomyId, name: held.name, sortOrder: 0, isActive: true, isDeleted: false, isCombo: true,
      comboItems: held.comboItems.map(({ componentEntryId, quantity, unitPrice }) => ({ componentEntryId, quantity, unitPrice })),
    });
    expect(resaved.status, JSON.stringify(resaved.body)).toBe(200);
    await useInPlan(page, usedCombo.body.id, 90000);
  });

  test("BA: deleting a combo component names the combo, takes it out, and keeps who and when", async ({ page }) => {
    const id = runId();
    const group = await call<{ id: string }>(page, "POST", TAXONOMIES, {
      clinicBranchId: BRANCH, group: "care_service", name: `DUNG-TEST Gỡ combo ${id}`, sortOrder: 0,
    });
    expect(group.status).toBe(200);
    const taxonomyId = group.body.id;
    const me = await call<{ currentUser: { id: string } }>(page, "GET", "/api/abp/application-configuration");

    const single = async (name: string) =>
      (await call<Entry>(page, "POST", ENTRIES, { taxonomyId, name, price: 100000, sortOrder: 0 })).body;
    const combo = (name: string, parts: Entry[]) =>
      call<Entry>(page, "POST", ENTRIES, {
        taxonomyId, name, sortOrder: 0, isCombo: true,
        comboItems: parts.map((p) => ({ componentEntryId: p.id, quantity: 1, unitPrice: 90000 })),
      });

    const partC = await single(`DUNG-TEST Thành phần C ${id}`);
    const partD = await single(`DUNG-TEST Thành phần D ${id}`);
    const partE = await single(`DUNG-TEST Thành phần E ${id}`);
    const trioName = `DUNG-TEST Combo ba ${id}`;
    const soloName = `DUNG-TEST Combo một ${id}`;
    const trio = await combo(trioName, [partC, partD, partE]);
    const solo = await combo(soloName, [partE]);
    expect(trio.status, JSON.stringify(trio.body)).toBe(200);
    expect(solo.status, JSON.stringify(solo.body)).toBe(200);

    await page.goto(`/taxonomy/service?group=${taxonomyId}`);
    const confirm = page.getByRole("dialog").filter({ hasText: "Xác nhận xoá" });

    // ── The bin icon: the confirmation names the combo, "Xoá" takes C out of it ──
    const rowC = page.getByRole("row", { name: new RegExp(partC.name) });
    await rowC.getByRole("button", { name: /^Xoá / }).click();
    await expect(confirm.getByRole("alert")).toHaveText(IN_COMBOS(trioName));
    const before = Date.now();
    await confirm.getByRole("button", { name: /Xoá$/ }).click();
    await expect(confirm).toBeHidden();

    await page.reload();
    const deletedC = await listed(page, taxonomyId, partC.id);
    expect(deletedC.isDeleted).toBe(true);
    expect(deletedC.deleterId).toBe(me.body.currentUser.id);
    expect(new Date(deletedC.deletionTime!).getTime()).toBeGreaterThan(before - 60_000);
    let held = await listed(page, taxonomyId, trio.body.id);
    expect(held.comboItems.map((i) => i.componentEntryId)).toEqual([partD.id, partE.id]);
    expect(held.price).toBe(180000);

    // ── The dialog's "Đã xoá" is the same delete: the notice, then Lưu ───────
    const rowD = page.getByRole("row", { name: new RegExp(partD.name) });
    await rowD.getByRole("button", { name: /^Chỉnh sửa / }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Đã xoá").click();
    await expect(dialog.getByRole("alert").filter({ hasText: "combo" })).toHaveText(IN_COMBOS(trioName));
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    const deletedD = await listed(page, taxonomyId, partD.id);
    expect(deletedD.isDeleted).toBe(true);
    expect(deletedD.deleterId).toBe(me.body.currentUser.id);
    expect(deletedD.deletionTime).toBeTruthy();
    held = await listed(page, taxonomyId, trio.body.id);
    expect(held.comboItems.map((i) => i.componentEntryId)).toEqual([partE.id]);
    expect(held.price).toBe(90000);

    // ── E is now the only part of both combos: named, and refused ────────────
    const holders = await call<{ items: { name: string; isLastComponent: boolean }[] }>(
      page, "GET", `${ENTRIES}/${partE.id}/combo-holders`,
    );
    expect(holders.body.items.map((h) => `${h.name}|${h.isLastComponent}`).sort()).toEqual(
      [`${trioName}|true`, `${soloName}|true`].sort(),
    );

    await page.reload();
    const rowE = page.getByRole("row", { name: new RegExp(partE.name) });
    await rowE.getByRole("button", { name: /^Xoá / }).click();
    await expect(confirm.getByRole("alert")).toContainText("Dịch vụ là thành phần duy nhất của combo:");
    await expect(confirm.getByRole("alert")).toContainText(soloName);
    const refused = page.waitForResponse(
      (res) => res.request().method() === "DELETE" && res.url().includes(`${ENTRIES}/${partE.id}`),
    );
    await confirm.getByRole("button", { name: /Xoá$/ }).click();
    expect((await refused).status()).toBeGreaterThanOrEqual(400);
    await expect(page.getByText(/Dịch vụ là thành phần duy nhất của combo "DUNG-TEST Combo/)).toBeVisible();

    const parked = await call(page, "PUT", `${ENTRIES}/${partE.id}`, {
      taxonomyId, name: partE.name, price: 100000, sortOrder: 0, isActive: true, isDeleted: true,
    });
    expect(parked.body.error?.code).toBe(LAST_PART_CODE);

    // Nothing moved: E is live and both combos still hold it.
    expect(await isDeleted(page, taxonomyId, partE.id)).toBe(false);
    expect((await listed(page, taxonomyId, trio.body.id)).comboItems).toHaveLength(1);
    expect((await listed(page, taxonomyId, solo.body.id)).comboItems).toHaveLength(1);
  });
});
