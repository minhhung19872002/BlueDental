import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";

/**
 * Feature: "Ngày điều trị" on the công đoạn form of "Chi tiết phiếu" (BA,
 * 2026-10-09). The read-only "Ngày tạo" box became a day the doctor picks —
 * today or earlier — and that day is what Lịch sử điều trị, the treatment
 * table's Ngày column and the warranty count read. The creation time stays in
 * the database for tracking only.
 *
 * Real stack throughout: fixtures go through the real API with the session the
 * real login screen gave, and nothing is intercepted.
 */

const BRANCH = "11111111-1111-1111-1111-111111111111";

interface Line {
  patientId: string;
  planId: string;
  branchId: string;
  lineId: string;
  serviceId: string;
  serviceName: string;
  warrantyDays: number;
}

/** "YYYY-MM-DD" of the browser's today shifted by `days`. */
function isoDay(days: number): string {
  const day = new Date();
  day.setDate(day.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** "YYYY-MM-DD" → the DD/MM/YYYY the picker and the treatment table print. */
function typed(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** "YYYY-MM-DD" → the unpadded d/m/yyyy Lịch sử điều trị prints. */
function short(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d}/${m}/${y}`;
}

/** One API call from inside the page, with the session and the branch header. */
async function call(
  page: Page,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> | null; text: string }> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      const parse = () => {
        try {
          return text ? JSON.parse(text) : null;
        } catch {
          return null;
        }
      };
      return { status: res.status, json: parse(), text };
    },
    { method, url, body, branch: BRANCH },
  );
}

/**
 * A fresh line on an open slip of branch 1, so the test owns its teeth. With
 * `serviceId` the line is that catalog service; otherwise any service without a
 * warranty already used in branch 1.
 */
async function freshLine(page: Page, tooth: number, serviceId?: string): Promise<Line> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  const made = await page.evaluate(
    async ({ tooth, serviceId, branch }) => {
      const headers = { "Content-Type": "application/json", "X-Clinic-Branch-Id": branch };
      const slips = (
        await (await fetch("/api/v1/app/patient-treatments?maxResultCount=300", { credentials: "include" })).json()
      ).items as {
        id: string;
        patientId: string;
        branchId: string;
        status: number;
        services: { id: string; serviceId: string; serviceName: string | null; warrantyDays: number; originalPrice: number }[];
      }[];

      const lines = slips.filter((slip) => slip.branchId === branch).flatMap((slip) => slip.services);
      const source = serviceId
        ? { serviceId, originalPrice: 100000 }
        : lines.find((line) => line.warrantyDays <= 0);
      // 5 = Completed, 6 = Cancelled: a closed slip takes no new line.
      const slip = slips.find((item) => item.branchId === branch && item.status !== 5 && item.status !== 6);
      if (!slip || !source) return { error: "no open slip or source service in branch 1" };

      const known = new Set(slip.services.map((line) => line.id));
      const res = await fetch(`/api/v1/app/patient-treatments/${slip.id}/services`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          serviceId: source.serviceId,
          price: Math.min(100000, source.originalPrice),
          quantity: 1,
          discountType: 0,
          discountValue: 0,
          status: 1,
          teeth: [{ toothCode: tooth, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
        }),
      });
      if (!res.ok) return { error: `${res.status} ${await res.text()}` };
      const updated = (await res.json()) as typeof slip;
      const line = updated.services.find((item) => !known.has(item.id))!;
      return {
        line: {
          patientId: slip.patientId,
          planId: slip.id,
          branchId: slip.branchId,
          lineId: line.id,
          serviceId: line.serviceId,
          serviceName: line.serviceName ?? "",
          warrantyDays: line.warrantyDays,
        },
      };
    },
    { tooth, serviceId, branch: BRANCH },
  );

  expect("error" in made ? made.error : null, "the fixture line should be written").toBeNull();
  return (made as { line: Line }).line;
}

/** A catalog service of branch 1 carrying a warranty period of its own. */
async function warrantyService(page: Page, warrantyDays: number): Promise<string> {
  const groups = await call(
    page,
    "GET",
    `/api/v1/app/taxonomies?ClinicBranchId=${BRANCH}&Group=care_service&MaxResultCount=1`,
  );
  const taxonomyId = (groups.json as { items: { id: string }[] }).items[0].id;
  const made = await call(page, "POST", "/api/v1/app/catalog-entries", {
    clinicBranchId: BRANCH,
    taxonomyId,
    name: `DV BH NGAY DT ${runId()}`,
    price: 100000,
    stages: [],
    serviceConfig: {
      taxRate: 0,
      priceIncludesTax: false,
      discountIsPercent: true,
      discountValue: 0,
      requireImage: false,
      deductDoctorOnWarranty: false,
      separateRevenue: false,
      showToothOnInvoice: false,
      revenueByStage: false,
      requireStageSequence: false,
      warrantyDays,
      laboSupplierIds: [],
    },
  });
  expect(made.status, made.text).toBe(200);
  return (made.json as { id: string }).id;
}

async function staffId(page: Page): Promise<string> {
  const res = await call(page, "GET", "/api/v1/app/staff?MaxResultCount=1&Role=1");
  return (res.json as { items: { id: string }[] }).items[0].id;
}

function stageBody(line: Line, tooth: number, staff: string, treatmentDate?: string) {
  return {
    patientId: line.patientId,
    clinicBranchId: line.branchId,
    treatmentId: line.planId,
    treatmentServiceId: line.lineId,
    serviceId: line.serviceId,
    name: line.serviceName || "e2e",
    note: `e2e ngày điều trị ${runId()}`,
    staffId: staff,
    treatmentDate,
    teeth: [{ toothCode: tooth, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
  };
}

/**
 * Checks a "Ngày điều trị" picker opens on today with tomorrow shut, then types
 * `day` into it (mask mode: the bare digits from the day cell).
 */
async function pickTreatmentDate(page: Page, form: Locator, day: string): Promise<void> {
  await expect(form.getByText("Ngày tạo")).toHaveCount(0);
  await expect(form.locator(".floating-field", { hasText: "Ngày điều trị" }).locator(".floating-field-required")).toBeVisible();
  const date = form.locator(".pd-stage-date input");
  await expect(date).toHaveValue(typed(isoDay(0)));

  await date.click({ position: { x: 6, y: 8 } });
  const panel = page.locator(".ant-picker-dropdown:visible");
  await expect(panel.locator(`td[title="${isoDay(0)}"]`)).not.toHaveClass(/ant-picker-cell-disabled/);
  await expect(panel.locator(`td[title="${isoDay(1)}"]`)).toHaveClass(/ant-picker-cell-disabled/);

  await date.pressSequentially(typed(day).replaceAll("/", ""));
  await date.press("Enter");
  await expect(date).toHaveValue(typed(day));
}

/**
 * The treatment row for one công đoạn (`ref` = its id) or one tái khám (`ref` =
 * its REX code), wherever the pagination has put it.
 */
async function findTreatmentRow(page: Page, lineId: string, ref: string): Promise<Locator> {
  const row = page.locator(`.pd-treatment-table tbody tr[data-row-key="${lineId}:${ref}"]`);
  const next = page.locator(".pd-treatment-table li.ant-pagination-next");
  for (let guard = 0; guard < 40; guard += 1) {
    if ((await row.count()) > 0) return row;
    if ((await next.count()) === 0 || (await next.getAttribute("aria-disabled")) === "true") break;
    await next.click();
    await expect(page.locator(".pd-treatment-table tbody tr.ant-table-row").first()).toBeVisible();
  }
  throw new Error(`no treatment row for ${ref}`);
}

test.describe("Chi tiết phiếu — Ngày điều trị", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(150_000);
    await login(page);
  });

  test("the doctor picks a past day, never a later one, and history and the treatment table print it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    const line = await freshLine(page, 48);

    // A day of its own, years back, so its group holds this công đoạn alone.
    const picked = isoDay(-(1500 + (Date.now() % 1500)));

    await page.goto(`/patient/${line.patientId}/treatment-plan/${line.planId}?branchId=${line.branchId}`);
    await expect(page.locator(`.pdt-table tbody tr[data-row-key="${line.lineId}"]`)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Thêm công đoạn" }).click();
    const dialog = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await dialog.locator(`.pd-stage-picks button[data-line-id="${line.lineId}"]`).click();
    const form = dialog.locator(`.pd-stage-form[data-item-id="${line.lineId}"]`);

    // "Ngày tạo" is gone; "Ngày điều trị" starts on today, is required, and
    // tomorrow cannot be picked on the calendar.
    await pickTreatmentDate(page, form, picked);

    const doctor = form.locator(".ant-select").first();
    if ((await doctor.locator(".ant-select-content-has-value").count()) === 0) {
      await doctor.click();
      await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
    }
    await form.locator("textarea").fill(`e2e ngày điều trị ${runId()}`);

    const posted = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith("/api/v1/app/treatment-stages"),
    );
    await dialog.getByRole("button", { name: "Lưu công đoạn" }).click();
    expect((await posted).postDataJSON().treatmentDate).toBe(picked);
    await expect(page.getByText("Đã thêm công đoạn")).toBeVisible();

    // The server kept the picked day, and its creation time is still today's.
    const listed = await call(
      page,
      "GET",
      `/api/v1/app/treatment-stages?treatmentServiceId=${line.lineId}&maxResultCount=10`,
    );
    const [stage] = (listed.json as { items: { id: string; treatmentDate: string; creationTime: string }[] }).items;
    expect(stage.treatmentDate).toBe(picked);
    expect(stage.creationTime.slice(0, 4)).toBe(isoDay(0).slice(0, 4));

    // Lịch sử điều trị files it under the picked day.
    const historyRow = dialog.locator(`.pd-stage-histrow[data-stage-id="${stage.id}"]`);
    await expect(historyRow).toBeVisible();
    const historyDay = dialog.locator(".pd-stage-histday", {
      has: page.locator(`.pd-stage-histrow[data-stage-id="${stage.id}"]`),
    });
    await expect(historyDay.locator(".pd-stage-histdate b")).toHaveText(short(picked));

    // So does the treatment table's Ngày column, after a reload.
    await page.goto(`/patient/${line.patientId}?branchId=${line.branchId}&tab=profile`);
    await expect(page.locator(".pd-treatment-table tbody tr.ant-table-row").first()).toBeVisible({ timeout: 20_000 });
    const row = await findTreatmentRow(page, line.lineId, stage.id);
    await expect(row.locator(".pd-tr-day")).toHaveText(typed(picked));
  });

  test("the server refuses a later day, takes today when none is sent, and counts warranty from the picked day", async ({
    page,
  }) => {
    const line = await freshLine(page, 38);
    const staff = await staffId(page);

    const future = await call(page, "POST", "/api/v1/app/treatment-stages", stageBody(line, 38, staff, isoDay(1)));
    expect(future.status).not.toBe(200);
    expect(future.text).toContain("BlueDental:Treatment:0046");

    const omitted = await call(page, "POST", "/api/v1/app/treatment-stages", stageBody(line, 38, staff));
    expect(omitted.status, omitted.text).toBe(200);
    const today = omitted.json as { id: string; treatmentDate: string };
    expect(today.treatmentDate).toBe(isoDay(0));

    // Continuing cannot be dated later than today either.
    const continuedLate = await call(page, "POST", `/api/v1/app/treatment-stages/${today.id}/continue`, {
      staffId: staff,
      note: "e2e",
      treatmentDate: isoDay(1),
      toothCodes: [],
      alsoFrom: [],
    });
    expect(continuedLate.status).not.toBe(200);
    expect(continuedLate.text).toContain("BlueDental:Treatment:0046");

    // Worked longer ago than the service's warranty: written today, yet its
    // warranty has run out — the count starts from Ngày điều trị.
    const oldLine = await freshLine(page, 37, await warrantyService(page, 30));
    expect(oldLine.warrantyDays).toBe(30);
    const aged = await call(
      page,
      "POST",
      "/api/v1/app/treatment-stages",
      stageBody(oldLine, 37, staff, isoDay(-(oldLine.warrantyDays + 1))),
    );
    expect(aged.status, aged.text).toBe(200);
    const agedId = (aged.json as { id: string }).id;
    const closed = await call(page, "POST", `/api/v1/app/treatment-stages/${agedId}/complete`);
    expect(closed.status, closed.text).toBe(200);

    const warranty = await call(page, "POST", "/api/v1/app/treatment-stages", {
      ...stageBody(oldLine, 37, staff),
      isGuarantee: true,
      warrantySourceStageId: agedId,
    });
    expect(warranty.status).not.toBe(200);
    expect(warranty.text).toContain("BlueDental:Treatment:0035");

    // The same service worked a day inside its period still takes a warranty.
    const freshLineInPeriod = await freshLine(page, 36, oldLine.serviceId);
    const recent = await call(
      page,
      "POST",
      "/api/v1/app/treatment-stages",
      stageBody(freshLineInPeriod, 36, staff, isoDay(-(freshLineInPeriod.warrantyDays - 1))),
    );
    expect(recent.status, recent.text).toBe(200);
    const recentId = (recent.json as { id: string }).id;
    expect((await call(page, "POST", `/api/v1/app/treatment-stages/${recentId}/complete`)).status).toBe(200);
    const kept = await call(page, "POST", "/api/v1/app/treatment-stages", {
      ...stageBody(freshLineInPeriod, 36, staff),
      isGuarantee: true,
      warrantySourceStageId: recentId,
    });
    expect(kept.status, kept.text).toBe(200);
  });

  test("Tạo bảo hành and Tạo tái khám pick their Ngày điều trị too, and the server refuses a later one", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1700, height: 950 });
    const staff = await staffId(page);
    const line = await freshLine(page, 35, await warrantyService(page, 30));
    const source = await call(page, "POST", "/api/v1/app/treatment-stages", stageBody(line, 35, staff, isoDay(-3)));
    expect(source.status, source.text).toBe(200);
    const sourceId = (source.json as { id: string }).id;
    expect((await call(page, "POST", `/api/v1/app/treatment-stages/${sourceId}/complete`)).status).toBe(200);

    // Tạo bảo hành, from the finished công đoạn in Lịch sử điều trị.
    await page.goto(`/patient/${line.patientId}/treatment-plan/${line.planId}?branchId=${line.branchId}`);
    await expect(page.locator(`.pdt-table tbody tr[data-row-key="${line.lineId}"]`)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Thêm công đoạn" }).click();
    const slip = page.getByRole("dialog", { name: "Chi tiết phiếu" });
    await slip.locator(`.pd-stage-histrow[data-stage-id="${sourceId}"]`).getByRole("button", { name: "Bảo hành" }).click();

    const warranty = page.getByRole("dialog", { name: "Tạo bảo hành" });
    await expect(warranty).toBeVisible();
    const warrantyDay = isoDay(-1);
    await pickTreatmentDate(page, warranty, warrantyDay);
    await warranty.locator("textarea").fill(`e2e bảo hành ngày điều trị ${runId()}`);
    const warrantyPosted = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().endsWith("/api/v1/app/treatment-stages"),
    );
    await warranty.locator(".ant-modal-footer").getByRole("button", { name: "Lưu" }).click();
    const warrantyRes = await warrantyPosted;
    expect(warrantyRes.request().postDataJSON().treatmentDate).toBe(warrantyDay);
    const warrantyStage = (await warrantyRes.json()) as { id: string; isGuarantee: boolean; treatmentDate: string };
    expect(warrantyStage.isGuarantee).toBe(true);
    expect(warrantyStage.treatmentDate).toBe(warrantyDay);
    await expect(warranty).toBeHidden();
    const warrantyDayGroup = slip.locator(".pd-stage-histday", {
      has: page.locator(`.pd-stage-histrow[data-stage-id="${warrantyStage.id}"]`),
    });
    await expect(warrantyDayGroup.locator(".pd-stage-histdate b")).toHaveText(short(warrantyDay));

    // Tạo tái khám, from the profile tab's "Tạo Tái khám" listing.
    await page.goto(`/patient/${line.patientId}?branchId=${line.branchId}&tab=profile`);
    await expect(page.locator(".pd-treatment-table tbody tr.ant-table-row").first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Tạo Tái khám" }).click();
    await page
      .locator(`.pd-recall-dialog .pd-recall-row[data-stage-id="${sourceId}"]`)
      .getByRole("button", { name: "Tái Khám" })
      .click();

    const recall = page.locator(".pd-recall-form-dialog");
    await expect(recall).toBeVisible();
    // A day of its own, years back, so the tái khám row is easy to tell apart.
    const recallDay = isoDay(-(1500 + (Date.now() % 1500)));
    await pickTreatmentDate(page, recall, recallDay);
    await recall.locator(".pd-stage-teeth > div > button").first().click();
    await recall.locator("textarea").fill(`e2e tái khám ngày điều trị ${runId()}`);
    const recallPosted = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().endsWith("/api/v1/app/patient-re-examinations"),
    );
    await recall.locator(".ant-modal-footer button.ant-btn-primary").click();
    const recallRes = await recallPosted;
    expect(recallRes.status(), await recallRes.text()).toBe(200);
    expect(recallRes.request().postDataJSON().treatmentDate).toBe(recallDay);
    const visit = (await recallRes.json()) as { code: string; treatmentDate: string; creationTime: string };
    expect(visit.treatmentDate).toBe(recallDay);
    expect(visit.creationTime.slice(0, 4)).toBe(isoDay(0).slice(0, 4));

    // The treatment table dates the tái khám row by it, after a reload.
    await page.reload();
    await expect(page.locator(".pd-treatment-table tbody tr.ant-table-row").first()).toBeVisible({ timeout: 20_000 });
    const row = await findTreatmentRow(page, line.lineId, visit.code);
    await expect(row.locator(".pd-tr-day")).toHaveText(typed(recallDay));

    // The server refuses a later day for a tái khám, and takes today when none is sent.
    const reExamBody = (treatmentDate?: string) => ({
      patientId: line.patientId,
      clinicBranchId: line.branchId,
      patientStageId: sourceId,
      staffId: staff,
      note: "e2e",
      treatmentDate,
      teeth: [{ toothCode: 35, selected: true, top: false, right: false, bottom: false, left: false, center: false }],
    });
    const late = await call(page, "POST", "/api/v1/app/patient-re-examinations", reExamBody(isoDay(1)));
    expect(late.status).not.toBe(200);
    expect(late.text).toContain("BlueDental:Treatment:0046");
    const omitted = await call(page, "POST", "/api/v1/app/patient-re-examinations", reExamBody());
    expect(omitted.status, omitted.text).toBe(200);
    expect((omitted.json as { treatmentDate: string }).treatmentDate).toBe(isoDay(0));
  });
});
