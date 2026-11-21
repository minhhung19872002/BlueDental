import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";
import {
  SETS_API,
  SHEETS_API,
  cancelSheet,
  openBenhAn,
  seedPatientWithSlips,
  type SeededPatient,
} from "./fixtures/medicalRecordSet";

/**
 * Feature: Hợp đồng thỏa thuận niềng răng (mẫu 10) filled from Bệnh án chỉnh
 * nha (mẫu 3) of the same set (BA, 2026-11-01, R-1097) — Chẩn đoán, Nhổ răng,
 * Kế hoạch điều trị, Thời gian điều trị dự kiến and the new Loại mắc cài row.
 * One way only; what is typed on mẫu 10 wins; the newest mẫu 3 not cancelled.
 *
 * Real stack: a patient of the run's own with one treatment slip and a set
 * for it; the sheets are written, saved and read back through the real UI.
 * Nothing is intercepted.
 */

const LIVE_CARD = ".pd-sheet-card:not(.pd-sheet-card--cancelled)";
const ORTHODONTIC = "Bệnh án chỉnh nha";
const CONTRACT = "Hợp đồng thỏa thuận niềng răng";

function sheet(page: Page): FrameLocator {
  return page.frameLocator(".mr-doc-frame");
}

function blank(page: Page, field: string) {
  return sheet(page).locator(`[data-medical-record-field="${field}"]`);
}

function cardsUnder(page: Page, form: string) {
  return page.locator(".pd-medical-form", { hasText: form }).locator(LIVE_CARD);
}

async function addSheet(page: Page, form: string) {
  await page.locator(".pd-medical-form", { hasText: form }).getByRole("button", { name: "Thêm" }).click();
  await expect(page.getByText("Đã thêm phiếu bệnh án").first()).toBeVisible();
}

/** Opens a form's newest live sheet. */
async function openNewest(page: Page, form: string) {
  await cardsUnder(page, form).last().locator(".pd-sheet-open").click();
  await expect(page.locator(".mr-doc-frame").first()).toBeVisible();
  await expect(sheet(page).locator("[data-medical-record-field]").first()).toBeAttached();
}

async function write(page: Page, field: string, text: string) {
  await blank(page, field).click();
  await page.keyboard.press("End");
  await page.keyboard.type(text);
}

async function save(page: Page) {
  await page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu phiếu bệnh án").first()).toBeVisible();
}

