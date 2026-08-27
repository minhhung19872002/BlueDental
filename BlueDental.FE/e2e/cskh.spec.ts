import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: Chăm sóc khách hàng (CSKH) — /cskh-grouping.
 *
 * Real full-stack acceptance: real login, real backend, real PostgreSQL.
 * No API interception anywhere in this file.
 *
 * The board keeps tab/page/care_dateMode/care_date in the URL; counters come
 * from GET /care-records/stats; each care-type tab windows the list by date.
 * Tạo mới exists only on CSKH định kì / CSKH đặc biệt; the file-heart dialog
 * on Chúc mừng sinh nhật / Nhắc lịch hẹn saves a Thành công/Thất bại result.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mondayOfThisWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** GET from inside the logged-in page — real cookie auth, real backend. */
async function apiGet(
  page: Page,
  url: string,
): Promise<{ status: number; items: Array<{ branchId: string }> }> {
  return page.evaluate(async (target) => {
    const res = await fetch(target, { headers: { accept: "application/json" } });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, items: json.items ?? [] };
  }, url);
}

/**
 * POST from inside the logged-in page. Used only to seed data the UI cannot
 * create (birthday care records come from another workflow in the reference).
 * This is a genuine authenticated request against the real API — not a mock.
 */
async function apiPost(
  page: Page,
  url: string,
  body: Record<string, unknown>,
): Promise<{ status: number }> {
  return page.evaluate(
    async (input: { url: string; body: Record<string, unknown> }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(input.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: JSON.stringify(input.body),
      });
      return { status: res.status };
    },
    { url, body },
  );
}

/** First patient of the current branch, for seeding. */
async function firstPatientId(page: Page): Promise<string> {
  const res = await page.evaluate(async () => {
    const r = await fetch("/api/v1/app/patients?maxResultCount=1", {
      headers: { accept: "application/json" },
    });
    const json = await r.json();
    return json.items?.[0]?.id ?? null;
  });
  expect(res, "the seed data should contain at least one patient").toBeTruthy();
  return res as string;
}

