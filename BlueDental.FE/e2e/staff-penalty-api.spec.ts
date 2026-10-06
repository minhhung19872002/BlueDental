import { expect, test, type Browser, type Page } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";

/**
 * Feature: Nhân viên → Chế tài (F-49) — the rules the API keeps on its own.
 * BlueDental-local; see docs/clone/pages/staff-penalty.md.
 *
 * Every call is a real HTTP request from inside a page logged in through the
 * login screen, with the cookie and antiforgery token the server set. Nothing
 * is intercepted; every follow-up read is a separate request.
 */

const PENALTIES = "/api/v1/app/staff-penalties";
const TYPES = "/api/v1/app/staff-violation-types";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

const STATUS = { Draft: 1, Approved: 2, Cancelled: 3 } as const;
const ACTION = { Reminder: 1, Warning: 2, Fine: 3, Other: 4 } as const;

interface Penalty {
  id: string;
  status: number;
  action: number;
  fineAmount: number;
  staffName: string | null;
  violationTypeName: string | null;
  approverName: string | null;
  cancelReason: string | null;
}

interface Reply<T> {
  status: number;
  body: T & { error?: { code?: string } };
}

async function call<T>(page: Page, method: string, url: string, body?: unknown, branch = BRANCH_ONE): Promise<Reply<T>> {
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
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await fetch(url, init);
      const text = await res.text();
      let parsed: unknown = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }
      return { status: res.status, body: parsed as never };
    },
    { method, url, body, branch },
  );
}

async function firstStaffOf(page: Page, branchId: string): Promise<string> {
  const res = await call<{ items: { id: string }[] }>(page, "GET", `/api/v1/app/staff?BranchId=${branchId}&MaxResultCount=1`);
  expect(res.status).toBe(200);
  expect(res.body.items.length, "the branch should have a staff member").toBeGreaterThan(0);
  return res.body.items[0].id;
}

const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

async function openSession(browser: Browser, credentials: { userName: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);
  return { context, page };
}