test.describe("Bệnh án — mẫu 10 filled from mẫu 3 of the set (R-1097)", () => {
  test.describe.configure({ timeout: 180_000 });

  let patient: SeededPatient;

  test.beforeEach(async ({ page }) => {
    await login(page);
    patient = await seedPatientWithSlips(page, 1);
  });

  test("mẫu 3's diagnosis, extraction, plan, time and bracket reach mẫu 10; mẫu 10's own writing wins; a cancelled mẫu 3 gives way", async ({
    page,
  }) => {
    const made = await call<{ id: string }>(page, SETS_API, {
      method: "POST",
      json: { patientId: patient.id, treatmentPlanIds: [patient.slips[0].id], visibleForms: [] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    await openBenhAn(page, patient.id);

    // Mẫu 3: VIII keeps the record's diagnosis on its first line and takes
    // three more by hand — one past what mẫu 10 prints under "1. Chẩn đoán".
    await addSheet(page, ORTHODONTIC);
    await openNewest(page, ORTHODONTIC);
    await expect(blank(page, "orthodontic.text.86")).toContainText(patient.diagnosisName);
    await write(page, "orthodontic.text.87", "Hạng II xương");
    await write(page, "orthodontic.text.88", "Chen chúc răng cửa dưới");
    await write(page, "orthodontic.text.89", "Cắn sâu");
    await write(page, "orthodontic.text.95", "14, 24");
    await write(page, "orthodontic.text.99", "24");
    await blank(page, "orthodontic.checkbox.62").check();
    await write(page, "orthodontic.text.101", "45");
    await save(page);

    // Mẫu 10, without a reload: every one of them, in its own blank.
    await addSheet(page, CONTRACT);
    await openNewest(page, CONTRACT);
    await expect(blank(page, "orthodontic-contract.text.7")).toContainText(patient.diagnosisName);
    await expect(blank(page, "orthodontic-contract.text.8")).toHaveText("Hạng II xương");
    await expect(blank(page, "orthodontic-contract.text.9")).toHaveText("Chen chúc răng cửa dưới");
    await expect(blank(page, "custom.line.orthodontic-contract.text.9.1")).toHaveText("Cắn sâu");
    await expect(blank(page, "orthodontic-contract.text.10")).toHaveText("14, 24");
    await expect(blank(page, "orthodontic-contract.text.11")).toContainText("Răng 12 - ");
    await expect(blank(page, "orthodontic-contract.text.19")).toHaveText("24 tháng");
    // Loại mắc cài: Kim loại tự động ticked at 45 triệu, the other three untouched.
    await expect(blank(page, "orthodontic-contract.checkbox.2")).toBeChecked();
    await expect(blank(page, "orthodontic-contract.text.35")).toHaveText("45");
    for (const box of [1, 3, 4]) await expect(blank(page, `orthodontic-contract.checkbox.${box}`)).not.toBeChecked();
    for (const price of [34, 36, 37]) await expect(blank(page, `orthodontic-contract.text.${price}`)).toHaveText("");
    // As the clinic's copy lays it out (R-1266): the label on a line of its own,
    // under it two rows of two choices — each choice on one line, the two rows
    // lined up in the same columns.
    const choices = await sheet(page)
      .locator('p[data-record-section="bracket-types"] .bracket-opt')
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return { left: box.left, top: box.top, lines: box.height / parseFloat(getComputedStyle(node.closest("p")!).lineHeight) };
        }),
      );
    expect(choices, "four choices").toHaveLength(4);
    for (const [at, choice] of choices.entries()) expect(choice.lines, `choice ${at + 1} on one line`).toBeLessThan(1.5);
    expect(choices[0].top, "Kim loại and Kim loại tự động on one row").toBeCloseTo(choices[1].top, 0);
    expect(choices[2].top, "KLTĐ Cánh cam and Invisalign on the next").toBeGreaterThan(choices[0].top);
    expect(choices[2].left, "the two rows in the same columns").toBeCloseTo(choices[0].left, 0);
    expect(choices[3].left).toBeCloseTo(choices[1].left, 0);
    // Khí cụ is the contract's own; minivis and Bác sĩ stay on mẫu 3.
    await expect(blank(page, "orthodontic-contract.text.18")).toHaveText("");

    // Written over on mẫu 10, it stays so across a reload; the rest still follow mẫu 3.
    await write(page, "orthodontic-contract.text.19", " (có thể 30)");
    await save(page);
    await page.reload();
    await openBenhAn(page, patient.id);
    await openNewest(page, CONTRACT);
    await expect(blank(page, "orthodontic-contract.text.19")).toHaveText("24 tháng (có thể 30)");
    await expect(blank(page, "orthodontic-contract.text.10")).toHaveText("14, 24");
    await expect(blank(page, "orthodontic-contract.checkbox.2")).toBeChecked();

    // A second, newer mẫu 3 is the one read.
    await addSheet(page, ORTHODONTIC);
    await openNewest(page, ORTHODONTIC);
    await expect(blank(page, "orthodontic.text.95")).toHaveText("");
    await write(page, "orthodontic.text.95", "15, 25");
    await save(page);
    await openNewest(page, CONTRACT);
    await expect(blank(page, "orthodontic-contract.text.10")).toHaveText("15, 25");
    await expect(blank(page, "orthodontic-contract.text.8")).toHaveText("");

    // Cancelled, it gives way to the older one again.
    const sheets = await call<{ items: { id: string; form: number; creationTime: string; cancelledAt: string | null }[] }>(
      page,
      `${SHEETS_API}?patientId=${patient.id}`,
    );
    expect(sheets.status).toBe(200);
    const newest = sheets.body.items
      .filter((item) => item.form === 3 && !item.cancelledAt)
      .sort((a, b) => a.creationTime.localeCompare(b.creationTime))
      .at(-1)!;
    expect(await cancelSheet(page, newest.id)).toBe(200);
    await page.reload();
    await openBenhAn(page, patient.id);
    await openNewest(page, CONTRACT);
    await expect(blank(page, "orthodontic-contract.text.10")).toHaveText("14, 24");
    await expect(blank(page, "orthodontic-contract.text.8")).toHaveText("Hạng II xương");

    // Mẫu 3 itself was never written back to.
    await openNewest(page, ORTHODONTIC);
    await expect(blank(page, "orthodontic.text.99")).toHaveText("24");
  });
});
