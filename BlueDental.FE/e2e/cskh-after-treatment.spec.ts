import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: CSKH › Sau điều trị fed by "Tiếp tục công đoạn" (owner, 2026-10-05).
 *
 * - Continuing a công đoạn opens the patient's Sau điều trị task for the
 *   clinic day; a second continue the same day joins it instead of adding one.
 * - The task starts with no Ngày chăm sóc and shows Ngày điều trị.
 * - The board opens on Tháng; status is Đã liên hệ / Chưa liên hệ, persisted
 *   and written to the contact log.
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted.
 * Fixtures go through the real API with the session the login screen gave.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";

interface Line {
  patientId: string;
  planId: string;
  lineId: string;
  serviceId: string;
  serviceName: string;
}

interface CareRow {
  id: string;
  patientId: string;
  patientCode: string;
  status: number;
  dueAt: string | null;
  treatmentDate: string | null;
  stageIds: string[];
}

function localIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function displayDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** One API call from inside the page, with the session and the branch header. */
async function call(
  page: Page,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; json: unknown; text: string }> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { status: res.status, json, text };
    },
    { method, url, body, branch: BRANCH },
  );
}

/** A fresh service line on an open slip of branch 1, so the test owns its teeth. */
async function freshLine(page: Page): Promise<Line> {
  const slips = (await call(page, "GET", "/api/v1/app/patient-treatments?maxResultCount=300")).json as {
    items: {
      id: string;
      patientId: string;
      branchId: string;
      status: number;
      services: { id: string; serviceId: string; serviceName: string | null; warrantyDays: number }[];
    }[];
  };
  // 5 = Completed, 6 = Cancelled: a closed slip takes no new line.
  const slip = slips.items.find((s) => s.branchId === BRANCH && s.status !== 5 && s.status !== 6);
  const serviceId = slips.items.flatMap((s) => s.services).find((l) => l.warrantyDays <= 0)?.serviceId;
  expect(slip && serviceId, "the demo clinic should have an open slip in branch 1").toBeTruthy();

  const known = new Set(slip!.services.map((l) => l.id));
  const res = await call(page, "POST", `/api/v1/app/patient-treatments/${slip!.id}/services`, {
    serviceId,
    price: 100000,
    quantity: 2,
    discountType: 0,
    discountValue: 0,
    status: 1,
    teeth: [11, 21].map((toothCode) => ({
      toothCode, selected: true, top: false, right: false, bottom: false, left: false, center: false,
    })),
  });
  expect(res.status, res.text).toBe(200);
  const updated = res.json as { services: { id: string; serviceId: string; serviceName: string | null }[] };
  const line = updated.services.find((l) => !known.has(l.id))!;
  return {
    patientId: slip!.patientId,
    planId: slip!.id,
    lineId: line.id,
    serviceId: line.serviceId,
    serviceName: line.serviceName ?? "",
  };
}

async function staffId(page: Page): Promise<string> {
  const res = await call(page, "GET", "/api/v1/app/staff?MaxResultCount=1&Role=1");
  return (res.json as { items: { id: string }[] }).items[0].id;
}

