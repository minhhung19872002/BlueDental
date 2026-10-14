import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call as staffCall } from "./fixtures/timekeepingStaff";

/**
 * Feature: Nhân sự lists its staff by "Mức độ ưu tiên" — 0 first, a tie by
 * name — the order the reception board already uses (owner, 2026-10-14).
 *
 * Real stack: a staff member is created through the real API, its priority
 * changed through the same endpoint the staff form saves to, and the list read
 * both from the API and off the Nhân sự screen. The member is deleted after.
 */

const STAFF = "/api/v1/app/staff";
const BRANCH = "11111111-1111-1111-1111-111111111111";

interface Staff {
  id: string;
  name: string | null;
  userName: string;
  priority: number;
}

async function listed(page: Page): Promise<Staff[]> {
  const res = await staffCall<{ items: Staff[] }>(page, `${STAFF}?branchId=${BRANCH}&maxResultCount=1000`);
  expect(res.status).toBe(200);
  return res.body.items;
}

async function setPriority(page: Page, id: string, priority: number) {
  const current = await staffCall<Staff>(page, `${STAFF}/${id}`);
  const res = await staffCall<Staff>(page, `${STAFF}/${id}`, {
    method: "PUT",
    json: { ...current.body, password: undefined, priority },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
}

const firstRow = (page: Page) => page.locator(".ant-table-tbody tr.ant-table-row").first();

test("Nhân sự lists staff by Mức độ ưu tiên, 0 first, a tie by name", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await login(page);

  const id = runId();
  const name = `Aaa ưu tiên ${id}`;
  const userName = `thutu${id}`;
  const created = await staffCall<Staff>(page, STAFF, {
    method: "POST",
    json: {
      userName,
      password: "ThuTu@123456",
      name,
      email: `${userName}@bluedental.local`,
      roleNames: ["dentist"],
      branchIds: [BRANCH],
      isActive: true,
      isDentist: true,
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  const staffId = created.body.id;

  try {
    // The API: priorities never go down along the list, and at 0 an "Aaa…"
    // name leads the 0s.
    const atZero = await listed(page);
    const priorities = atZero.map((s) => s.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    expect(atZero[0].id).toBe(staffId);

    await page.goto("/staff?branch=BD-001");
    await assertRealApiTraffic(page, STAFF);
    await expect(firstRow(page)).toContainText(name);

    // Ranked last: it leaves the head of the list for its end.
    await setPriority(page, staffId, 9999);
    const atEnd = await listed(page);
    expect(atEnd[atEnd.length - 1].id).toBe(staffId);
    const reordered = atEnd.map((s) => s.priority);
    expect(reordered).toEqual([...reordered].sort((a, b) => a - b));

    await page.reload();
    await assertRealApiTraffic(page, STAFF);
    await expect(firstRow(page)).toBeVisible();
    await expect(firstRow(page)).not.toContainText(name);
  } finally {
    await staffCall(page, `${STAFF}/${staffId}`, { method: "DELETE" });
  }
});
