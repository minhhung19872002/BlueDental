import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { BRANCH2_USER, login } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";
import {
  SETS_API,
  openBenhAn,
  seedPatientWithSlips,
  type SeededPatient,
} from "./fixtures/medicalRecordSet";

/**
 * Feature: the Bệnh án sheets filled from the set's treatment slips — the
 * clinic's mapping in save/P1810.drawio (2026-10-18): Mã lưu trữ NK-…, Số
 * ngoại trú NGT-…, the treatment's start and end, each slip's doctor, the
 * services and their cost, and the treatment log.
 *
 * Real stack: a patient of the run's own with two treatment slips, a set
 * opened for both, công đoạn written and completed through the real API; the
 * sheets are read off the real UI. Nothing is intercepted.
 */

interface Facts {
  storageCode: string | null;
  outpatientNumber: string | null;
  year: number | null;
  treatmentStartDate: string | null;
  treatmentEndDate: string | null;
  plans: { planCode: string; dentistName: string | null; endDate: string | null }[];
  services: { amount: number }[];
  visits: { content: string | null }[];
}

interface Slip {
  id: string;
  dentistId: string;
  dentistName: string | null;
  dentistJobTitle: string | null;
  services: { id: string; serviceId: string; teeth: unknown[] }[];
}

/** A day on the clinic's calendar — today, or `daysAgo` before it — as the sheets print it. */
function clinicToday(daysAgo = 0) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(Date.now() - daysAgo * 86_400_000));
  const of = (type: string) => parts.find((part) => part.type === type)!.value;
  return { day: of("day"), month: of("month"), year: of("year"), iso: `${of("year")}-${of("month")}-${of("day")}` };
}

const LIVE_CARD = ".pd-sheet-card:not(.pd-sheet-card--cancelled)";

function sheet(page: Page): FrameLocator {
  return page.frameLocator(".mr-doc-frame");
}

function blank(page: Page, field: string) {
  return sheet(page).locator(`[data-medical-record-field="${field}"]`);
}

/**
 * The table cell a blank sits in — the blank and the dotted lines its text
 * flowed onto when it ran past its line, as printed.
 */
function wholeCell(page: Page, field: string) {
  return sheet(page).locator(`td:has([data-medical-record-field="${field}"])`);
}

/** Opens a form's first sheet in the set, adding one when the set has none. */
async function openSheet(page: Page, form: string) {
  const row = page.locator(".pd-medical-form", { hasText: form });
  const cards = row.locator(LIVE_CARD);
  if ((await cards.count()) === 0) {
    await row.getByRole("button", { name: "Thêm" }).click();
    await expect(page.getByText("Đã thêm phiếu bệnh án").first()).toBeVisible();
  }
  await cards.first().locator(".pd-sheet-open").click();
  await expect(page.locator(".mr-doc-frame").first()).toBeVisible();
  await expect(sheet(page).locator("[data-medical-record-field]").first()).toBeAttached();
}

async function factsOf(page: Page, setId: string): Promise<Facts> {
  const facts = await call<Facts>(page, `${SETS_API}/${setId}/sheet-facts`);
  expect(facts.status, JSON.stringify(facts.body)).toBe(200);
  return facts.body;
}

interface StageOptions {
  /** Worked this many days ago. */
  daysAgo?: number;
  /** A warranty công đoạn raised from this finished one. */
  warrantyFrom?: string;
  /** Ticked Hoàn thành straight away (the default). */
  complete?: boolean;
}

/** One công đoạn on the slip's only service, then — unless told not to — ticked Hoàn thành. */
async function treat(
  page: Page,
  patient: SeededPatient,
  slipId: string,
  note: string,
  { daysAgo = 0, warrantyFrom, complete = true }: StageOptions = {},
) {
  const slip = (await call<Slip>(page, `/api/v1/app/patient-treatments/${slipId}`, { branchId: patient.branchId })).body;
  const line = slip.services[0];
  const stage = await call<{ id: string }>(page, "/api/v1/app/treatment-stages", {
    method: "POST",
    json: {
      patientId: patient.id,
      clinicBranchId: patient.branchId,
      treatmentId: slip.id,
      treatmentServiceId: line.id,
      serviceId: line.serviceId,
      name: warrantyFrom ? "Bảo hành E2E" : "Công đoạn E2E",
      note,
      staffId: slip.dentistId,
      treatmentDate: clinicToday(daysAgo).iso,
      teeth: line.teeth,
      isGuarantee: Boolean(warrantyFrom),
      warrantySourceStageId: warrantyFrom ?? null,
    },
    branchId: patient.branchId,
  });
  expect(stage.status, JSON.stringify(stage.body)).toBe(200);
  if (complete) {
    const done = await call(page, `/api/v1/app/treatment-stages/${stage.body.id}/complete`, {
      method: "POST",
      branchId: patient.branchId,
    });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
  }
  return { ...slip, stageId: stage.body.id };
}

