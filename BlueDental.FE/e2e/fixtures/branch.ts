import type { Page } from "@playwright/test";

/**
 * The header's branch, read where the app keeps it. The address bar names the
 * branch by its code (`?branch=BD-001`), so the id is no longer in the URL.
 * Null means "Tất cả chi nhánh".
 */
export async function workingBranchId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("bd-current-branch-id");
    if (!raw) return null;
    const parsed: { state?: { currentBranchId?: string | null } } = JSON.parse(raw);
    return parsed.state?.currentBranchId ?? null;
  });
}

/** Matches a URL whose query names a branch by code: `?branch=` or `&branch=`. */
export const BRANCH_IN_URL = /[?&]branch=[^&]+/;
