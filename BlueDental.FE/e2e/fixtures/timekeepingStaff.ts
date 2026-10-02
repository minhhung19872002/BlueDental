import { expect, type Page } from "@playwright/test";

/**
 * Attendance is one record per staff per clinic day, so a spec that clocks in
 * on today can only run once per staff member. Each run therefore gets its own
 * throw-away staff member, created and deleted through the real API from
 * inside the logged-in page (cookie session + antiforgery header, nothing
 * injected or intercepted).
 */

export interface ApiResult<T> {
  status: number;
  body: T & { error?: { code?: string; message?: string } };
}

interface CallOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  json?: unknown;
  branchId?: string;
}

export interface RunStaff {
  id: string;
  fullName: string;
}

export interface TimeKeepingRecord {
  id: string;
  staffId: string;
  workDate: string;
  registration: number;
  status: number;
  morningShift: { checkedInAt: string | null; checkedOutAt: string | null };
}

export async function call<T = Record<string, unknown>>(
  page: Page,
  url: string,
  options: CallOptions = {},
): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ url, options }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json",
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        ...(options.branchId ? { "X-Clinic-Branch-Id": options.branchId } : {}),
      };
      let body: string | undefined;
      if (options.json !== undefined) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(options.json);
      }
      const res = await fetch(url, {
        method: options.method ?? "GET",
        credentials: "include",
        headers,
        body,
      });
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }
      return { status: res.status, body: parsed as ApiResult<T>["body"] };
    },
    { url, options },
  );
}

/** The first branch the signed-in account may work in. */
export async function firstBranchId(page: Page): Promise<string> {
  const res = await call<{ items: { id: string }[] }>(page, "/api/v1/app/clinic-branches/accessible");
  expect(res.status, "list accessible branches").toBe(200);
  expect(res.body.items.length, "the account needs a branch").toBeGreaterThan(0);
  return res.body.items[0].id;
}

/** The clinic's calendar day (UTC+7), the day the server calls "today". */
export function clinicToday(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

export async function createRunStaff(
  page: Page,
  branchId: string,
  run: string,
  flags: { name?: string; isDentist?: boolean; isAssistant?: boolean; roleNames?: string[] } = {},
): Promise<RunStaff> {
  const res = await call<RunStaff>(page, "/api/v1/app/staff", {
    method: "POST",
    branchId,
    json: {
      userName: `tk-e2e-${run}`,
      password: RUN_STAFF_PASSWORD,
      name: "Chấm công",
      surname: `E2E ${run}`,
      email: `tk-e2e-${run}@example.test`,
      isActive: true,
      roleNames: [],
      branchIds: [branchId],
      ...flags,
    },
  });
  expect(res.status, `create staff (${JSON.stringify(res.body.error)})`).toBe(200);
  return res.body;
}

/** Password of every run staff member, for specs that sign in as one. */
export const RUN_STAFF_PASSWORD = "E2e@123456";

export async function deleteStaff(page: Page, id: string): Promise<void> {
  const res = await call(page, `/api/v1/app/staff/${id}`, { method: "DELETE" });
  expect(res.status, "delete run staff").toBeLessThan(300);
}

export async function openDay(
  page: Page,
  branchId: string,
  staffId: string,
  workDate: string,
): Promise<TimeKeepingRecord> {
  const res = await call<TimeKeepingRecord>(page, "/api/v1/app/time-keepings/open-day", {
    method: "POST",
    branchId,
    json: { staffId, clinicBranchId: branchId, workDate },
  });
  expect(res.status, `open ${workDate} (${JSON.stringify(res.body.error)})`).toBe(200);
  return res.body;
}