test.describe("Chế tài nhân viên (API)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Nháp → Đã duyệt locks the record; Huỷ needs a reason; only approved fines are totalled", async ({ page }) => {
    const id = runId();
    const staffId = await firstStaffOf(page, BRANCH_ONE);
    const type = await call<{ id: string }>(page, "POST", TYPES, {
      clinicBranchId: BRANCH_ONE,
      name: `Đi trễ ${id}`,
      defaultFineAmount: 50000,
    });
    expect(type.status).toBe(200);

    const description = `Vi phạm ${id}`;
    const created = await call<Penalty>(page, "POST", PENALTIES, {
      clinicBranchId: BRANCH_ONE,
      staffId,
      violationTypeId: type.body.id,
      violationDate: today(),
      action: ACTION.Fine,
      fineAmount: 50000,
      description,
    });
    expect(created.status).toBe(200);
    expect(created.body.status).toBe(STATUS.Draft);
    expect(created.body.violationTypeName).toBe(`Đi trễ ${id}`);
    const penaltyId = created.body.id;

    const listOf = () =>
      call<{ items: Penalty[]; approvedFineTotal: number; totalCount: number }>(
        page,
        "GET",
        `${PENALTIES}?ClinicBranchId=${BRANCH_ONE}&StaffId=${staffId}&Filter=${encodeURIComponent(description)}`,
      );
    expect((await listOf()).body.approvedFineTotal).toBe(0);

    const edited = await call<Penalty>(page, "PUT", `${PENALTIES}/${penaltyId}`, {
      staffId,
      violationTypeId: type.body.id,
      violationDate: today(),
      action: ACTION.Fine,
      fineAmount: 70000,
      description,
    });
    expect(edited.body.fineAmount).toBe(70000);

    const approved = await call<Penalty>(page, "POST", `${PENALTIES}/${penaltyId}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe(STATUS.Approved);
    expect(approved.body.approverName).toBeTruthy();
    expect((await listOf()).body.approvedFineTotal).toBe(70000);

    // Locked: no edit, no delete, no second approval.
    const lockedEdit = await call<Penalty>(page, "PUT", `${PENALTIES}/${penaltyId}`, {
      staffId, violationDate: today(), action: ACTION.Warning, fineAmount: 0,
    });
    expect(lockedEdit.status).toBeGreaterThanOrEqual(400);
    expect(lockedEdit.body.error?.code).toBe("BlueDental:StaffPenalty:0001");
    const lockedDelete = await call(page, "DELETE", `${PENALTIES}/${penaltyId}`);
    expect(lockedDelete.body.error?.code).toBe("BlueDental:StaffPenalty:0001");

    const noReason = await call(page, "POST", `${PENALTIES}/${penaltyId}/cancel`, { reason: "" });
    expect(noReason.status).toBe(400);

    const cancelled = await call<Penalty>(page, "POST", `${PENALTIES}/${penaltyId}/cancel`, { reason: "Nhầm người" });
    expect(cancelled.body.status).toBe(STATUS.Cancelled);

    // Persisted, read back by a separate request.
    const reread = await call<Penalty>(page, "GET", `${PENALTIES}/${penaltyId}`);
    expect(reread.body.status).toBe(STATUS.Cancelled);
    expect(reread.body.cancelReason).toBe("Nhầm người");
    expect((await listOf()).body.approvedFineTotal).toBe(0);

    // A deleted type keeps naming the records filed under it.
    expect((await call(page, "DELETE", `${TYPES}/${type.body.id}`)).status).toBeLessThan(300);
    expect((await call<Penalty>(page, "GET", `${PENALTIES}/${penaltyId}`)).body.violationTypeName).toBe(`Đi trễ ${id}`);
  });

  test("the server refuses what the domain forbids", async ({ page }) => {
    const staffId = await firstStaffOf(page, BRANCH_ONE);
    const base = { clinicBranchId: BRANCH_ONE, staffId, violationDate: today(), description: `Kiểm tra ${runId()}` };
    const codeOf = async (body: object) =>
      (await call(page, "POST", PENALTIES, { ...base, ...body })).body.error?.code;

    expect(await codeOf({ action: ACTION.Fine, fineAmount: 0 })).toBe("BlueDental:StaffPenalty:0003");
    expect(await codeOf({ action: ACTION.Warning, violationDate: "2999-01-01" })).toBe("BlueDental:StaffPenalty:0004");
    expect(await codeOf({ action: ACTION.Warning, staffId: crypto.randomUUID() })).toBe("BlueDental:StaffPenalty:0005");
    expect(await codeOf({ action: ACTION.Warning, violationTypeId: crypto.randomUUID() })).toBe("BlueDental:StaffPenalty:0006");

    // Only a fine carries an amount; a draft can still be deleted.
    const reminder = await call<Penalty>(page, "POST", PENALTIES, { ...base, action: ACTION.Reminder, fineAmount: 90000 });
    expect(reminder.status).toBe(200);
    expect(reminder.body.fineAmount).toBe(0);
    expect((await call(page, "DELETE", `${PENALTIES}/${reminder.body.id}`)).status).toBeLessThan(300);
    expect((await call(page, "GET", `${PENALTIES}/${reminder.body.id}`)).status).toBe(404);
  });

  test("an account limited to another branch neither sees nor touches the record", async ({ page, browser }) => {
    const staffId = await firstStaffOf(page, BRANCH_ONE);
    const created = await call<Penalty>(page, "POST", PENALTIES, {
      clinicBranchId: BRANCH_ONE,
      staffId,
      violationDate: today(),
      action: ACTION.Warning,
      fineAmount: 0,
      description: `Cách ly ${runId()}`,
    });
    expect(created.status).toBe(200);

    const other = await openSession(browser, BRANCH2_USER);
    try {
      const read = await call(other.page, "GET", `${PENALTIES}/${created.body.id}`, undefined, BRANCH_TWO);
      expect(read.status).toBe(403);
      const approve = await call(other.page, "POST", `${PENALTIES}/${created.body.id}/approve`, undefined, BRANCH_TWO);
      expect(approve.status).toBe(403);
      const list = await call<{ items: Penalty[] }>(other.page, "GET", `${PENALTIES}?MaxResultCount=1000`, undefined, BRANCH_TWO);
      expect((list.body.items ?? []).some((p) => p.id === created.body.id)).toBe(false);
    } finally {
      await other.context.close();
      await call(page, "DELETE", `${PENALTIES}/${created.body.id}`);
    }
  });

  test("an account without the staffPenalty leaves gets 403", async ({ page, browser }) => {
    const id = runId();
    const userName = `ct${id}`;
    const password = "Penalty@123456";
    const created = await call<{ id: string }>(page, "POST", "/api/v1/app/staff", {
      userName,
      password,
      name: `Chế tài ${id}`,
      email: `${userName}@bluedental.local`,
      roleNames: ["dentist"],
      branchIds: [BRANCH_ONE],
      isActive: true,
    });
    expect(created.status).toBe(200);

    const other = await openSession(browser, { userName, password });
    try {
      expect((await call(other.page, "GET", PENALTIES)).status).toBe(403);
      expect((await call(other.page, "GET", TYPES)).status).toBe(403);
      const write = await call(other.page, "POST", PENALTIES, {
        staffId: created.body.id, violationDate: today(), action: ACTION.Warning, fineAmount: 0,
      });
      expect(write.status).toBe(403);
    } finally {
      await other.context.close();
      await call(page, "DELETE", `/api/v1/app/staff/${created.body.id}`);
    }
  });
});
