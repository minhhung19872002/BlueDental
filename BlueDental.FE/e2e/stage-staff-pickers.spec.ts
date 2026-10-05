import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: who the "Chi tiết phiếu" staff pickers offer (owner, 2026-10-05).
 *
 * - Bác sĩ and Bác sĩ hỗ trợ: staff ticked "Bác sĩ" on the staff form.
 * - Phụ tá: staff ticked "Phụ tá" or "Y sĩ".
 * - Staff with no box ticked are offered by none, and a form does not start
 *   with one of them even when the previous công đoạn names them.
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";

interface Staff {
  id: string;
  name: string | null;
  surname: string | null;
  userName: string;
  isDentist: boolean;
  isAssistant: boolean;
  isHygienist: boolean;
}

async function call(page: Page, method: string, url: string, body?: unknown): Promise<{ status: number; json: unknown; text: string }> {
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

const nameOf = (s: Staff) => [s.surname, s.name].filter(Boolean).join(" ").trim() || s.userName;

function localIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** One active member of staff of each kind the pickers tell apart, free today. */
async function staffOfEachKind(page: Page) {
  const res = await call(
    page,
    "GET",
    `/api/v1/app/staff?MaxResultCount=1000&IsActive=true&AvailableOn=${localIsoDate(new Date())}`,
  );
  const all = (res.json as { items: Staff[] }).items;
  const untagged = all.find((s) => !s.isDentist && !s.isAssistant && !s.isHygienist);
  const dentist = all.find((s) => s.isDentist && !s.isAssistant && !s.isHygienist);
  const hygienist = all.find((s) => s.isHygienist && !s.isDentist && !s.isAssistant);
  expect(untagged && dentist && hygienist, "the demo clinic should have untagged, dentist and Y sĩ staff").toBeTruthy();
  return { untagged: untagged!, dentist: dentist!, hygienist: hygienist! };
}

/** A fresh line on an open slip with one open công đoạn worked by `staffId`. */
async function lineWithStageBy(page: Page, staffId: string) {
  const slips = (await call(page, "GET", "/api/v1/app/patient-treatments?maxResultCount=300")).json as {
    items: { id: string; patientId: string; branchId: string; status: number; services: { id: string; serviceId: string; serviceName: string | null; warrantyDays: number }[] }[];
  };
  const slip = slips.items.find((s) => s.branchId === BRANCH && s.status !== 5 && s.status !== 6)!;
  const serviceId = slips.items.flatMap((s) => s.services).find((l) => l.warrantyDays <= 0)!.serviceId;
  const known = new Set(slip.services.map((l) => l.id));
  const tooth = { toothCode: 16, selected: true, top: false, right: false, bottom: false, left: false, center: false };

  const added = await call(page, "POST", `/api/v1/app/patient-treatments/${slip.id}/services`, {
    serviceId, price: 100000, quantity: 1, discountType: 0, discountValue: 0, status: 1, teeth: [tooth],
  });
  expect(added.status, added.text).toBe(200);
  const line = (added.json as { services: { id: string; serviceId: string; serviceName: string | null }[] }).services.find(
    (l) => !known.has(l.id),
  )!;

  const stage = await call(page, "POST", "/api/v1/app/treatment-stages", {
    patientId: slip.patientId,
    clinicBranchId: BRANCH,
    treatmentId: slip.id,
    treatmentServiceId: line.id,
    serviceId: line.serviceId,
    name: line.serviceName || "e2e",
    note: `e2e chọn nhân sự ${runId()}`,
    staffId,
    teeth: [tooth],
  });
  expect(stage.status, stage.text).toBe(200);
  return { patientId: slip.patientId, planId: slip.id, lineId: line.id };
}

/** Types into a picker and returns the option labels the server sent back. */
async function offered(page: Page, picker: Locator, term: string): Promise<string[]> {
  await picker.click();
  const searched = page.waitForResponse(
    (r) => r.url().includes("/api/v1/app/staff?") && r.url().includes(`Filter=${encodeURIComponent(term).replace(/%20/g, "+")}`),
  );
  await page.keyboard.type(term);
  await searched;
  const dropdown = page.locator(".ant-select-dropdown:visible");
  await expect(dropdown.locator(".ant-select-item-option, .ant-select-item-empty").first()).toBeVisible();
  const labels = await dropdown.locator(".ant-select-item-option").allInnerTexts();
  await page.keyboard.press("Escape");
  return labels.map((l) => l.trim());
}

test.describe("Chi tiết phiếu — người được chọn theo vai trò", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, "/api/v1/app/patients");
  });

  test("Bác sĩ offers only staff ticked Bác sĩ, Phụ tá adds Y sĩ, and an untagged name is not carried in", async ({
    page,
  }) => {
    const { untagged, dentist, hygienist } = await staffOfEachKind(page);
    const line = await lineWithStageBy(page, untagged.id);

    await page.goto(`/patient/${line.patientId}/treatment-plan/${line.planId}?branchId=${BRANCH}`);
    await expect(page.locator(`.pdt-table tbody tr[data-row-key="${line.lineId}"]`)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Thêm công đoạn" }).click();
    const dialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await dialog.getByRole("tab", { name: /TIẾP TỤC CÔNG ĐOẠN/ }).click();
    await dialog.locator(`.pd-stage-picks button[data-line-id="${line.lineId}"]`).click();
    const form = dialog.locator(`.pd-stage-form[data-item-id="continue:${line.lineId}"]`);
    const [doctor, assistant, secondDoctor] = [0, 1, 2].map((i) => form.locator(".ant-select").nth(i));

    // The previous công đoạn's untagged doctor is not carried into the form.
    await expect(doctor).not.toContainText(nameOf(untagged));
    await expect(doctor.locator(".ant-select-selection-item, .ant-select-content-has-value")).toHaveCount(0);

    expect(await offered(page, doctor, nameOf(untagged))).not.toContain(nameOf(untagged));
    expect(await offered(page, doctor, nameOf(hygienist))).not.toContain(nameOf(hygienist));
    expect(await offered(page, doctor, nameOf(dentist))).toContain(nameOf(dentist));

    expect(await offered(page, assistant, nameOf(hygienist))).toContain(nameOf(hygienist));
    expect(await offered(page, assistant, nameOf(untagged))).not.toContain(nameOf(untagged));
    expect(await offered(page, assistant, nameOf(dentist))).not.toContain(nameOf(dentist));

    expect(await offered(page, secondDoctor, nameOf(dentist))).toContain(nameOf(dentist));
    expect(await offered(page, secondDoctor, nameOf(untagged))).not.toContain(nameOf(untagged));
  });
  test("on the slip's own page, Bác sĩ is marked required and Thanh toán moves to the payment tab", async ({
    page,
  }) => {
    const { dentist } = await staffOfEachKind(page);
    const line = await lineWithStageBy(page, dentist.id);

    await page.goto(`/patient/${line.patientId}/treatment-plan/${line.planId}?planTab=detail&branchId=${BRANCH}`);
    await expect(page.locator(`.pdt-table tbody tr[data-row-key="${line.lineId}"]`)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Thêm công đoạn" }).click();
    const dialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await dialog.getByRole("tab", { name: /TIẾP TỤC CÔNG ĐOẠN/ }).click();
    await dialog.locator(`.pd-stage-picks button[data-line-id="${line.lineId}"]`).click();
    const form = dialog.locator(`.pd-stage-form[data-item-id="continue:${line.lineId}"]`);

    // Bác sĩ is validated as required, so its label carries the asterisk.
    const doctorLabel = form.locator(".floating-field").filter({ has: page.locator(".ant-select") }).first();
    await expect(doctorLabel.locator(".floating-field-required")).toHaveText("*");

    await dialog.getByRole("button", { name: "Thanh toán" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/treatment-plan/${line.planId}[?]planTab=payment-v2&branchId=`));
    await expect(page.locator(".pdt-tab.active, [role=tab][aria-selected=true]").first()).toHaveText("Thanh toán");
  });
});
