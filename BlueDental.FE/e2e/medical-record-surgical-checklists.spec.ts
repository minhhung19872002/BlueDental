import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { createSlipViaApi } from "./fixtures/ledgerReceipt";
import { SETS_API } from "./fixtures/medicalRecordSet";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: mẫu 11 "Bảng kiểm an toàn phẫu thuật" (MS PT-04, A4 landscape) and
 * mẫu 12 "Bảng kiểm đếm gạc, dụng cụ sắc nhọn, dụng cụ" (MS PT-06, A4 upright)
 * — the clinic's own paper forms, 2026-11-16 (R-1236, R-1237).
 *
 * Real stack: a patient of the run's own, with a birthday, a diagnosis slip and
 * a treatment slip, all through the real API; the sheets are added, written,
 * saved and read back after a reload through the real UI. Only the browser's
 * print dialog is stubbed — the PDF is the one Chromium lays out from the
 * print copy. Nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";
const SAFETY = "Bảng kiểm an toàn phẫu thuật";
const COUNT = "Bảng kiểm đếm gạc, dụng cụ sắc nhọn, dụng cụ";
const LIVE_CARD = ".pd-sheet-card:not(.pd-sheet-card--cancelled)";
/** A4 in PDF points, upright and on its side. */
const PORTRAIT = [595, 842];
const LANDSCAPE = [842, 595];

interface Subject {
  id: string;
  code: string;
  /** The given name, which the sheets print in capitals. */
  firstName: string;
  age: number;
  diagnosis: string;
}

function sheet(page: Page): FrameLocator {
  return page.frameLocator(".mr-doc-frame");
}

function blank(page: Page, field: string) {
  return sheet(page).locator(`[data-medical-record-field="${field}"]`);
}

/** Years since `born` (YYYY-MM-DD) on the clinic's calendar today. */
function ageOn(born: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const [by, bm, bd] = born.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

function clinicToday() {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })
    .format(new Date())
    .split("-");
  return { day, month, yy: year.slice(2) };
}