/** "Sửa bộ hồ sơ": ticks or unticks a slip, saves, and waits for the dialog to close. */
async function setSlip(page: Page, setCode: string, slipCode: string, held: boolean) {
  await page.locator(".rs-picker-trigger").click();
  await page.getByRole("button", { name: `Sửa bộ hồ sơ ${setCode}` }).click();
  const dialog = page.getByRole("dialog");
  const box = dialog.getByRole("checkbox", { name: slipCode });
  await expect(box).toBeEnabled();
  if (held) await box.check();
  else await box.uncheck();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("Bệnh án — sheets filled from the set's treatment slips (P1810)", () => {
  test.describe.configure({ timeout: 180_000 });

  let patient: SeededPatient;

  test.beforeEach(async ({ page }) => {
    await login(page);
    patient = await seedPatientWithSlips(page, 3);
  });

  test("numbers, dates, doctors, costs and the treatment log reach the sheets, and the end waits for every slip", async ({
    page,
    browser,
  }) => {
    const [first, second, third] = patient.slips;
    const made = await call<{ id: string }>(page, SETS_API, {
      method: "POST",
      json: { patientId: patient.id, treatmentPlanIds: [first.id, second.id, third.id], visibleForms: [] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const setId = made.body.id;
    const today = clinicToday();
    const mmyy = `${today.month}${today.year.slice(2)}`;

    // The numbers: NK from the set's month and its oldest slip; NGT from the
    // treatment start — before any công đoạn, the day the set was opened.
    let facts = await factsOf(page, setId);
    expect(facts.storageCode).toBe(`NK-${mmyy}${patient.code}${first.code}`);
    expect(facts.outpatientNumber).toMatch(new RegExp(`^NGT-${mmyy}${patient.code}-\\d{4}$`));
    expect(facts.year).toBe(Number(today.year));
    expect(facts.services).toHaveLength(3);
    expect(facts.treatmentStartDate).toBeNull();

    // The first slip is treated and finished; the second has not started.
    const slip = await treat(page, patient, first.id, "Lấy tủy E2E");
    facts = await factsOf(page, setId);
    expect(facts.treatmentStartDate).toBe(today.iso);
    expect(facts.plans.find((plan) => plan.planCode === first.code)?.endDate).toBe(today.iso);
    expect(facts.treatmentEndDate, "a slip still being treated holds the end back").toBeNull();
    // A doctor is printed by their Chức danh, by name only when none is set.
    const dentist = slip.dentistJobTitle ?? slip.dentistName ?? "";
    expect(dentist).not.toBe("");

    await openBenhAn(page, patient.id);

    // Bìa: Mã lưu trữ, the year after "20", the start — and no end yet.
    await openSheet(page, "Bìa hồ sơ bệnh án");
    await expect(blank(page, "cover.text.1")).toHaveText(facts.storageCode!);
    await expect(blank(page, "cover.year")).toHaveText(today.year.slice(2));
    await expect(blank(page, "cover.text.2")).toHaveText(today.day);
    await expect(blank(page, "cover.text.3")).toHaveText(today.month);
    await expect(blank(page, "cover.text.4")).toHaveText(today.year.slice(2));
    await expect(blank(page, "cover.text.5")).toHaveText("");

    // Bệnh án ngoại trú: Số ngoại trú and Số lưu trữ; MS stays empty.
    await openSheet(page, "Bệnh án ngoại trú Răng Hàm Mặt");
    await expect(blank(page, "outpatient-dental.text.1")).toHaveText(facts.outpatientNumber!);
    await expect(blank(page, "outpatient-dental.text.2")).toHaveText(facts.storageCode!);
    await expect(blank(page, "custom.text.8b780086e4014a049f87decd95bffaf3")).toHaveText("");

    // Bệnh án chỉnh nha: Mã ngoại trú; IX lists each slip's services under its
    // name, a blank line between slips, and grows a line past the seven printed.
    await openSheet(page, "Bệnh án chỉnh nha");
    await expect(blank(page, "orthodontic.text.1")).toHaveText(facts.outpatientNumber!);
    await expect(blank(page, "orthodontic.text.105")).toHaveText(`Phiếu điều trị ${first.code}`);
    await expect(blank(page, "orthodontic.text.106")).toContainText("Răng 12 - ");
    await expect(blank(page, "orthodontic.text.107")).toHaveText("");
    await expect(blank(page, "orthodontic.text.108")).toHaveText(`Phiếu điều trị ${second.code}`);
    await expect(blank(page, "orthodontic.text.109")).toContainText("Răng 11 - ");
    await expect(blank(page, "orthodontic.text.110")).toHaveText("");
    await expect(blank(page, "orthodontic.text.111")).toHaveText(`Phiếu điều trị ${third.code}`);
    await expect(blank(page, "custom.line.orthodontic.text.111.1")).toContainText("Răng 21 - ");

    // Phiếu tư vấn tổng quát: the slip's doctor, and the day picked above the sheet.
    await openSheet(page, "Phiếu Tư Vấn Tổng Quát");
    await expect(blank(page, "general-consultation.text.6")).toHaveText(dentist);
    // Chức vụ is the staff record's Chức vụ (Position), not its Chức danh.
    const staff = await call<{ position: string | null }>(page, `/api/v1/app/staff/${slip.dentistId}`, {
      branchId: patient.branchId,
    });
    expect(staff.status, JSON.stringify(staff.body)).toBe(200);
    await expect(blank(page, "general-consultation.text.7")).toHaveText(staff.body.position?.trim() ?? "");
    // Only the first slip's doctor; line 2 is left for the pen.
    await expect(blank(page, "general-consultation.text.8")).toHaveText("");
    await expect(blank(page, "general-consultation.text.9")).toHaveText("");
    await expect(blank(page, "general-consultation.text.14")).toHaveText(
      `${today.day}/${today.month}/${today.year}`,
    );

    // Phiếu tư vấn và xác nhận: consultant and day, diagnosis, doctor, a cost row per service, Tổng.
    await openSheet(page, "Phiếu tư vấn và xác nhận đồng ý điều trị");
    // From the oldest slip's oldest consulting line only — not one name per slip.
    await expect(blank(page, "consultation.text.3")).toHaveText(dentist);
    await expect(blank(page, "consultation.text.4")).toHaveText(`${today.day}/${today.month}/${today.year}`);
    await expect(blank(page, "consultation.text.5")).toContainText(patient.diagnosisName);
    await expect(blank(page, "consultation.text.8")).toHaveText(dentist);
    await expect(blank(page, "consultation.text.53")).toHaveText(dentist);
    await expect(blank(page, "consultation.text.53")).toHaveCSS("font-weight", "700");
    // The names under the two signatures: BÁC SĨ TƯ VẤN (VI) and BÁC SĨ ĐIỀU TRỊ (VII).
    await expect(blank(page, "consultation.text.52")).toHaveText(dentist);
    await expect(blank(page, "consultation.text.57")).toHaveText(dentist);
    await expect(blank(page, "consultation.text.21")).toHaveText("1");
    await expect(blank(page, "consultation.text.22")).toContainText("Răng 12 - ");
    await expect(blank(page, "consultation.text.24")).toHaveText("2");
    await expect(blank(page, "consultation.text.27")).toHaveText("3");
    const total = facts.services.reduce((sum, service) => sum + service.amount, 0);
    await expect(blank(page, "consultation.text.46")).toHaveText(total.toLocaleString("vi-VN"));
    await expect(blank(page, "consultation.text.47")).toContainText("đồng");

    // Phiếu theo dõi điều trị: Tờ điều trị số, Số ngoại trú, and the day's công đoạn.
    await openSheet(page, "Phiếu theo dõi điều trị");
    await expect(blank(page, "treatment-tracking.page-1.sheet-number")).toHaveText(facts.storageCode!);
    await expect(blank(page, "treatment-tracking.page-1.patient.code")).toHaveText(facts.outpatientNumber!);
    await expect(blank(page, "treatment-tracking.page-1.row-1.date-time")).toHaveText(
      new RegExp(`^${today.day}/${today.month}/${today.year} \\d{2}:\\d{2}$`),
    );
    await expect(blank(page, "treatment-tracking.page-1.row-1.diagnosis-progress")).toContainText(
      patient.diagnosisName,
    );
    // One line a service and a tooth: the cell's blank flows onto dotted lines of its own.
    const detail = wholeCell(page, "treatment-tracking.page-1.row-1.treatment-detail");
    await expect(
      sheet(page).locator('[data-flow-of="treatment-tracking.page-1.row-1.treatment-detail"]').first(),
    ).toBeAttached();
    // The công đoạn are listed under their service with "-"; the service line takes none.
    await expect(detail).toContainText("Dịch vụ: ");
    await expect(detail).not.toContainText("- Dịch vụ: ");
    await expect(detail).toContainText("- Răng 12 - Lấy tủy E2E");

    // The other two slips finished too: now the cover shows the end, after a reload.
    await treat(page, patient, second.id, "Trám bít E2E");
    await treat(page, patient, third.id, "Hoàn tất E2E");
    facts = await factsOf(page, setId);
    expect(facts.treatmentEndDate).toBe(today.iso);
    await page.reload();
    await openBenhAn(page, patient.id);
    await openSheet(page, "Bìa hồ sơ bệnh án");
    await expect(blank(page, "cover.text.5")).toHaveText(today.day);
    await expect(blank(page, "cover.text.6")).toHaveText(today.month);
    await expect(blank(page, "cover.text.7")).toHaveText(today.year.slice(2));

    // Every công đoạn was the same day and the same diagnosis: one row.
    await openSheet(page, "Phiếu theo dõi điều trị");
    await expect(detail).toContainText("- Răng 11 - Trám bít E2E");
    await expect(blank(page, "treatment-tracking.page-1.row-2.date-time")).toHaveText("");

    // Another branch cannot read the set's facts.
    const other = await browser.newContext();
    try {
      const otherPage = await other.newPage();
      await login(otherPage, BRANCH2_USER);
      const peek = await call(otherPage, `${SETS_API}/${setId}/sheet-facts`);
      expect(peek.status).toBe(404);
    } finally {
      await other.close();
    }
  });

  test("the end date follows the slips held, without a reload, and a warranty visit never moves it", async ({
    page,
  }) => {
    const warranted = await seedPatientWithSlips(page, 3, { warranty: true });
    const [first, second, third] = warranted.slips;
    const made = await call<{ id: string; code: string }>(page, SETS_API, {
      method: "POST",
      json: { patientId: warranted.id, treatmentPlanIds: [first.id], visibleForms: [] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const yesterday = clinicToday(1);
    const today = clinicToday();

    // The only slip is finished yesterday: the cover ends yesterday.
    const worked = await treat(page, warranted, first.id, "Điều trị E2E", { daysAgo: 1 });
    await openBenhAn(page, warranted.id);
    await openSheet(page, "Bìa hồ sơ bệnh án");
    const end = ["cover.text.5", "cover.text.6", "cover.text.7"].map((field) => blank(page, field));
    const endsYesterday = async () => {
      await expect(end[0]).toHaveText(yesterday.day);
      await expect(end[1]).toHaveText(yesterday.month);
      await expect(end[2]).toHaveText(yesterday.year.slice(2));
    };
    await endsYesterday();

    // A slip not yet treated joins: the end goes, on the open sheet, no reload.
    await setSlip(page, made.body.code, second.code, true);
    await expect(end[0]).toHaveText("");
    await expect(end[1]).toHaveText("");
    await expect(end[2]).toHaveText("");

    // It leaves again (still not treated): the end is back.
    await setSlip(page, made.body.code, second.code, false);
    await endsYesterday();

    const reopenCover = async () => {
      await page.reload();
      await openBenhAn(page, warranted.id);
      await openSheet(page, "Bìa hồ sơ bệnh án");
    };

    // Back in, then its only service is cancelled on the slip: nothing left to finish.
    await setSlip(page, made.body.code, second.code, true);
    await expect(end[0]).toHaveText("");
    const cancelled = await call(page, `/api/v1/app/patient-treatments/${second.id}/services/${second.lineId}/cancel`, {
      method: "POST",
      branchId: warranted.branchId,
    });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    await reopenCover();
    await endsYesterday();

    // Another untreated slip joins, then is deleted from Kế hoạch điều trị: the end is back.
    await setSlip(page, made.body.code, third.code, true);
    await expect(end[0]).toHaveText("");
    const deleted = await call(page, `/api/v1/app/patient-treatments/${third.id}`, {
      method: "DELETE",
      branchId: warranted.branchId,
    });
    expect(deleted.status, JSON.stringify(deleted.body)).toBe(204);
    await reopenCover();
    await endsYesterday();

    // A warranty visit today — open, then finished — is not the end of treatment.
    const warrantyVisit = await treat(page, warranted, first.id, "Bảo hành E2E", {
      warrantyFrom: worked.stageId,
      complete: false,
    });
    let facts = await factsOf(page, made.body.id);
    expect(facts.treatmentEndDate, "an open warranty leaves the end where it was").toBe(yesterday.iso);
    const closed = await call(page, `/api/v1/app/treatment-stages/${warrantyVisit.stageId}/complete`, {
      method: "POST",
      branchId: warranted.branchId,
    });
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    facts = await factsOf(page, made.body.id);
    expect(facts.treatmentEndDate, "a finished warranty, later than the work, still does not").toBe(yesterday.iso);
    expect(facts.treatmentStartDate).toBe(yesterday.iso);
    expect(today.iso).not.toBe(yesterday.iso);
    // Số ngoại trú takes the month of that start, the day treatment began.
    expect(facts.outpatientNumber).toMatch(
      new RegExp(`^NGT-${yesterday.month}${yesterday.year.slice(2)}${warranted.code}-\\d{4}$`),
    );

    await page.reload();
    await openBenhAn(page, warranted.id);
    await openSheet(page, "Bìa hồ sơ bệnh án");
    await endsYesterday();
  });
});
