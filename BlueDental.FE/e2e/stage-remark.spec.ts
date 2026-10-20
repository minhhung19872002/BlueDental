import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { createSlipViaApi } from "./fixtures/ledgerReceipt";
import {
  createDentist,
  deleteDentist,
  openDentistSession,
  resetDentistLeaves,
  setDentistLeaf,
} from "./fixtures/restrictedDentist";
import { openStageDialog, stagePanel } from "./fixtures/stageDialog";

/**
 * Feature: "Ghi chú" on Lịch sử điều trị (owner, 2026-10-19, R-984). A column
 * of its own between Nội dung điều trị and Công đoạn, edited in place through
 * its own pencil and its own endpoint, plain text with its line breaks. Unlike
 * the content it stays open once the công đoạn is finished; a continued one is
 * shut. The patient's treatment table reads it, between Nội dung điều trị and
 * Răng.
 *
 * Real stack throughout: the fixtures go through the real API on the session
 * the real login screen gave, the restricted dentist is made through Nhân sự
 * and Phân quyền, and nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";
const STAGES = "/api/v1/app/treatment-stages";
const PENCIL = "Sửa cột Ghi chú";

interface Fixture {
  patientId: string;
  planId: string;
  branchId: string;
  lineId: string;
  stageId: string;
  note: string;
}

interface StageBody {
  id: string;
  note: string | null;
  remark: string | null;
  completedAt: string | null;
  isSuperseded: boolean;
}

/** One API call from inside the page, with the session, the antiforgery and the branch header. */
async function api(
  page: Page,
  method: "GET" | "POST" | "PUT",
  url: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> | null; text: string }> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let json: Record<string, unknown> | null;
      try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
      } catch {
        json = null; // a non-JSON error body: the status and the text tell
      }
      return { status: res.status, json, text };
    },
    { method, url, body, branch: BRANCH },
  );
}

async function staffId(page: Page): Promise<string> {
  const res = await api(page, "GET", "/api/v1/app/staff?MaxResultCount=1&Role=1");
  return (res.json as { items: { id: string }[] }).items[0].id;
}

async function readStage(page: Page, id: string): Promise<StageBody> {
  const res = await api(page, "GET", `${STAGES}/${id}`);
  expect(res.status, res.text).toBe(200);
  return res.json as unknown as StageBody;
}

/**
 * A patient of its own — the shared first patient already carries enough
 * slips to overflow its tables — with one slip and one công đoạn on it.
 * `dentistId` makes the slip that dentist's, so it is in their treating scope.
 */
