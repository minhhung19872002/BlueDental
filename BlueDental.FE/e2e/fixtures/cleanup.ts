import type { Browser, Page } from "@playwright/test";
import { login } from "./auth";

/**
 * Removes the catalog groups a spec leaves behind, so repeated runs do not
 * pile up in the shared dev database (2026-09-25: 1,106 of them had made the
 * service-sync dialog crawl — R-578).
 *
 * Only names of the form `<prefix> <six-digit run id>` are touched — the
 * shape `runId()` gives — so seeded and hand-made groups are safe. It goes
 * through the real API as a user would: each live entry is deleted (a soft
 * delete; plan lines that used it keep their history), then the group, which
 * the server only allows once it is empty.
 */

const TAXONOMIES = "/api/v1/app/taxonomies";
const ENTRIES = "/api/v1/app/catalog-entries";

interface Row {
  id: string;
  name: string;
}

async function call(page: Page, method: "GET" | "DELETE", url: string): Promise<{ status: number; items: Row[] }> {
  const cookies = await page.context().cookies();
  const xsrf = cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value;
  const res = await page.request.fetch(url, {
    method,
    headers: xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {},
  });
  const body: { items?: Row[] } = method === "GET" ? await res.json().catch(() => ({})) : {};
  return { status: res.status(), items: body.items ?? [] };
}

function runGroupPattern(prefixes: readonly string[]): RegExp {
  const escaped = prefixes.map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^(${escaped.join("|")}) \\d{6}$`);
}

/** Deletes every group of `group` named `<prefix> <run id>`, in every branch the admin sees. */
export async function purgeRunGroups(browser: Browser, group: string, prefixes: readonly string[]): Promise<number> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await login(page);
    const pattern = runGroupPattern(prefixes);
    const groups = await call(page, "GET", `${TAXONOMIES}?group=${group}&maxResultCount=1000`);
    const doomed = groups.items.filter((row) => pattern.test(row.name));

    for (const row of doomed) {
      const entries = await call(
        page,
        "GET",
        `${ENTRIES}?group=${group}&taxonomyId=${row.id}&isDeleted=false&maxResultCount=1000`,
      );
      for (const entry of entries.items) await call(page, "DELETE", `${ENTRIES}/${entry.id}`);
      await call(page, "DELETE", `${TAXONOMIES}/${row.id}`);
    }
    return doomed.length;
  } finally {
    await context.close();
  }
}
