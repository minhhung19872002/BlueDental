import type { Page } from "@playwright/test";

/** Marketing → Ticket (F-51) helpers shared by the API and UI specs. */

export const TICKETS = "/api/v1/app/marketing-tickets";
export const TAGS = "/api/v1/app/marketing-ticket-tags";
export const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
export const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

export interface Reply<T> {
  status: number;
  body: T & { error?: { code?: string } };
}

/**
 * A real request from inside the logged-in page: the session cookie and the
 * antiforgery token the server set, plus the branch header the app sends.
 */
export async function call<T>(page: Page, method: string, url: string, body?: unknown, branch = BRANCH_ONE): Promise<Reply<T>> {
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
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await fetch(url, init);
      const text = await res.text();
      let parsed: unknown;
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

let phoneSeq = 0;
/** A synthetic 10-digit mobile number, different for every call of every run. */
export function syntheticPhone(): string {
  phoneSeq += 1;
  return `09${`${Date.now()}${phoneSeq}`.slice(-8)}`;
}

/** Soft-deletes a ticket the spec created; a ticket already gone is fine. */
export async function removeTicket(page: Page, id: string): Promise<void> {
  await call(page, "DELETE", `${TICKETS}/${id}`, { reason: "e2e cleanup" });
}
