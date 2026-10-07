import type { Page } from "@playwright/test";

/** Branch 1 of the seed data — the branch the default e2e account works in. */
export const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
export const TAXONOMIES = "/api/v1/app/taxonomies";
export const ENTRIES = "/api/v1/app/catalog-entries";

export interface ApiAnswer<T> {
  status: number;
  body: T;
}

/**
 * Calls the real BlueDental API from inside the logged-in page, so the
 * request carries the real session cookie. The branch header and a JSON
 * Accept are required — without them the host answers 403 / 500.
 */
export async function call<T>(
  page: Page,
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  body?: unknown,
  branchId: string = BRANCH_ONE,
): Promise<ApiAnswer<T>> {
  return page.evaluate(
    async ({ method, url, body, branchId }) => {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Clinic-Branch-Id": branchId,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    },
    { method, url, body, branchId },
  );
}