async function seed(page: Page, dentistId: string | null = null): Promise<Fixture> {
  const suffix = runId();
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  const patient = await api(page, "POST", "/api/v1/app/patients", {
    firstName: `Ghi chú ${suffix}`,
    lastName: "E2E",
    dateOfBirth: null,
    gender: "male",
    phoneNumber: `0388${suffix}`,
  });
  expect(patient.status, patient.text).toBe(200);
  const patientId = String(patient.json?.id);

  const slip = await createSlipViaApi(page, patientId, [46], dentistId);
  const plan = await api(page, "GET", `/api/v1/app/patient-treatments/${slip.id}`);
  const [line] = (plan.json as { services: { id: string; serviceId: string; serviceName: string | null }[] })
    .services;

  const note = `e2e nội dung ${suffix}`;
  const stage = await api(page, "POST", STAGES, {
    patientId,
    clinicBranchId: BRANCH,
    treatmentId: slip.id,
    treatmentServiceId: line.id,
    serviceId: line.serviceId,
    name: line.serviceName || "e2e",
    note,
    staffId: await staffId(page),
    teeth: [{ toothCode: 46, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
  });
  expect(stage.status, stage.text).toBe(200);

  return {
    patientId,
    planId: slip.id,
    branchId: BRANCH,
    lineId: line.id,
    stageId: String(stage.json?.id),
    note,
  };
}

const historyRow = (panel: Locator, stageId: string) =>
  panel.locator(`.pd-stage-histrow[data-stage-id="${stageId}"]`);

/** Pencil → type → Lưu, waiting for the server's answer. */
async function writeRemark(page: Page, row: Locator, text: string): Promise<void> {
  await row.getByRole("button", { name: PENCIL }).click();
  const box = row.getByRole("textbox", { name: "Ghi chú" });
  await expect(box).toBeFocused();
  await box.fill(text);
  const saved = page.waitForResponse(
    (res) => res.url().endsWith("/remark") && res.request().method() === "PUT",
  );
  await row.getByRole("button", { name: "Lưu" }).click();
  expect((await saved).status()).toBe(200);
  await expect(box).toHaveCount(0);
}

test.describe("Lịch sử điều trị — Ghi chú", () => {
  test("is edited in place, keeps its line breaks, reads in the treatment table, stays open once finished and shuts on a continued công đoạn", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1700, height: 950 });
    await login(page);
    const fixture = await seed(page);

    // ── The column sits between Nội dung điều trị and Công đoạn ───────────
    let panel = await openStageDialog(page, fixture);
    await expect(panel.locator(".pd-stage-histhead > div")).toHaveText([
      "Ngày",
      "Dịch vụ & răng",
      "Nội dung điều trị",
      "Ghi chú",
      "Công đoạn",
      "Hành động",
    ]);

    // ── Pencil → two lines → Lưu ───────────────────────────────────────────
    const first = historyRow(panel, fixture.stageId);
    const remark = `e2e ghi chú ${runId()}\ndòng hai`;
    await writeRemark(page, first, remark);
    await expect(page.getByText("Đã lưu ghi chú")).toBeVisible();
    expect(await first.locator(".pd-stage-remarktext").innerText()).toBe(remark);

    // Its own field: the treatment content is untouched.
    let stored = await readStage(page, fixture.stageId);
    expect(stored.remark).toBe(remark);
    expect(stored.note).toBe(fixture.note);

    // ── It survives a reload ───────────────────────────────────────────────
    await page.reload();
    panel = await openStageDialog(page, fixture);
    expect(await historyRow(panel, fixture.stageId).locator(".pd-stage-remarktext").innerText()).toBe(remark);

    // ── The patient's treatment table reads it, between Nội dung and Răng ─
    await page.goto(`/patient/${fixture.patientId}?branchId=${fixture.branchId}&tab=profile`);
    const table = page.locator(".pd-treatment-table");
    const row = table.locator(`tbody tr[data-row-key="${fixture.lineId}:${fixture.stageId}"]`);
    await expect(row).toBeVisible({ timeout: 20_000 });
    const heads = await table.locator("thead th").allInnerTexts();
    const at = heads.indexOf("Ghi chú");
    expect(at, heads.join(" | ")).toBeGreaterThan(0);
    expect(heads[at - 1]).toBe("Nội dung điều trị");
    expect(heads[at + 1]).toBe("Răng");
    expect(await row.locator(".pd-tr-remark").innerText()).toBe(remark);

    // ── Continued: the old row is shut, on screen and on the server ───────
    const continued = await api(page, "POST", `${STAGES}/${fixture.stageId}/continue`, {
      staffId: await staffId(page),
      note: `e2e lần 2 ${runId()}`,
      serviceItemIds: [],
      toothCodes: [46],
    });
    expect(continued.status, continued.text).toBe(200);
    const nextId = String(continued.json?.id);

    panel = await openStageDialog(page, fixture);
    const old = historyRow(panel, fixture.stageId);
    await expect(old).toHaveAttribute("aria-disabled", "true");
    await expect(old.getByRole("button", { name: PENCIL })).toHaveCount(0);
    const late = await api(page, "PUT", `${STAGES}/${fixture.stageId}/remark`, { remark: "muộn" });
    expect(late.status, late.text).toBeGreaterThanOrEqual(400);
    stored = await readStage(page, fixture.stageId);
    expect(stored.remark).toBe(remark);

    // ── Finished: Ghi chú is still open on it, and clears back to nothing ─
    const completed = await api(page, "POST", `${STAGES}/${nextId}/complete`);
    expect(completed.status, completed.text).toBe(200);
    panel = await openStageDialog(page, fixture);
    const live = historyRow(panel, nextId);
    await expect(live.getByRole("checkbox", { name: "Hoàn thành" })).toBeChecked();
    const after = "bổ sung sau khi hoàn thành";
    await writeRemark(page, live, after);
    await expect(live.locator(".pd-stage-remarktext")).toHaveText(after);
    stored = await readStage(page, nextId);
    expect(stored.completedAt).not.toBeNull();
    expect(stored.remark).toBe(after);

    await writeRemark(page, live, "   ");
    await expect(live.locator(".pd-stage-remarktext")).toHaveText("");
    expect((await readStage(page, nextId)).remark).toBeNull();
  });

  test("without Công đoạn → Sửa there is no pencil and the server refuses; with it the dentist writes one", async ({
    page,
    browser,
  }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: 1600, height: 950 });

    const id = runId();
    const userName = `bs${id}`;
    const password = "Bacsi@123456";
    const fullName = `BAC SI ${id}`;
    const base = ["patient.read", "treatmentConsultation.read", "treatmentStage.read"];
    const leaves = [...base, "treatmentStage.update"];

    await login(page);
    await resetDentistLeaves(page, leaves);
    // A Bác sĩ, and the slip theirs: a non-dentist sees no slip at all (R-961).
    await createDentist(page, fullName, userName, password, { isDentist: true });
    const found = await api(page, "GET", `/api/v1/app/staff?MaxResultCount=10&Filter=${encodeURIComponent(fullName)}`);
    const [me] = (found.json as { items: { id: string; fullName: string }[] }).items.filter(
      (staff) => staff.fullName === fullName,
    );
    const fixture = await seed(page, me.id);
    for (const leaf of base) await setDentistLeaf(page, leaf, true);

    const { context, page: dentist } = await openDentistSession(browser, userName, password);
    // No Thêm / Tiếp tục leaf, so the panel has no tabs for openStageDialog to
    // wait on: wait on the history row instead.
    const slipDetail = `/patient/${fixture.patientId}/treatment-plan/${fixture.planId}?branchId=${fixture.branchId}&planTab=detail`;
    const panel = stagePanel(dentist);
    const row = historyRow(panel, fixture.stageId);
    try {
      await dentist.setViewportSize({ width: 1600, height: 950 });

      // ── Xem only: the column reads, the pencil is gone, a raw PUT is 403 ─
      await dentist.goto(slipDetail);
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expect(panel.locator(".pd-stage-histhead > div").nth(3)).toHaveText("Ghi chú");
      await expect(row.getByRole("button", { name: PENCIL })).toHaveCount(0);
      const refused = await api(dentist, "PUT", `${STAGES}/${fixture.stageId}/remark`, { remark: "không quyền" });
      expect(refused.status, refused.text).toBe(403);
      expect((await readStage(page, fixture.stageId)).remark).toBeNull();

      // ── Sửa granted: the pencil is there and the save goes through ───────
      await setDentistLeaf(page, "treatmentStage.update", true);
      await dentist.goto(slipDetail);
      await expect(row).toBeVisible({ timeout: 20_000 });
      const text = `bác sĩ ghi ${id}`;
      await writeRemark(dentist, row, text);
      expect((await readStage(page, fixture.stageId)).remark).toBe(text);
    } finally {
      await context.close();
      await resetDentistLeaves(page, leaves);
      await deleteDentist(page, fullName);
    }
  });
});