/** A woman with a birthday, one diagnosis, one treatment slip and a set opened for it. */
async function seedSubject(page: Page): Promise<Subject> {
  const suffix = runId();
  const born = "1990-05-05";
  const firstName = `Bảng Kiểm ${suffix}`;
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  const patient = await call<{ id: string; patientCode: string }>(page, "/api/v1/app/patients", {
    method: "POST",
    branchId: BRANCH,
    json: {
      firstName,
      lastName: "E2E",
      gender: 2,
      dateOfBirth: born,
      phoneNumber: `05${suffix.padStart(8, "0").slice(-8)}`,
    },
  });
  expect(patient.status, JSON.stringify(patient.body)).toBe(200);

  const catalog = await call<{ items: Array<{ id: string; name: string }> }>(
    page,
    `/api/v1/app/catalog-entries?clinicBranchId=${BRANCH}&group=diagnosis&isActive=true&maxResultCount=1`,
    { branchId: BRANCH },
  );
  const staff = await call<{ items: Array<{ id: string }> }>(page, "/api/v1/app/staff?MaxResultCount=1", {
    branchId: BRANCH,
  });
  const diagnosis = catalog.body.items[0];
  const slip = await call(page, "/api/v1/app/patient-diagnoses", {
    method: "POST",
    branchId: BRANCH,
    json: {
      patientId: patient.body.id,
      clinicBranchId: BRANCH,
      diagnosisId: diagnosis.id,
      staffId: staff.body.items[0].id,
      teeth: [{ toothCode: 36, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
    },
  });
  expect(slip.status, JSON.stringify(slip.body)).toBe(200);

  const treatment = await createSlipViaApi(page, patient.body.id);
  const set = await call(page, SETS_API, {
    method: "POST",
    json: { patientId: patient.body.id, treatmentPlanIds: [treatment.id], visibleForms: [] },
  });
  expect(set.status, JSON.stringify(set.body)).toBe(200);

  return {
    id: patient.body.id,
    code: patient.body.patientCode,
    firstName,
    age: ageOn(born),
    diagnosis: diagnosis.name,
  };
}

async function openRecord(page: Page, subject: Subject) {
  await page.goto(`/patient/${subject.id}?branchId=${BRANCH}&view=medical-record`);
  await expect(page.locator(".pd-medical-form").first()).toBeVisible();
}

/** Opens the form's sheet, adding one first if there is none. */
async function openSheet(page: Page, form: string) {
  const row = page.locator(".pd-medical-form", { hasText: form });
  const cards = row.locator(LIVE_CARD);
  if ((await cards.count()) === 0) {
    await row.getByRole("button", { name: "Thêm" }).click();
    await expect(cards).toHaveCount(1);
  }
  await cards.first().locator(".pd-sheet-open").click();
  await expect(page.locator(".mr-doc-frame").first()).toBeVisible();
  await expect(sheet(page).locator("[data-medical-record-field]").first()).toBeAttached();
}

async function save(page: Page) {
  await page.locator(".pd-medical-bar").getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu phiếu bệnh án").first()).toBeVisible();
}

/** Each page's size, in PDF points, as Chromium laid the print copy out. */
function pageSizes(pdf: Buffer) {
  const text = pdf.toString("latin1");
  const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const sizes = [...text.matchAll(/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((box) => [
    Math.round(Number(box[1])),
    Math.round(Number(box[2])),
  ]);
  return { pages, sizes };
}

/** "In biểu mẫu" → the PDF; `pick` is what the Toàn bộ view's list ticks, in index order. */
async function printed(page: Page, pick: string[] = []) {
  await page.evaluate(() => {
    window.print = () => undefined;
  });
  await page.locator(".pd-medical-bar").getByRole("button", { name: "In biểu mẫu" }).click();
  if (pick.length) {
    const all = page.getByRole("checkbox", { name: "Chọn tất cả phiếu bệnh án" });
    await all.check();
    await all.uncheck();
    for (const form of pick) await page.getByRole("checkbox", { name: `Chọn ${form}` }).first().check();
    await page.getByRole("button", { name: "In", exact: true }).click();
  }
  await expect(page.locator(".mr-print-copy > .nfc-tpl")).toHaveCount(Math.max(pick.length, 1));
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  return pageSizes(pdf);
}

test.describe("Bệnh án — mẫu 11 and mẫu 12, the clinic's surgical checklists", () => {
  test.describe.configure({ timeout: 180_000 });

  let subject: Subject;

  test.beforeEach(async ({ page }) => {
    await login(page);
    subject = await seedSubject(page);
    await openRecord(page, subject);
  });

  test("mẫu 11 fills the patient, PT-04, the diagnosis and the picked day; ticks and notes survive a reload; it prints on one landscape page", async ({
    page,
  }) => {
    await expect(page.locator(".pd-medical-form").getByText(`11. ${SAFETY}`, { exact: true })).toBeVisible();
    await openSheet(page, SAFETY);

    // What the record already knows.
    await expect(blank(page, "surgical-safety.form-code")).toHaveText("PT-04");
    await expect(blank(page, "surgical-safety.admission-number")).toHaveText("");
    await expect(blank(page, "surgical-safety.patient.code")).toHaveText(subject.code);
    await expect(blank(page, "surgical-safety.patient.code-line")).toHaveText(subject.code);
    await expect(blank(page, "surgical-safety.patient.name")).toContainText(subject.firstName.toUpperCase());
    await expect(blank(page, "surgical-safety.patient.age")).toHaveText(String(subject.age));
    await expect(blank(page, "surgical-safety.patient.gender-female")).toBeChecked();
    await expect(blank(page, "surgical-safety.patient.gender-male")).not.toBeChecked();
    await expect(blank(page, "surgical-safety.diagnosis")).toContainText(subject.diagnosis);

    // Ngày thực hiện opens on today and is printed over Ngày … tháng … năm 20…
    const picker = page.locator(".pd-medical-date");
    await expect(picker).toContainText("Ngày thực hiện");
    const today = clinicToday();
    await expect(blank(page, "surgical-safety.date.day")).toHaveText(today.day);
    await expect(blank(page, "surgical-safety.date.month")).toHaveText(today.month);
    await expect(blank(page, "surgical-safety.date.year")).toHaveText(today.yy);
    // A masked input (DD/MM/YYYY): typing the digits walks the day, month and year.
    // Clicked at its left edge the day is the part selected.
    await picker.locator("input").click({ position: { x: 6, y: 10 } });
    await picker.locator("input").pressSequentially("15082026");
    await picker.locator("input").press("Enter");
    await expect(blank(page, "surgical-safety.date.day")).toHaveText("15");
    await expect(blank(page, "surgical-safety.date.month")).toHaveText("08");
    await expect(blank(page, "surgical-safety.date.year")).toHaveText("26");

    // The three stages side by side, the boxes' titles in one row.
    const stages = sheet(page).locator('table[data-record-section="surgical-safety"]');
    const heads = await stages.locator("tr").first().locator("> td").evaluateAll((cells) =>
      cells.map((cell) => Math.round(cell.getBoundingClientRect().top)),
    );
    expect(new Set(heads).size).toBe(1);
    expect(heads).toHaveLength(5);

    const note = `Theo dõi mạch ${runId()}`;
    const surgeon = `BS PTV ${runId()}`;
    await blank(page, "surgical-safety.check.1").check();
    await blank(page, "surgical-safety.check.5").check();
    await blank(page, "surgical-safety.text.1").fill(note);
    await blank(page, "surgical-safety.text.8").fill(surgeon);
    await save(page);

    await page.reload();
    await openSheet(page, SAFETY);
    await expect(blank(page, "surgical-safety.check.1")).toBeChecked();
    await expect(blank(page, "surgical-safety.check.5")).toBeChecked();
    await expect(blank(page, "surgical-safety.check.2")).not.toBeChecked();
    await expect(blank(page, "surgical-safety.text.1")).toHaveText(note);
    await expect(blank(page, "surgical-safety.text.8")).toHaveText(surgeon);
    await expect(blank(page, "surgical-safety.date.day")).toHaveText("15");
    await expect(page.locator(".pd-medical-date input")).toHaveValue("15/08/2026");
    await expect(blank(page, "surgical-safety.form-code")).toHaveText("PT-04");

    expect(await printed(page)).toEqual({ pages: 1, sizes: [LANDSCAPE] });
  });

  test("mẫu 12 fills the patient and PT-06; counts, ticks and notes survive a reload; it prints on one upright page", async ({
    page,
  }) => {
    await expect(page.locator(".pd-medical-form").getByText(`12. ${COUNT}`, { exact: true })).toBeVisible();
    await openSheet(page, COUNT);
    // Not a dated form.
    await expect(page.locator(".pd-medical-date")).toHaveCount(0);

    await expect(blank(page, "surgical-count.form-code")).toHaveText("PT-06");
    await expect(blank(page, "surgical-count.admission-number")).toHaveText("");
    await expect(blank(page, "surgical-count.patient.code")).toHaveText(subject.code);
    await expect(blank(page, "surgical-count.patient.name")).toContainText(subject.firstName.toUpperCase());
    await expect(blank(page, "surgical-count.patient.age")).toHaveText(String(subject.age));
    await expect(blank(page, "surgical-count.patient.gender-female")).toBeChecked();
    await expect(blank(page, "surgical-count.patient.gender-male")).not.toBeChecked();

    // Six rows to count, each with eight counts.
    const table = sheet(page).locator('table[data-record-section="surgical-count"]');
    await expect(table.locator("tbody > tr")).toHaveCount(7);
    await expect(table.locator('[data-medical-record-field^="surgical-count.count."]')).toHaveCount(48);

    const lost = `Thiếu 1 gạc ${runId()}`;
    await blank(page, "surgical-count.check.1").check();
    await blank(page, "surgical-count.gauze.1.width").fill("5");
    await blank(page, "surgical-count.gauze.1.length").fill("7");
    await blank(page, "surgical-count.count.1.1").fill("10");
    await blank(page, "surgical-count.count.1.8").fill("9");
    await blank(page, "surgical-count.check.12").check();
    await blank(page, "surgical-count.text.2").fill(lost);
    await save(page);

    await page.reload();
    await openSheet(page, COUNT);
    await expect(blank(page, "surgical-count.check.1")).toBeChecked();
    await expect(blank(page, "surgical-count.check.12")).toBeChecked();
    await expect(blank(page, "surgical-count.check.11")).not.toBeChecked();
    await expect(blank(page, "surgical-count.gauze.1.width")).toHaveText("5");
    await expect(blank(page, "surgical-count.gauze.1.length")).toHaveText("7");
    await expect(blank(page, "surgical-count.count.1.1")).toHaveText("10");
    await expect(blank(page, "surgical-count.count.1.8")).toHaveText("9");
    await expect(blank(page, "surgical-count.text.2")).toHaveText(lost);

    expect(await printed(page)).toEqual({ pages: 1, sizes: [PORTRAIT] });
  });

  /**
   * In one run the landscape sheet keeps its own page and the others stay
   * upright — whether it comes before them or last (the page the run ends on
   * is named after the last sheet, so no blank page trails it).
   */
  test("printed together, mẫu 11 alone turns its page on its side", async ({ page }) => {
    const procedure = "Phiếu phẫu thuật/thủ thuật";
    for (const form of [procedure, SAFETY, COUNT]) await openSheet(page, form);
    await page.locator(".pd-medical-bar").getByRole("button", { name: "Toàn bộ" }).click();

    const both = await printed(page, [SAFETY, COUNT]);
    expect(both.pages).toBe(2);
    expect(both.sizes).toEqual([LANDSCAPE, PORTRAIT]);

    const last = await printed(page, [procedure, SAFETY]);
    expect(last.pages).toBe(2);
    expect(last.sizes).toEqual([PORTRAIT, LANDSCAPE]);
  });
});
