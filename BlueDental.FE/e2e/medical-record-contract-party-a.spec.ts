import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";
import { SETS_API, openBenhAn, seedPatientWithSlips, type SeededPatient } from "./fixtures/medicalRecordSet";

/**
 * Feature: Bên A on Hợp đồng thỏa thuận niềng răng (mẫu 10) is written over
 * per sheet (clinic, 2026-11-03, R-1139). Its five lines start with the
 * clinic's text — Địa chỉ and Điện thoại from the branch settings, the company,
 * MST and Đại diện fixed — and what a sheet writes over them is kept.
 *
 * Real stack: a patient of the run's own with one treatment slip and a set for
 * it; the branch is read back from the real API, the sheet is written, saved
 * and read back through the real UI. Nothing is intercepted.
 */

const LIVE_CARD = ".pd-sheet-card:not(.pd-sheet-card--cancelled)";
const CONTRACT = "Hợp đồng thỏa thuận niềng răng";

/** The clinic's own text, as `CONTRACT_PARTY_A` in fieldValues.ts holds it. */
const PARTY_A = {
  name: "Công ty Cổ phần dịch vụ Nha Khoa Đức Hạnh",
  address: "84 – 86 Phạm Ngọc Thạch, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh",
  phone: "0906.884.440",
  taxCode: "0318531468",
  representative: "Bác sĩ Bùi Văn Tới – Bác sĩ phụ trách",
};

const FIELD = {
  name: "orthodontic-contract.party-a.name",
  address: "orthodontic-contract.party-a.address",
  phone: "orthodontic-contract.party-a.phone",
  taxCode: "orthodontic-contract.party-a.tax-code",
  representative: "orthodontic-contract.party-a.representative",
};

function sheet(page: Page): FrameLocator {
  return page.frameLocator(".mr-doc-frame");
}

function blank(page: Page, field: string) {
  return sheet(page).locator(`[data-medical-record-field="${field}"]`);
}

function contractCards(page: Page) {
  return page.locator(".pd-medical-form", { hasText: CONTRACT }).locator(LIVE_CARD);
}

async function openContract(page: Page) {
  await contractCards(page).last().locator(".pd-sheet-open").click();
  await expect(page.locator(".mr-doc-frame").first()).toBeVisible();
  await expect(blank(page, FIELD.name)).toBeAttached();
}

async function append(page: Page, field: string, text: string) {
  await blank(page, field).click();
  await page.keyboard.press("End");
  await page.keyboard.type(text);
}

async function branchSettings(page: Page, branchId: string) {
  const res = await call<{ items: { id: string; address?: string | null; phoneNumber?: string | null }[] }>(
    page,
    "/api/v1/app/clinic-branches/accessible",
  );
  expect(res.status).toBe(200);
  const branch = res.body.items.find((item) => item.id === branchId);
  expect(branch, "the patient's branch is one the account works in").toBeTruthy();
  return {
    address: branch?.address?.trim() || PARTY_A.address,
    phone: branch?.phoneNumber?.trim() || PARTY_A.phone,
  };
}

test.describe("Bệnh án — mẫu 10 Bên A written over per sheet (R-1139)", () => {
  test.describe.configure({ timeout: 180_000 });

  let patient: SeededPatient;

  test.beforeEach(async ({ page }) => {
    await login(page);
    patient = await seedPatientWithSlips(page, 1);
  });

  test("Bên A starts with the clinic's text and the branch's address and phone; what is written over it is kept across a reload", async ({
    page,
  }) => {
    const made = await call<{ id: string }>(page, SETS_API, {
      method: "POST",
      json: { patientId: patient.id, treatmentPlanIds: [patient.slips[0].id], visibleForms: [] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const settings = await branchSettings(page, patient.branchId);

    await openBenhAn(page, patient.id);
    await page.locator(".pd-medical-form", { hasText: CONTRACT }).getByRole("button", { name: "Thêm" }).click();
    await expect(page.getByText("Đã thêm phiếu bệnh án").first()).toBeVisible();
    await openContract(page);

    // Filled, and every one a blank that takes typing.
    await expect(blank(page, FIELD.name)).toHaveText(PARTY_A.name);
    await expect(blank(page, FIELD.address)).toHaveText(settings.address);
    await expect(blank(page, FIELD.phone)).toHaveText(settings.phone);
    await expect(blank(page, FIELD.taxCode)).toHaveText(PARTY_A.taxCode);
    await expect(blank(page, FIELD.representative)).toHaveText(PARTY_A.representative);
    for (const field of Object.values(FIELD)) {
      await expect(blank(page, field)).toHaveAttribute("contenteditable", "true");
      // Each stays on its own one line beside its label, as the .docx sets it.
      const lines = await blank(page, field).evaluate((node) => {
        const row = node.closest("p")!;
        return row.getBoundingClientRect().height / parseFloat(getComputedStyle(row).lineHeight);
      });
      expect(lines, `Bên A line ${field}`).toBeLessThan(1.5);
    }

    // Written over and saved.
    await append(page, FIELD.taxCode, "-001");
    await append(page, FIELD.representative, " (ủy quyền)");
    await page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã lưu phiếu bệnh án").first()).toBeVisible();

    // Kept across a reload; the lines left alone still read the settings.
    await page.reload();
    await openBenhAn(page, patient.id);
    await openContract(page);
    await expect(blank(page, FIELD.taxCode)).toHaveText(`${PARTY_A.taxCode}-001`);
    await expect(blank(page, FIELD.representative)).toHaveText(`${PARTY_A.representative} (ủy quyền)`);
    await expect(blank(page, FIELD.name)).toHaveText(PARTY_A.name);
    await expect(blank(page, FIELD.address)).toHaveText(settings.address);
    await expect(blank(page, FIELD.phone)).toHaveText(settings.phone);

    // Only what was written is stored on the sheet.
    const sheets = await call<{ items: { form: number; content: string | null }[] }>(
      page,
      `/api/v1/app/patient-medical-records?patientId=${patient.id}`,
    );
    expect(sheets.status).toBe(200);
    const contract = sheets.body.items.find((item) => item.form === 10);
    const stored = JSON.parse(contract?.content ?? "{}").fieldValues ?? {};
    expect(stored[FIELD.taxCode]).toBe(`${PARTY_A.taxCode}-001`);
    expect(stored[FIELD.address]).toBeUndefined();
    expect(stored[FIELD.phone]).toBeUndefined();
  });
});
