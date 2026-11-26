import { expect, test, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";
import {
  CONSENT_FORM,
  SETS_API,
  SHEETS_API,
  consentPicker,
  openBenhAn,
  seedPatientWithSlips,
  type SeededPatient,
} from "./fixtures/medicalRecordSet";

/**
 * Feature R-1326: each copy of mẫu 5, Phiếu tư vấn và xác nhận đồng ý điều trị,
 * prints only the services picked for it — the braces package on one copy, a
 * later service on a copy of its own (the clinic's ask, 2026-11-26).
 *
 * Real stack: a patient of the run's own with three treatment slips and a set
 * holding all three; copies are added and re-picked through the real UI, the
 * picks read back from the real API. Nothing is intercepted.
 */

interface FactsService {
  id: string;
  serviceName: string;
  amount: number;
}

interface Sheet {
  id: string;
  form: number;
  recordSetId: string;
  serviceIds: string[] | null;
  cancelledAt: string | null;
}

const LIVE_CARD = ".pd-sheet-card:not(.pd-sheet-card--cancelled)";
const CONSENT = 5;

function blank(page: Page, field: string) {
  return page.frameLocator(".mr-doc-frame").locator(`[data-medical-record-field="${field}"]`);
}

/** Row `n` (1-based) of IV. Chi phí điều trị: its number and its service cell. */
function costRow(page: Page, n: number) {
  const first = 21 + (n - 1) * 3;
  return { number: blank(page, `consultation.text.${first}`), service: blank(page, `consultation.text.${first + 1}`) };
}

const money = (amount: number) => amount.toLocaleString("vi-VN");

function consentCards(page: Page) {
  return page.locator(".pd-medical-form", { hasText: CONSENT_FORM }).locator(LIVE_CARD);
}

async function openCopy(page: Page, index: number) {
  await consentCards(page).nth(index).locator(".pd-sheet-open").click();
  await expect(page.locator(".mr-doc-frame").first()).toBeVisible();
  await expect(blank(page, "consultation.text.21")).toBeAttached();
}

async function sheetsOf(page: Page, patientId: string, setId: string): Promise<Sheet[]> {
  const res = await call<{ items: Sheet[] }>(page, `${SHEETS_API}?patientId=${patientId}&maxResultCount=200`);
  expect(res.status).toBe(200);
  return res.body.items.filter((sheet) => sheet.recordSetId === setId && sheet.form === CONSENT && !sheet.cancelledAt);
}

test.describe("Bệnh án — mẫu 5 prints the services picked for its copy (R-1326)", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let patient: SeededPatient;
  let setId: string;
  let services: FactsService[];

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    patient = await seedPatientWithSlips(page, 3);
    const made = await call<{ id: string }>(page, SETS_API, {
      method: "POST",
      json: { patientId: patient.id, treatmentPlanIds: patient.slips.map((slip) => slip.id), visibleForms: [] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    setId = made.body.id;
    const facts = await call<{ services: FactsService[] }>(page, `${SETS_API}/${setId}/sheet-facts`);
    expect(facts.status).toBe(200);
    services = facts.body.services;
    expect(services).toHaveLength(3);
    // One line per slip, the slips' lines in order.
    expect(services.map((service) => service.id)).toEqual(patient.slips.map((slip) => slip.lineId));
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a copy is added with the services ticked for it, the next offers the rest, and the pick changes later", async ({
    page,
  }) => {
    const [a, b, c] = services;
    await openBenhAn(page, patient.id);

    // The set's first copy: every service offered, every one ticked.
    await page.locator(".pd-medical-form", { hasText: CONSENT_FORM }).getByRole("button", { name: "Thêm" }).click();
    const picker = consentPicker(page);
    await expect(picker).toBeVisible();
    for (const service of services) {
      await expect(picker.getByRole("checkbox", { name: service.serviceName, exact: true })).toBeChecked();
    }
    await expect(picker.getByText("Đã chọn 3/3 dịch vụ")).toBeVisible();
    await expect(picker.locator(".mr-consent-held")).toHaveCount(0);

    // Nothing ticked: nothing to add.
    await picker.getByRole("checkbox", { name: "Tất cả dịch vụ" }).uncheck();
    await expect(picker.getByText("Đã chọn 0/3 dịch vụ")).toBeVisible();
    await expect(picker.getByRole("button", { name: "Thêm phiếu" })).toBeDisabled();

    // Bản 01 keeps the first service only.
    await picker.getByRole("checkbox", { name: a.serviceName, exact: true }).check();
    await expect(picker.getByText("Đã chọn 1/3 dịch vụ")).toBeVisible();
    await picker.getByRole("button", { name: "Thêm phiếu" }).click();
    await expect(picker).toBeHidden();
    await expect(page.getByText("Đã thêm phiếu bệnh án").first()).toBeVisible();
    await expect(consentCards(page)).toHaveCount(1);
    await expect(costRow(page, 1).number).toHaveText("1");
    await expect(costRow(page, 1).service).toContainText(`Răng 12 - ${a.serviceName}`);
    await expect(costRow(page, 2).number).toHaveText("");
    await expect(costRow(page, 2).service).toHaveText("");
    await expect(blank(page, "consultation.text.46")).toHaveText(money(a.amount));
    await expect(blank(page, "consultation.text.47")).toContainText("đồng");

    // Bản 02 offers what Bản 01 does not print, and says where the first one is.
    await page.locator(".pd-medical-form", { hasText: CONSENT_FORM }).getByRole("button", { name: "Thêm" }).click();
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("checkbox", { name: a.serviceName, exact: true })).not.toBeChecked();
    await expect(picker.getByRole("checkbox", { name: b.serviceName, exact: true })).toBeChecked();
    await expect(picker.getByRole("checkbox", { name: c.serviceName, exact: true })).toBeChecked();
    await expect(picker.locator(".mr-consent-row", { hasText: a.serviceName })).toContainText("Đã có ở Bản 01");
    await expect(picker.locator(".mr-consent-held")).toHaveCount(1);
    await expect(picker.getByText("Đã chọn 2/3 dịch vụ")).toBeVisible();
    await picker.getByRole("button", { name: "Thêm phiếu" }).click();
    await expect(picker).toBeHidden();
    await expect(consentCards(page)).toHaveCount(2);
    await expect(costRow(page, 1).service).toContainText(`Răng 11 - ${b.serviceName}`);
    await expect(costRow(page, 2).number).toHaveText("2");
    await expect(costRow(page, 2).service).toContainText(`Răng 21 - ${c.serviceName}`);
    await expect(costRow(page, 3).number).toHaveText("");
    await expect(blank(page, "consultation.text.46")).toHaveText(money(b.amount + c.amount));

    // The picks are the server's, and a reload draws them again.
    const [first, second] = await sheetsOf(page, patient.id, setId);
    expect(first.serviceIds).toEqual([a.id]);
    expect([...(second.serviceIds ?? [])].sort()).toEqual([b.id, c.id].sort());
    await page.reload();
    await openBenhAn(page, patient.id);
    await openCopy(page, 0);
    await expect(costRow(page, 1).service).toContainText(a.serviceName);
    await expect(costRow(page, 2).number).toHaveText("");
    await expect(blank(page, "consultation.text.46")).toHaveText(money(a.amount));

    // "Dịch vụ của phiếu" on Bản 01: its own pick ticked, the others on Bản 02.
    await page.locator(".pd-medical-canvas-tools").getByRole("button", { name: "Dịch vụ của phiếu" }).click();
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("checkbox", { name: a.serviceName, exact: true })).toBeChecked();
    await expect(picker.getByRole("checkbox", { name: c.serviceName, exact: true })).not.toBeChecked();
    await expect(picker.locator(".mr-consent-row", { hasText: c.serviceName })).toContainText("Đã có ở Bản 02");
    await picker.getByRole("checkbox", { name: c.serviceName, exact: true }).check();
    await picker.getByRole("button", { name: "Lưu" }).click();
    await expect(picker).toBeHidden();
    await expect(page.getByText("Đã cập nhật dịch vụ của phiếu").first()).toBeVisible();
    await expect(costRow(page, 2).number).toHaveText("2");
    await expect(costRow(page, 2).service).toContainText(`Răng 21 - ${c.serviceName}`);
    await expect(blank(page, "consultation.text.46")).toHaveText(money(a.amount + c.amount));

    // …kept apart from Lưu: a reload still prints both, and Bản 02 is as it was.
    await page.reload();
    await openBenhAn(page, patient.id);
    await openCopy(page, 0);
    await expect(blank(page, "consultation.text.46")).toHaveText(money(a.amount + c.amount));
    await openCopy(page, 1);
    await expect(blank(page, "consultation.text.46")).toHaveText(money(b.amount + c.amount));
  });

  test("a copy saved before R-1326 prints every service; the server keeps picks to mẫu 5 and the set's own lines", async ({
    page,
    browser,
  }) => {
    await page.goto("/patient");

    // A copy added with no pick — as every copy before R-1326 was.
    const legacy = await call<Sheet>(page, SHEETS_API, {
      method: "POST",
      json: { patientId: patient.id, recordSetId: setId, form: CONSENT, title: CONSENT_FORM },
    });
    expect(legacy.status, JSON.stringify(legacy.body)).toBe(200);
    expect(legacy.body.serviceIds).toBeNull();

    // A line of another patient's slip is not this set's to pick.
    const stranger = await seedPatientWithSlips(page, 1);
    const foreign = await call(page, `${SHEETS_API}/${legacy.body.id}/services`, {
      method: "PUT",
      json: { serviceIds: [stranger.slips[0].lineId] },
    });
    expect(foreign.status).toBe(403);
    expect(JSON.stringify(foreign.body)).toContain("BlueDental:Patient:0041");

    // Only mẫu 5 picks: a Bìa refuses.
    const cover = await call<Sheet>(page, SHEETS_API, {
      method: "POST",
      json: { patientId: patient.id, recordSetId: setId, form: 1, title: "Bìa hồ sơ bệnh án" },
    });
    expect(cover.status, JSON.stringify(cover.body)).toBe(200);
    const notPickable = await call(page, `${SHEETS_API}/${cover.body.id}/services`, {
      method: "PUT",
      json: { serviceIds: [services[0].id] },
    });
    expect(notPickable.status).toBe(403);
    expect(JSON.stringify(notPickable.body)).toContain("BlueDental:Patient:0040");

    // Another branch cannot change the pick.
    const other = await browser.newContext();
    try {
      const otherPage = await other.newPage();
      await login(otherPage, BRANCH2_USER);
      const peek = await call(otherPage, `${SHEETS_API}/${legacy.body.id}/services`, {
        method: "PUT",
        json: { serviceIds: [services[0].id] },
      });
      expect([403, 404]).toContain(peek.status);
    } finally {
      await other.close();
    }
    const after = (await sheetsOf(page, patient.id, setId)).find((sheet) => sheet.id === legacy.body.id);
    expect(after?.serviceIds).toBeNull();

    // The legacy copy, Bản 03, prints all three.
    await openBenhAn(page, patient.id);
    await expect(consentCards(page)).toHaveCount(3);
    await openCopy(page, 2);
    await expect(costRow(page, 3).number).toHaveText("3");
    await expect(blank(page, "consultation.text.46")).toHaveText(
      money(services.reduce((sum, service) => sum + service.amount, 0)),
    );

    // Every service is on a copy now: a new one starts with none ticked.
    await page.locator(".pd-medical-form", { hasText: CONSENT_FORM }).getByRole("button", { name: "Thêm" }).click();
    const picker = consentPicker(page);
    await expect(picker).toBeVisible();
    await expect(picker.getByText("Đã chọn 0/3 dịch vụ")).toBeVisible();
    await expect(picker.locator(".mr-consent-row", { hasText: services[1].serviceName })).toContainText(
      "Đã có ở Bản 02, Bản 03",
    );
    await expect(picker.getByRole("button", { name: "Thêm phiếu" })).toBeDisabled();
    await picker.getByRole("button", { name: "Huỷ" }).click();
    await expect(picker).toBeHidden();
    await expect(consentCards(page)).toHaveCount(3);
  });
});