async function openStage(page: Page, line: Line, tooth: number): Promise<string> {
  const res = await call(page, "POST", "/api/v1/app/treatment-stages", {
    patientId: line.patientId,
    clinicBranchId: BRANCH,
    treatmentId: line.planId,
    treatmentServiceId: line.lineId,
    serviceId: line.serviceId,
    name: line.serviceName || "e2e",
    note: `e2e gốc ${runId()}`,
    staffId: await staffId(page),
    teeth: [{ toothCode: tooth, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
  });
  expect(res.status, res.text).toBe(200);
  return (res.json as { id: string }).id;
}

/** The patient's Sau điều trị tasks treated today (clinic day = browser day here). */
async function todaysTasks(page: Page, patientId: string): Promise<CareRow[]> {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
  const res = await call(
    page,
    "GET",
    `/api/v1/app/care-records?type=1&branchId=${BRANCH}&patientId=${patientId}` +
      `&fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}&maxResultCount=50`,
  );
  expect(res.status, res.text).toBe(200);
  return (res.json as { items: CareRow[] }).items;
}

test.describe("CSKH › Sau điều trị từ Tiếp tục công đoạn", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(150_000);
    await login(page);
  });

  test("continuing opens one task per treatment day; the board shows it by month and toggles contact", async ({
    page,
  }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const line = await freshLine(page);
    const first = await openStage(page, line, 11);
    const second = await openStage(page, line, 21);

    // 1) Tiếp tục công đoạn through the real dialog.
    await page.goto(`/patient/${line.patientId}/treatment-plan/${line.planId}?branchId=${BRANCH}`);
    await expect(page.locator(`.pdt-table tbody tr[data-row-key="${line.lineId}"]`)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Thêm công đoạn" }).click();
    const dialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await dialog.getByRole("tab", { name: /TIẾP TỤC CÔNG ĐOẠN/ }).click();
    await dialog.locator(`.pd-stage-picks button[data-line-id="${line.lineId}"]`).click();
    const form = dialog.locator(`.pd-stage-form[data-item-id="continue:${line.lineId}"]`);
    // Continue tooth 11 only; 21 stays open for the second visit below.
    const chip21 = form.locator(".pd-stage-teeth > div > button:not(.pd-stage-chartbtn)").filter({ hasText: "21" });
    if ((await chip21.getAttribute("class"))?.includes("active")) await chip21.click();
    await form.locator("textarea").fill(`e2e cskh ${runId()}`);
    const continued = page.waitForResponse(
      (res) => /\/treatment-stages\/[^/]+\/continue$/.test(res.url()) && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Tiếp tục công đoạn" }).click();
    const visit = (await (await continued).json()) as { id: string };
    await expect(page.getByText("Tiếp tục công đoạn thành công")).toBeVisible();

    let tasks = await todaysTasks(page, line.patientId);
    expect(tasks, "one Sau điều trị task for today").toHaveLength(1);
    expect(tasks[0].treatmentDate).toBe(localIsoDate(new Date()));
    expect(tasks[0].stageIds).toContain(visit.id);

    // 2) A second continue the same day joins the same task.
    const again = await call(page, "POST", `/api/v1/app/treatment-stages/${second}/continue`, {
      staffId: await staffId(page),
      note: `e2e lần 2 ${runId()}`,
      serviceItemIds: [],
      toothCodes: [21],
    });
    expect(again.status, again.text).toBe(200);
    const secondVisit = (again.json as { id: string }).id;

    tasks = await todaysTasks(page, line.patientId);
    expect(tasks, "still one task after a second continue the same day").toHaveLength(1);
    expect(tasks[0].stageIds).toEqual(expect.arrayContaining([visit.id, secondVisit]));
    expect(first).not.toBe(visit.id);
    const task = tasks[0];

    // Start from Chưa liên hệ whatever an earlier run left behind.
    const reset = await call(page, "PUT", `/api/v1/app/care-records/${task.id}/contact-status`, { contacted: false });
    expect(reset.status, reset.text).toBe(200);

    // 3) The board opens on Tháng and lists the task with its Ngày điều trị.
    await page.goto("/cskh-grouping");
    await assertRealApiTraffic(page, "/api/v1/app/care-records/stats");
    await expect(page.getByRole("button", { name: "Tháng", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /\d+\s*Đã liên hệ/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /\d+\s*Chưa liên hệ/ })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Ngày điều trị" })).toBeVisible();

    // The row may already sit in the unfiltered month list; wait for the
    // searched list, or its re-render closes the status dropdown mid-click.
    const searched = page.waitForResponse(
      (res) => /\/care-records\?/.test(res.url()) && res.url().includes(`filter=${task.patientCode}`),
    );
    await page.getByRole("textbox", { name: "Tìm kiếm" }).fill(task.patientCode);
    await searched;
    const row = page.locator(`.cskh-table tbody tr[data-row-key="${task.id}"]`);
    await expect(row).toBeVisible({ timeout: 15_000 });
    const cells = row.locator("td");
    await expect(cells.nth(0)).toHaveText("—");
    await expect(cells.nth(1)).toHaveText(displayDate(new Date()));
    await expect(row.locator(".cskh-contact-select")).toContainText("Chưa liên hệ");

    // 4) Flip to Đã liên hệ — persisted, care date filled, and logged.
    await row.locator(".cskh-contact-select").click();
    const saved = page.waitForResponse(
      (res) => res.url().includes(`/care-records/${task.id}/contact-status`) && res.request().method() === "PUT",
    );
    await page.locator(".ant-select-dropdown:visible").getByText("Đã liên hệ", { exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText("Đã cập nhật trạng thái liên hệ")).toBeVisible();

    await page.reload();
    await page.getByRole("textbox", { name: "Tìm kiếm" }).fill(task.patientCode);
    await expect(row.locator(".cskh-contact-select")).toContainText("Đã liên hệ", { timeout: 15_000 });
    await expect(cells.nth(0)).toHaveText(displayDate(new Date()));

    const logs = await call(page, "GET", `/api/v1/app/care-records/${task.id}/contact-logs`);
    expect(logs.status, logs.text).toBe(200);
    // Newest first: the flip just made, by the logged-in user.
    const [latest] = logs.json as { status: number; creatorName: string | null }[];
    expect(latest.status).toBe(2);
    expect(latest.creatorName).toBeTruthy();
  });

  /** Clears the patient's tasks for today so the next visit has to open one. */
  async function clearToday(page: Page, patientId: string): Promise<void> {
    for (const task of await todaysTasks(page, patientId)) {
      const res = await call(page, "DELETE", `/api/v1/app/care-records/${task.id}`);
      expect(res.status, res.text).toBeLessThan(300);
    }
    expect(await todaysTasks(page, patientId)).toHaveLength(0);
  }

  // QA dòng 7 (2026-10-06): a one-visit service is ticked Hoàn thành and never
  // continued, so the tab stayed empty.
  test("Hoàn thành a công đoạn opens the day's task", async ({ page }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const line = await freshLine(page);
    const stage = await openStage(page, line, 11);
    await clearToday(page, line.patientId);

    const done = await call(page, "POST", `/api/v1/app/treatment-stages/${stage}/complete`);
    expect(done.status, done.text).toBe(200);

    const tasks = await todaysTasks(page, line.patientId);
    expect(tasks, "Hoàn thành opens one Sau điều trị task for today").toHaveLength(1);
    expect(tasks[0].treatmentDate).toBe(localIsoDate(new Date()));
    expect(tasks[0].stageIds).toContain(stage);
    expect(tasks[0].dueAt).toBeNull();
  });

  test("Hoàn thành a service line from the plan opens the day's task and lists it on the board", async ({
    page,
  }) => {
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");

    const line = await freshLine(page);
    const stage = await openStage(page, line, 11);
    await clearToday(page, line.patientId);

    await page.goto(`/patient/${line.patientId}/treatment-plan/${line.planId}?branchId=${BRANCH}`);
    const planRow = page.locator(`.pdt-table tbody tr[data-row-key="${line.lineId}"]`);
    await expect(planRow).toBeVisible({ timeout: 20_000 });
    await planRow.locator(".pdt-status--menu").click();
    const completed = page.waitForResponse(
      (res) => res.url().endsWith(`/services/${line.lineId}/complete`) && res.request().method() === "POST",
    );
    await page.getByRole("menuitem", { name: "Hoàn thành" }).click();
    expect((await completed).status()).toBe(200);
    await expect(page.getByText("Đã hoàn thành dịch vụ")).toBeVisible();

    const tasks = await todaysTasks(page, line.patientId);
    expect(tasks, "Hoàn thành dịch vụ opens one Sau điều trị task for today").toHaveLength(1);
    expect(tasks[0].stageIds).toContain(stage);

    // A second Hoàn thành the same day joins it.
    const again = await call(page, "POST", `/api/v1/app/treatment-stages/${stage}/complete`);
    expect(again.status, again.text).toBe(200);
    expect(await todaysTasks(page, line.patientId)).toHaveLength(1);

    await page.goto("/cskh-grouping");
    await assertRealApiTraffic(page, "/api/v1/app/care-records/stats");
    await page.getByRole("textbox", { name: "Tìm kiếm" }).fill(tasks[0].patientCode);
    const row = page.locator(`.cskh-table tbody tr[data-row-key="${tasks[0].id}"]`);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.locator("td").nth(1)).toHaveText(displayDate(new Date()));
  });
});
