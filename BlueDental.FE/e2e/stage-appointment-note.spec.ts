import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { createSlipViaApi } from "./fixtures/ledgerReceipt";
import { openStageDialog } from "./fixtures/stageDialog";

/**
 * Feature: "Ghi chú lịch hẹn" — the fourth column of the công đoạn form (BA,
 * 2026-10-27, R-1056). A free-text box with "Chọn nhanh" chips under it
 * (+1/+2/+3 ngày, +1/+2/+3 tuần), each showing the day it lands on counted from
 * Ngày điều trị. One chip at a time fills "Hẹn tái khám: dd/mm/yyyy" into the
 * box; it saves as the new công đoạn's Ghi chú (R-986), the column of Lịch sử
 * điều trị. Note text only — no appointment is booked.
 *
 * Real stack throughout: the fixtures go through the real API on the session
 * the real login screen gave, and nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";
const STAGES = "/api/v1/app/treatment-stages";
const STEPS = ["+1 ngày", "+2 ngày", "+3 ngày", "+1 tuần", "+2 tuần", "+3 tuần"];
const OFFSETS = [1, 2, 3, 7, 14, 21];

interface Fixture {
  patientId: string;
  planId: string;
  branchId: string;
  lineId: string;
  serviceId: string;
  serviceName: string;
}

/** One API call from inside the page, with the session, the antiforgery and the branch header. */
async function api(
  page: Page,
  method: "GET" | "POST",
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

/** The browser's today shifted by `days`, as "DD/MM/YYYY". */
function day(days: number): string {
  const at = new Date();
  at.setDate(at.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()}`;
}

/** The six chip captions for a Ngày điều trị `from` days off today. */
const captions = (from: number) => STEPS.map((step, at) => `${step} · ${day(from + OFFSETS[at]).slice(0, 5)}`);

const visitLine = (days: number) => `Hẹn tái khám: ${day(days)}`;

/** A patient of its own with one slip and nothing done on it yet. */
async function seed(page: Page): Promise<Fixture> {
  const suffix = runId();
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  const patient = await api(page, "POST", "/api/v1/app/patients", {
    firstName: `Hẹn ${suffix}`,
    lastName: "E2E",
    dateOfBirth: null,
    gender: "male",
    phoneNumber: `0377${suffix}`,
  });
  expect(patient.status, patient.text).toBe(200);
  const patientId = String(patient.json?.id);

  const slip = await createSlipViaApi(page, patientId, [36]);
  const plan = await api(page, "GET", `/api/v1/app/patient-treatments/${slip.id}`);
  const [line] = (plan.json as { services: { id: string; serviceId: string; serviceName: string | null }[] })
    .services;
  return {
    patientId,
    planId: slip.id,
    branchId: BRANCH,
    lineId: line.id,
    serviceId: line.serviceId,
    serviceName: line.serviceName ?? "",
  };
}

async function staffId(page: Page): Promise<string> {
  const res = await api(page, "GET", "/api/v1/app/staff?MaxResultCount=1&Role=1");
  return (res.json as { items: { id: string }[] }).items[0].id;
}

/** Bác sĩ, when the form did not fill one in from the login. */
async function ensureDoctor(page: Page, form: Locator): Promise<void> {
  const doctor = form.locator(".ant-select").first();
  if ((await doctor.locator(".ant-select-content-has-value").count()) > 0) return;
  await doctor.click();
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
}

/** Ngày điều trị typed in (mask mode), again when a late re-render resets it. */
async function typeTreatmentDate(form: Locator, value: string): Promise<void> {
  const date = form.locator(".pd-stage-date input");
  await expect(async () => {
    await date.click({ position: { x: 6, y: 8 } });
    await date.pressSequentially(value.replaceAll("/", ""));
    await date.press("Enter");
    await expect(date).toHaveValue(value, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

const pressed = (chips: Locator) =>
  chips.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-pressed") === "true"));

const only = (at: number) => STEPS.map((_, index) => index === at);

test.describe("Thêm công đoạn — Ghi chú lịch hẹn", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1700, height: 950 });
    await login(page);
  });

  test("one chip at a time fills the next visit from Ngày điều trị, and it saves as the history's Ghi chú", async ({
    page,
  }) => {
    const fixture = await seed(page);
    const panel = await openStageDialog(page, fixture);
    await panel.locator(`.pd-stage-picks button[data-line-id="${fixture.lineId}"]`).click();

    // ── The fourth column ───────────────────────────────────────────────────
    await expect(panel.locator(".pd-stage-colhead")).toHaveText([
      "Chi tiết",
      "Ngày - Nhân sự",
      "Dịch vụ đã chọn",
      "Nội dung điều trị",
      "Ghi chú lịch hẹn",
    ]);
    const form = panel.locator(`.pd-stage-form[data-item-id="${fixture.lineId}"]`);
    const grid = await form.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(grid.split(" ")).toHaveLength(4);
    // Nội dung điều trị keeps its required asterisk; the fourth column is not required.
    await expect(
      form.locator(".floating-field-label", { hasText: "Nội dung điều trị" }).locator(".floating-field-required"),
    ).toHaveText("*");
    const box = form.getByRole("textbox", { name: "Ghi chú lịch hẹn" });
    const group = form.getByRole("group", { name: "Chọn nhanh" });
    const chips = group.getByRole("button");
    await expect(group.locator("span")).toHaveText("Chọn nhanh");
    await expect(chips).toHaveText(captions(0));
    expect(await pressed(chips)).toEqual(STEPS.map(() => false));

    // ── A chip adds its line under what was typed ──────────────────────────
    const typed = `Gọi trước ${runId()}`;
    await box.fill(typed);
    await chips.nth(3).click();
    await expect(box).toHaveValue(`${typed}\n${visitLine(7)}`);
    expect(await pressed(chips)).toEqual(only(3));

    // ── Another chip takes its place; the same chip again takes it out ─────
    await chips.nth(4).click();
    await expect(box).toHaveValue(`${typed}\n${visitLine(14)}`);
    expect(await pressed(chips)).toEqual(only(4));
    await chips.nth(4).click();
    await expect(box).toHaveValue(typed);
    expect(await pressed(chips)).toEqual(STEPS.map(() => false));

    // ── The days count from Ngày điều trị, and the picked line moves with it
    await chips.nth(0).click();
    await expect(box).toHaveValue(`${typed}\n${visitLine(1)}`);
    await typeTreatmentDate(form, day(-2));
    await expect(chips).toHaveText(captions(-2));
    await expect(box).toHaveValue(`${typed}\n${visitLine(-1)}`);
    expect(await pressed(chips)).toEqual(only(0));
    const remark = `${typed}\n${visitLine(-1)}`;

    // ── Lưu carries it, the server keeps it as the công đoạn's Ghi chú ──────
    await ensureDoctor(page, form);
    await form.locator("textarea").first().fill(`e2e ghi chú lịch hẹn ${runId()}`);
    const posted = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().endsWith(STAGES),
    );
    await panel.getByRole("button", { name: "Lưu công đoạn" }).click();
    const response = await posted;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON().remark).toBe(remark);
    const stage = (await response.json()) as { id: string; remark: string | null };
    expect(stage.remark).toBe(remark);
    await expect(page.getByText("Đã thêm công đoạn")).toBeVisible();

    const history = panel.locator(`.pd-stage-histrow[data-stage-id="${stage.id}"] .pd-stage-remarktext`);
    await expect(history).toBeVisible();
    expect(await history.innerText()).toBe(remark);

    // ── A separate read and a reload agree ─────────────────────────────────
    const read = await api(page, "GET", `${STAGES}/${stage.id}`);
    expect(read.status, read.text).toBe(200);
    expect(read.json?.remark).toBe(remark);
    await page.reload();
    const again = await openStageDialog(page, fixture);
    const reloaded = again.locator(`.pd-stage-histrow[data-stage-id="${stage.id}"] .pd-stage-remarktext`);
    await expect(reloaded).toBeVisible();
    expect(await reloaded.innerText()).toBe(remark);
  });

  test("Tiếp tục công đoạn saves it on the new công đoạn, and an empty box saves none", async ({ page }) => {
    const fixture = await seed(page);
    const first = await api(page, "POST", STAGES, {
      patientId: fixture.patientId,
      clinicBranchId: BRANCH,
      treatmentId: fixture.planId,
      treatmentServiceId: fixture.lineId,
      serviceId: fixture.serviceId,
      name: fixture.serviceName || "e2e",
      note: `e2e lần 1 ${runId()}`,
      staffId: await staffId(page),
      teeth: [{ toothCode: 36, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
    });
    expect(first.status, first.text).toBe(200);
    const firstId = String(first.json?.id);
    // Nothing typed into the box: the first công đoạn carries no Ghi chú.
    expect(first.json?.remark ?? null).toBeNull();

    const panel = await openStageDialog(page, fixture);
    await panel.getByRole("tab", { name: /TIẾP TỤC CÔNG ĐOẠN/ }).click();
    await panel.locator(`.pd-stage-picks button[data-stage-id="${firstId}"]`).click();
    const form = panel.locator(`.pd-stage-form[data-item-id="continue:${fixture.lineId}"]`);
    const chips = form.getByRole("group", { name: "Chọn nhanh" }).getByRole("button");
    await chips.nth(5).click();
    await expect(form.getByRole("textbox", { name: "Ghi chú lịch hẹn" })).toHaveValue(visitLine(21));

    await ensureDoctor(page, form);
    await form.locator("textarea").first().fill(`e2e lần 2 ${runId()}`);
    const continued = page.waitForResponse(
      (res) => res.url().includes(`${STAGES}/${firstId}/continue`) && res.request().method() === "POST",
    );
    await panel.getByRole("button", { name: "Tiếp tục công đoạn" }).click();
    const response = await continued;
    expect(response.status()).toBe(200);
    const next = (await response.json()) as { id: string; remark: string | null };
    expect(next.remark).toBe(visitLine(21));

    // The new row shows it; the first keeps its own (empty) Ghi chú.
    await expect(panel.locator(`.pd-stage-histrow[data-stage-id="${next.id}"] .pd-stage-remarktext`)).toHaveText(
      visitLine(21),
    );
    const firstRead = await api(page, "GET", `${STAGES}/${firstId}`);
    expect(firstRead.json?.remark ?? null).toBeNull();
    const nextRead = await api(page, "GET", `${STAGES}/${next.id}`);
    expect(nextRead.json?.remark).toBe(visitLine(21));
  });
});