test.describe("CSKH", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("tabs, date mode and date live in the URL like the reference", async ({ page }) => {
    await page.goto("/cskh-grouping");
    await assertRealApiTraffic(page, "/api/v1/app/care-records/stats");

    // Default care tab is Sau điều trị.
    await expect(page.getByRole("button", { name: "Sau điều trị" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "CSKH đặc biệt" }).click();
    await expect(page).toHaveURL(/page=special/);

    // Switching mode also resets care_date to the mode's anchor (week → Monday).
    await page.getByRole("button", { name: "Tuần", exact: true }).click();
    await expect(page).toHaveURL(/care_dateMode=week/);
    await expect(page).toHaveURL(new RegExp(`care_date=${isoDate(mondayOfThisWeek())}`));

    await page.getByRole("button", { name: "Ngày", exact: true }).click();
    await expect(page).toHaveURL(/care_dateMode=day/);
    await expect(page).toHaveURL(new RegExp(`care_date=${isoDate(new Date())}`));

    await page.getByRole("button", { name: "Phân nhóm CSKH" }).click();
    await expect(page).toHaveURL(/tab=group/);
    await expect(page.getByText(/Hiển thị \d+-\d+\/\d+/).first()).toBeVisible();
  });

  test("counters come from the stats API and clicking one filters the list", async ({ page }) => {
    await page.goto("/cskh-grouping?tab=care&page=special&care_dateMode=day");
    await assertRealApiTraffic(page, "/api/v1/app/care-records/stats");

    await expect(page.getByRole("button", { name: /\d+\s*Tổng khách/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /\d+\s*Đã gửi Zalo/ })).toBeVisible();

    // Thành công refetches the list with status=3; the tiles themselves do not refetch.
    const listRequest = page.waitForRequest(
      (req) =>
        req.url().includes("/care-records?") &&
        req.url().includes("status=3") &&
        req.method() === "GET",
    );
    await page.getByRole("button", { name: /\d+\s*Thành công/ }).click();
    await listRequest;
    await expect(page.getByRole("button", { name: /\d+\s*Thành công/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("the toolbar matches the reference per tab", async ({ page }) => {
    // CSKH đặc biệt: everything.
    await page.goto("/cskh-grouping?tab=care&page=special");
    // The filters float their labels next to the control, so target the field
    // wrappers rather than placeholder/combobox text.
    const toolbarField = (label: string) =>
      page.locator(".cskh-toolbar .floating-field").filter({ hasText: label });

    await expect(page.getByRole("button", { name: "Xuất Excel" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Tìm kiếm" })).toBeVisible();
    await expect(toolbarField("Bác sĩ điều trị")).toBeVisible();
    await expect(toolbarField("Nhân viên CSKH")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tạo mới" })).toBeVisible();

    // Chúc mừng sinh nhật: no doctor filter, no care-staff filter, no create.
    await page.getByRole("button", { name: "Chúc mừng sinh nhật" }).click();
    await expect(page.getByRole("button", { name: "Xuất Excel" })).toBeVisible();
    await expect(toolbarField("Bác sĩ điều trị")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tạo mới" })).toHaveCount(0);

    // Sau điều trị: doctor filter but no care-staff filter and no create.
    await page.getByRole("button", { name: "Sau điều trị" }).click();
    await expect(toolbarField("Bác sĩ điều trị")).toBeVisible();
    await expect(toolbarField("Nhân viên CSKH")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tạo mới" })).toHaveCount(0);
  });

  test("creates a special care task, edits its note inline, both persist", async ({ page }) => {
    const note = `E2E ghi chú ${runId()}`;

    await page.goto("/cskh-grouping?tab=care&page=special&care_dateMode=day");
    await assertRealApiTraffic(page, "/api/v1/app/care-records/stats");

    await page.getByRole("button", { name: "Tạo mới" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Tạo công việc mới" });
    await expect(dialog).toBeVisible();

    // Lưu is disabled until a patient is picked.
    await expect(dialog.getByRole("button", { name: "Lưu" })).toBeDisabled();

    await dialog.getByRole("combobox").filter({ hasText: "Chọn khách hàng" }).click();
    const option = page.locator("#ss-portal-dropdown").getByRole("option").first();
    await expect(option).toBeVisible();
    const optionLabel = (await option.textContent()) ?? "";
    const patientName = optionLabel.replace(/\s*\([^)]*\)\s*$/, "");
    await option.click();

    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã tạo công việc chăm sóc")).toBeVisible();

    // Newest first on this tab, so our record is the top row.
    const row = page.getByRole("row").filter({ hasText: patientName }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText("Chưa chăm sóc")).toBeVisible();

    // Inline note saves on blur through the real PUT.
    const noteInput = row.locator("textarea.cskh-note-input");
    await noteInput.fill(note);
    const putResponse = page.waitForResponse(
      (res) => res.url().includes("/care-records/") && res.request().method() === "PUT",
    );
    await noteInput.blur();
    expect((await putResponse).ok()).toBeTruthy();

    // Persisted, not just rendered.
    await page.reload();
    const persistedRow = page.getByRole("row").filter({ hasText: patientName }).first();
    await expect(persistedRow).toBeVisible();
    await expect(persistedRow.locator("textarea.cskh-note-input")).toHaveValue(note);
  });

  test("the file-heart dialog saves a care result on the birthday tab", async ({ page }) => {
    await page.goto("/cskh-grouping?tab=care&page=birthday&care_dateMode=day");
    await assertRealApiTraffic(page, "/api/v1/app/care-records/stats");

    // The UI has no create path for birthday records (the reference generates
    // them elsewhere), so seed one through the real API for today.
    const patientId = await firstPatientId(page);
    const now = new Date().toISOString();
    const seeded = await apiPost(page, "/api/v1/app/care-records", {
      patientId,
      branchId: BRANCH_ONE,
      type: 2,
      subject: "Happy Birthday",
      dueAt: now,
      scheduledStart: now,
      scheduledEnd: now,
      status: 1,
    });
    expect(seeded.status, "seeding a birthday care record should succeed").toBeLessThan(300);
    await page.reload();

    const row = page.locator("tr.ant-table-row").first();
    await expect(row).toBeVisible();
    await row.locator("button.cskh-action--care").click();

    const dialog = page.getByRole("dialog").filter({ hasText: "Chúc mừng sinh nhật" });
    await expect(dialog).toBeVisible();

    // Lưu needs a result picked.
    await dialog.getByRole("checkbox", { name: "Thành công" }).click();
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã lưu kết quả chăm sóc")).toBeVisible();

    await expect(row.getByText("Thành công")).toBeVisible();

    // The stats endpoint confirms it stuck.
    await page.reload();
    await expect(page.getByRole("button", { name: /[1-9]\d*\s*Thành công/ })).toBeVisible();
  });

  test("Xuất Excel downloads the per-tab kebab-named workbook", async ({ page }) => {
    await page.goto("/cskh-grouping?tab=care&page=special&care_dateMode=day");
    await assertRealApiTraffic(page, "/api/v1/app/care-records/stats");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Xuất Excel" }).click();
    const filename = (await download).suggestedFilename();

    expect(filename).toMatch(/^cskh-dac-biet-.*\.xlsx$/);
  });

  test("Phân nhóm CSKH lists patients and files a base care task", async ({ page }) => {
    const title = `E2E chăm sóc ${runId()}`;

    await page.goto("/cskh-grouping?tab=group");
    await assertRealApiTraffic(page, "/api/v1/app/care-records/grouping-patients");

    await expect(page.getByText(/Hiển thị \d+-\d+\/\d+/).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Ngày tạo hồ sơ" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Công nợ" })).toBeVisible();

    // Search narrows through the server: search the first row's patient code.
    const firstLink = page.locator("a.cskh-patient-link").first();
    await expect(firstLink).toBeVisible();
    const code = /\[([^\]]+)\]/.exec((await firstLink.textContent()) ?? "")?.[1];
    expect(code).toBeTruthy();

    const filtered = page.waitForResponse(
      (res) =>
        res.url().includes("/care-records/grouping-patients") && res.url().includes("filter="),
    );
    await page.getByRole("textbox", { name: "Tìm kiếm" }).fill(code as string);
    expect((await filtered).ok()).toBeTruthy();
    await expect(page.locator("tr.ant-table-row").first()).toContainText(code as string);

    // File-heart files a base task: title required, then saved as Thành công.
    await page.locator("button.cskh-action--care").first().click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Tạo công việc mới" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Lưu" })).toBeDisabled();

    await dialog.getByLabel("Tiêu đề").fill(title);
    await dialog.getByRole("radio", { name: "Tốt" }).click();
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã lưu lần chăm sóc")).toBeVisible();
  });

  test("a branch-scoped account never sees another branch's care records", async ({ page }) => {
    // admin (branch one) has records; branch2's list must never contain them.
    const own = await apiGet(page, "/api/v1/app/care-records?maxResultCount=200");
    expect(own.status).toBe(200);
    for (const item of own.items) expect(item.branchId).toBe(BRANCH_ONE);

    const foreignPatientId = await firstPatientId(page);

    await page.context().clearCookies();
    await login(page, BRANCH2_USER);

    const other = await apiGet(page, "/api/v1/app/care-records?maxResultCount=200");
    expect(other.status).toBe(200);
    for (const item of other.items) expect(item.branchId).not.toBe(BRANCH_ONE);

    // Filing a care record against another branch's patient reads as not-found,
    // so a known foreign patient id cannot be used to hydrate that patient's PHI.
    const crossCreate = await apiPost(page, "/api/v1/app/care-records", {
      patientId: foreignPatientId,
      branchId: BRANCH_ONE,
      type: 5,
      subject: `cross-branch ${runId}`,
    });
    expect(crossCreate.status).toBe(404);

    // The page itself still works on their own (empty) branch.
    await page.goto("/cskh-grouping");
    await expect(page.getByRole("button", { name: /\d+\s*Tổng khách/ })).toBeVisible();
  });
});
