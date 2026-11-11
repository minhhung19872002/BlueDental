import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { createSlipViaApi } from "./fixtures/ledgerReceipt";
import { BRANCH_ONE, call, syntheticPhone } from "./fixtures/marketingTicket";
import { openStageDialog, type SlipRef } from "./fixtures/stageDialog";

/**
 * Feature: the công đoạn form without "Dịch vụ đã chọn" (owner, 2026-11-11,
 * R-1206). The service field, the tooth grid and Hình ảnh are gone; the Răng
 * line heads "Nội dung điều trị", which takes the two cells. A line booked as a
 * whole jaw reads "Răng: Hàm trên" (Hàm dưới, Hai hàm) and saves every tooth of
 * it — none can be left out; a line of single teeth keeps its chips, each one
 * picked or not.
 *
 * Real stack: the patient and the slip go through the real API on the session
 * the real login screen gave, and the công đoạn is saved by the form's Lưu.
 */

const STAGES = "/api/v1/app/treatment-stages";
/** UPPER_TEETH of the tooth chart: 18 → 11, then 21 → 28. */
const UPPER_JAW = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];

interface Fixture extends SlipRef {
  lineId: string;
}

/** A patient of the run's own with one slip whose only line covers `teeth`. */
async function seed(page: Page, teeth: number[]): Promise<Fixture> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const patient = await call<{ id: string }>(page, "POST", "/api/v1/app/patients", {
    firstName: `Răng ${runId()}`,
    lastName: "E2E",
    dateOfBirth: null,
    gender: "male",
    phoneNumber: syntheticPhone(),
  });
  expect(patient.status).toBe(200);

  const slip = await createSlipViaApi(page, patient.body.id, teeth);
  const plan = await call<{ services: { id: string }[] }>(page, "GET", `/api/v1/app/patient-treatments/${slip.id}`);
  return { patientId: patient.body.id, planId: slip.id, branchId: BRANCH_ONE, lineId: plan.body.services[0].id };
}

async function openForm(page: Page, fixture: Fixture): Promise<{ panel: Locator; form: Locator }> {
  const panel = await openStageDialog(page, fixture);
  await panel.locator(`.pd-stage-picks button[data-line-id="${fixture.lineId}"]`).click();
  const form = panel.locator(`.pd-stage-form[data-item-id="${fixture.lineId}"]`);
  await expect(form).toBeVisible();
  return { panel, form };
}

/** Bác sĩ when the login did not fill one in, a note, then Lưu; the teeth it sent. */
async function saveTeeth(page: Page, panel: Locator, form: Locator): Promise<number[]> {
  const doctor = form.locator(".ant-select").first();
  if ((await doctor.locator(".ant-select-content-has-value").count()) === 0) {
    await doctor.click();
    await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
  }
  await form.locator("textarea").first().fill(`e2e răng ${runId()}`);
  const posted = page.waitForResponse((res) => res.request().method() === "POST" && res.url().endsWith(STAGES));
  await panel.getByRole("button", { name: "Lưu công đoạn" }).click();
  const response = await posted;
  expect(response.ok(), await response.text()).toBeTruthy();
  const sent = response.request().postDataJSON() as { teeth: { toothCode: number }[] };
  return sent.teeth.map((tooth) => tooth.toothCode).sort((a, b) => a - b);
}

test.describe("Thêm công đoạn — Răng trong Nội dung điều trị", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1700, height: 950 });
    await login(page);
  });

  test("single teeth keep their chips at the head of Nội dung điều trị; no Dịch vụ, no pictures", async ({
    page,
  }) => {
    const fixture = await seed(page, [36, 37]);
    const { panel, form } = await openForm(page, fixture);

    // Three heads over the form, Nội dung điều trị over two of its four cells.
    await expect(panel.locator(".pd-stage-colhead")).toHaveText([
      "Chi tiết",
      "Ngày - Nhân sự",
      "Nội dung điều trị",
      "Ghi chú lịch hẹn",
    ]);
    const content = form.locator(".pd-stage-content");
    expect(await content.evaluate((el) => getComputedStyle(el).gridColumnStart)).toBe("span 2");
    // Twice the width of Ngày - Nhân sự, in the form and over it. The form
    // card pads its columns in, so the widths compare, not the edges.
    const ratio = async (wide: Locator, single: Locator) =>
      (await wide.boundingBox())!.width / (await single.boundingBox())!.width;
    const heads = panel.locator(".pd-stage-colhead");
    expect(await ratio(heads.nth(2), heads.nth(1))).toBeGreaterThan(1.9);
    expect(await ratio(content, form.locator("> div").first())).toBeGreaterThan(1.9);

    // Gone: the read-out service, its tooth grid and Hình ảnh.
    await expect(form.locator("input[disabled]")).toHaveCount(0);
    await expect(form.getByRole("button", { name: "Tải Ảnh" })).toHaveCount(0);
    await expect(form.locator(".pd-stage-images")).toHaveCount(0);

    // The Răng line is the column's first thing; both teeth start picked.
    const teeth = content.locator("> .pd-stage-teeth:first-child");
    await expect(teeth).toHaveCount(1);
    const chips = teeth.locator("button:not(.pd-stage-chartbtn)");
    await expect(chips).toHaveText(["36", "37"]);
    await expect(chips.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");

    // One left out for later: only 36 goes on this công đoạn.
    await chips.nth(1).click();
    await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "false");
    expect(await saveTeeth(page, panel, form)).toEqual([36]);
  });

  test("a whole jaw reads as its name, has no chips, and saves every tooth of it", async ({ page }) => {
    const fixture = await seed(page, UPPER_JAW);
    const { panel, form } = await openForm(page, fixture);

    const teeth = form.locator(".pd-stage-content > .pd-stage-teeth:first-child");
    await expect(teeth).toHaveClass(/pd-stage-teeth--jaw/);
    await expect(teeth).toHaveText("Răng: Hàm trên");
    // Nothing to tick or untick — not a chip, not the chart button.
    await expect(teeth.getByRole("button")).toHaveCount(0);

    expect(await saveTeeth(page, panel, form)).toEqual([...UPPER_JAW].sort((a, b) => a - b));
  });
});
