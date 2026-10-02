import { expect, type Browser } from "@playwright/test";
import { login } from "./auth";
import { call, RUN_STAFF_PASSWORD } from "./timekeepingStaff";

export const NOT_REGISTERED = 0;
export const DAY_OFF = 2;

/**
 * Signs in as a run staff member in a context of their own and sets their own
 * day on Chấm công — the only way a day off can be written since nobody, admin
 * included, may mark another's X (a9a04c89). The member needs a role that holds
 * the timekeeping grant (`roleNames: ["admin"]`).
 */
export async function setOwnDay(
  browser: Browser,
  who: { userName: string; id: string },
  branchId: string,
  workDate: string,
  registration: typeof DAY_OFF | typeof NOT_REGISTERED,
): Promise<void> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await login(page, { userName: who.userName, password: RUN_STAFF_PASSWORD });
    const res = await call(page, "/api/v1/app/time-keepings/bulk-register", {
      method: "POST",
      branchId,
      json: { items: [{ staffId: who.id, workDate, registration }] },
    });
    expect(res.status, `bulk-register own day (${JSON.stringify(res.body.error)})`).toBe(200);
  } finally {
    await context.close();
  }
}
