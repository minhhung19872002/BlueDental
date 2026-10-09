import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";

/**
 * Feature: Đơn thuốc — the patient's prescription tab (F-58 dialog).
 *
 * The tab lists the patient's slips on this branch with In, Sửa and Xóa on each
 * row; "Tạo đơn thuốc" opens the dialog (which rides in the URL as
 * `create=true`). The dialog picks its diagnoses from the patient's phiếu điều
 * trị through the "Danh mục ICD-10" panel (one row per diagnosis of a slip,
 * teeth merged), fills "Ghi chú chẩn đoán" from those diagnoses' notes, and
 * doses each medicine Sáng / Trưa / Chiều / Tối × Số ngày. Ticking "Lưu đơn
 * thuốc mẫu" files the lines back into the Đơn thuốc mẫu catalog.
 *
 * Real stack only: real login, real ASP.NET Core API, real PostgreSQL. The
 * treatment slip is opened through the real consulting API (diagnosis slips →
 * consulting lines → accept → open). The tests run in order and hand the slip
 * they made down the line, and the last one cleans up.
 */

const PRESCRIPTIONS_API = "/api/v1/app/prescriptions";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

interface Seed {
  patientId: string;
  otherPatientId: string;
  planId: string;
  planCode: string;
  first: { id: string; name: string };
  second: { id: string; name: string };
}

/**
 * A treatment slip on a branch-1 patient carrying two diagnoses:
 * the first on teeth 36 and 37 (two consulting lines of one diagnosis slip,
 * note A), the second on 11 and 12 (two diagnosis slips, notes B and A) — so
 * the picker merges teeth per diagnosis and the note lists A and B once each.
 */
async function seedTreatmentSlip(page: Page, noteA: string, noteB: string): Promise<Seed> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");
  const made = await page.evaluate(
    async ({ branch, noteA, noteB }) => {
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Clinic-Branch-Id": branch,
      };
      const get = async (url: string) => (await fetch(url, { credentials: "include", headers })).json();
      const post = async (url: string, body?: unknown) => {
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${url} ${res.status} ${await res.text()}`);
        return res.json();
      };
      const tooth = (toothCode: number) => ({
        toothCode,
        selected: true,
        top: false,
        right: false,
        bottom: false,
        left: false,
        center: false,
      });

      try {
        const patients = (await get("/api/v1/app/patients?maxResultCount=2")).items;
        const diagnoses = (
          await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=diagnosis&isActive=true&maxResultCount=20`)
        ).items as { id: string; name: string }[];
        const [first, second] = diagnoses.filter(
          (entry, index) => diagnoses.findIndex((other) => other.name === entry.name) === index,
        );
        const service = (
          await get(`/api/v1/app/catalog-entries?clinicBranchId=${branch}&group=care_service&isActive=true&maxResultCount=1`)
        ).items[0];
        const staff = (await get("/api/v1/app/staff?MaxResultCount=1")).items[0];
        const patientId = patients[0].id as string;

        const slip = (diagnosisId: string, note: string, teeth: number[]) =>
          post("/api/v1/app/patient-diagnoses", {
            patientId,
            clinicBranchId: branch,
            diagnosisId,
            staffId: staff.id,
            note,
            teeth: teeth.map(tooth),
          });
        const accepted = async (patientDiagnosisId: string, diagnosisId: string, toothCode: number) => {
          const advise = await post("/api/v1/app/patient-advises", {
            patientId,
            clinicBranchId: branch,
            patientDiagnosisId,
            diagnosisId,
            serviceId: service.id,
            staffId: staff.id,
            // Zero-priced: the slip is only there for its diagnoses, and must
            // not leave a debt on the shared demo patient.
            originalPrice: 0,
            price: 0,
            quantity: 1,
            discountType: 0,
            discountValue: 0,
            teeth: [tooth(toothCode)],
          });
          await post(`/api/v1/app/patient-advises/${advise.id}/accept`);
          return advise.id as string;
        };

        const slipA = await slip(first.id, noteA, [36, 37]);
        const slipB = await slip(second.id, noteB, [11]);
        const slipC = await slip(second.id, noteA, [12]);
        const adviseIds = [
          await accepted(slipA.id, first.id, 36),
          await accepted(slipA.id, first.id, 37),
          await accepted(slipB.id, second.id, 11),
          await accepted(slipC.id, second.id, 12),
        ];
        const plan = await post("/api/v1/app/patient-treatments", {
          patientId,
          clinicBranchId: branch,
          dentistId: staff.id,
          discountType: 0,
          discountValue: 0,
          voucherIds: [],
          adviseIds,
        });
        return {
          patientId,
          otherPatientId: patients[1].id as string,
          planId: plan.id as string,
          planCode: plan.code as string,
          first: { id: first.id, name: first.name },
          second: { id: second.id, name: second.name },
        };
      } catch (error) {
        return { error: String(error) };
      }
    },
    { branch: BRANCH_ONE, noteA, noteB },
  );
  expect("error" in made ? made.error : null, "the treatment slip should be opened").toBeNull();
  return made as Seed;
}

async function createGroup(page: Page, name: string) {
  await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Tên phân loại/).fill(name);
  await dialog.getByRole("button", { name: /Lưu$/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

/** The line picker reads the branch's thuốc catalog, so seed one the test knows by name. */
async function createMedicine(page: Page, id: string, name: string) {
  await page.goto("/taxonomy/medicine");
  await createGroup(page, `NHOM RX ${id}`);
  await page.getByRole("button", { name: /Thêm loại thuốc$/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Tên thuốc/).fill(name);
  await dialog.getByRole("button", { name: /Lưu$/ }).click();
  await expect(dialog).toBeHidden();
}

async function openPrescriptionTab(page: Page, patientUrl: string) {
  await page.goto(`${patientUrl}?tab=prescription&branchId=${BRANCH_ONE}`);
  await assertRealApiTraffic(page, PRESCRIPTIONS_API);
}

function saved(page: Page, method: "POST" | "PUT" | "DELETE") {
  return page.waitForResponse(
    (res) =>
      res.url().includes(PRESCRIPTIONS_API) &&
      !res.url().includes("diagnosis-sources") &&
      res.request().method() === method,
  );
}

/** A field of the medicine line the desktop table is showing. */
function lineField(dialog: Locator, label: string): Locator {
  return dialog.getByLabel(label, { exact: true });
}

async function pickOption(page: Page, text: string | RegExp) {
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: text })
    .first()
    .click();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe.serial("Đơn thuốc", () => {
  const id = runId();
  const medicine = `THUOC RX ${id}`;
  const template = `DON BN ${id}`;
  const noteA = `Đau về đêm ${id}`;
  const noteB = `Sưng nhẹ ${id}`;
  const editedNote = `Ghi chú sửa ${id}`;
  let seed: Seed;
  let patientUrl = "";
  /** "DT05 – Viêm tủy (R36, R37); DT05 – Sâu ngà (R11, R12)" — what the list and the print show. */
  let printedBoth = "";
  let printedFirst = "";

  test("the tab lists the columns of the reference and opens the dialog from the URL", async ({
    page,
  }) => {
    await login(page);
    seed = await seedTreatmentSlip(page, noteA, noteB);
    patientUrl = `/patient/${seed.patientId}`;
    printedFirst = `${seed.planCode} – ${seed.first.name} (R36, R37)`;
    printedBoth = `${printedFirst}; ${seed.planCode} – ${seed.second.name} (R11, R12)`;

    await openPrescriptionTab(page, patientUrl);
    await expect(page.getByRole("button", { name: "Tạo đơn thuốc" })).toBeVisible();
    for (const header of ["Mã đơn thuốc", "Bác sĩ", "Chẩn đoán", "Tái khám", "Ngày tạo", "Thao tác"]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    }
    await expect(page.locator(".ant-pagination-total-text")).toHaveText(/Hiển thị \d+ trên \d+/);

    // The dialog is URL-driven, as on the reference: the button writes the flag…
    await page.getByRole("button", { name: "Tạo đơn thuốc" }).click();
    await expect(page).toHaveURL(/create=true/);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Thêm đơn thuốc")).toBeVisible();

    // …and nothing can be saved before a doctor and a medicine are picked.
    await expect(dialog.getByRole("button", { name: /Lưu$/ })).toBeDisabled();
    await dialog.getByRole("button", { name: /Hủy$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/create=true/);

    // Reaching the URL directly opens it, and the other tabs' links do not
    // carry the flag along — the dialog belongs to this tab only.
    await page.goto(`${patientUrl}?tab=prescription&create=true`);
    await expect(page.getByRole("dialog").getByText("Thêm đơn thuốc")).toBeVisible();
    await expect(page.getByRole("link", { name: "Lịch hẹn" })).toHaveAttribute(
      "href",
      /tab=appointment/,
    );
    await expect(page.getByRole("link", { name: "Lịch hẹn" })).not.toHaveAttribute(
      "href",
      /create=true/,
    );
  });

  test("a slip picks its diagnoses from the treatment slips, doses by session, and files a template", async ({
    page,
  }) => {
    await login(page);
    await createMedicine(page, id, medicine);
    await openPrescriptionTab(page, patientUrl);

    const sourcesLoaded = page.waitForResponse(
      (res) => res.url().includes(`${PRESCRIPTIONS_API}/diagnosis-sources`) && res.ok(),
    );
    await page.getByRole("button", { name: "Tạo đơn thuốc" }).click();
    expect((await sourcesLoaded).ok()).toBeTruthy();
    const dialog = page.getByRole("dialog");
    const save = dialog.getByRole("button", { name: /Lưu$/ });

    await dialog.getByLabel("Chọn bác sĩ").click();
    await page.locator(".ant-select-dropdown:visible .ant-select-item-option").first().click();
    await expect(save).toBeDisabled();

    // "Chẩn đoán" opens unfolded, folds and unfolds again.
    const section = dialog.getByRole("region", { name: "Chẩn đoán" });
    const icdSearch = section.getByLabel("Gõ mã ICD-10, tên bệnh hoặc số răng để thêm…");
    await expect(icdSearch).toBeVisible();
    await section.getByRole("button", { name: "Thu gọn", exact: true }).click();
    await expect(icdSearch).toBeHidden();
    await section.getByRole("button", { name: "Mở rộng", exact: true }).click();
    await expect(icdSearch).toBeVisible();

    // The ICD-10 search is UI only: it says the catalog is not linked and
    // offers the treatment slips instead.
    await icdSearch.fill("K04");
    await expect(page.getByText("Chưa liên kết danh mục ICD-10")).toBeVisible();
    await page.getByRole("button", { name: "Mở danh mục ICD-10 để duyệt theo nhóm" }).click();
    const panel = section.getByRole("region", { name: "Danh mục ICD-10 · Răng hàm mặt" });
    await expect(panel).toBeVisible();

    // A single group, "Phiếu điều trị"; one tick per diagnosis of a slip, teeth merged.
    await expect(panel.locator(".rx-slip-nav-item")).toHaveCount(1);
    await expect(panel.locator(".rx-slip-nav-item")).toContainText("Phiếu điều trị");
    await panel.getByLabel("Gõ số phiếu, tên chẩn đoán hoặc số răng").fill(seed.planCode);
    // Grouped by "Buổi điều trị" as in the mock: the seeded slip was opened today (R-824).
    await expect(panel.locator(".rx-slip-heading").first()).toHaveText(/^Buổi điều trị hôm nay · \d+ chẩn đoán$/);
    const firstTick = panel.locator(".rx-slip-row").filter({ hasText: seed.first.name });
    const secondTick = panel.locator(".rx-slip-row").filter({ hasText: seed.second.name });
    await expect(firstTick).toHaveCount(1);
    await expect(firstTick).toContainText(seed.planCode);
    await expect(firstTick).toContainText("R36, R37");
    await expect(secondTick).toContainText("R11, R12");

    // The note is filled from the diagnoses' own notes: each once, one per line.
    // A single note stays bare; from two on, each line starts with "- " (R-825).
    const note = dialog.getByLabel("Ghi chú chẩn đoán (không bắt buộc)");
    await firstTick.click();
    await expect(note).toHaveValue(noteA);
    await secondTick.click();
    await expect(panel).toContainText("đã chọn 2 chẩn đoán");
    await expect(section.locator(".rx-chip")).toHaveText("2 đã chọn");
    await expect(note).toHaveValue(`- ${noteA}\n- ${noteB}`);

    await panel.getByRole("button", { name: "Xong, thu gọn" }).click();
    await expect(panel).toBeHidden();

    const picked = section.locator(".rx-dx-table tbody tr.ant-table-row");
    await expect(picked).toHaveCount(2);
    await expect(picked.first()).toContainText(seed.planCode);
    await expect(picked.first()).toContainText(seed.first.name);
    await expect(picked.first()).toContainText("R36");
    await expect(picked.first()).toContainText("R37");
    await expect(picked.first()).toContainText("Chưa có phác đồ (chờ ICD-10)");
    // Suggested medicines wait on ICD-10: shown, but not usable.
    await expect(picked.first().getByRole("button", { name: "Thêm vào đơn" })).toBeDisabled();
    await expect(section).toContainText(`Trên đơn in: ${printedBoth}`);

    // Dropping a pick refills the note while nobody has typed into it.
    await section
      .getByRole("button", { name: `Bỏ chẩn đoán ${seed.planCode} ${seed.second.name}` })
      .click();
    await expect(picked).toHaveCount(1);
    await expect(note).toHaveValue(noteA);
    await section.getByRole("button", { name: "Danh mục ICD-10" }).click();
    await panel.getByLabel("Gõ số phiếu, tên chẩn đoán hoặc số răng").fill(seed.planCode);
    await secondTick.click();
    await expect(note).toHaveValue(`- ${noteA}\n- ${noteB}`);
    await panel.getByRole("button", { name: "Xong, thu gọn" }).click();

    await dialog.getByLabel("Nhập lời dặn").fill(`Lời dặn e2e ${id}`);

    // Sáng / Trưa / Chiều / Tối × Số ngày; "Số lượng" is derived and disabled.
    await lineField(dialog, "Tên thuốc").fill(medicine);
    await pickOption(page, medicine);
    await expect(lineField(dialog, "Sáng — thuốc 1")).toHaveValue("1");
    await lineField(dialog, "Tối — thuốc 1").fill("1");
    await lineField(dialog, "Số ngày — thuốc 1").fill("3");
    const quantity = lineField(dialog, "Số lượng — thuốc 1");
    await expect(quantity).toBeDisabled();
    await expect(quantity).toHaveValue("6");
    await lineField(dialog, "Trưa — thuốc 1").fill("0.5");
    await expect(quantity).toHaveValue("7.5");
    await lineField(dialog, "Trưa — thuốc 1").fill("0");
    await expect(quantity).toHaveValue("6");
    // A dose "n lần × mỗi lần" could not hold, so the template round trip
    // below proves the sessions are copied straight across (R-884).
    await lineField(dialog, "Chiều — thuốc 1").fill("0.5");
    await expect(quantity).toHaveValue("7.5");
    await expect(save).toBeEnabled();

    // Ticking "Lưu đơn thuốc mẫu" asks for the template's name before saving.
    await dialog.getByLabel("Lưu đơn thuốc mẫu").check();
    const templateName = dialog.getByLabel(/Tên đơn thuốc mẫu/);
    await expect(templateName).toBeVisible();
    await expect(save).toBeDisabled();
    await templateName.fill(template);
    await expect(save).toBeEnabled();

    const created = saved(page, "POST");
    await save.click();
    const response = await created;
    expect(response.ok(), await response.text()).toBeTruthy();
    const sent = JSON.parse(response.request().postData() ?? "{}") as {
      diagnosisText: string;
      diagnosisNote: string;
      diagnoses: { treatmentPlanId: string; diagnosisId: string }[];
      items: { morning: number; noon: number; afternoon: number; evening: number; days: number }[];
    };
    expect(sent.diagnosisText).toBe(printedBoth);
    expect(sent.diagnosisNote).toBe(`- ${noteA}\n- ${noteB}`);
    expect(sent.diagnoses).toEqual([
      { treatmentPlanId: seed.planId, diagnosisId: seed.first.id },
      { treatmentPlanId: seed.planId, diagnosisId: seed.second.id },
    ]);
    expect(sent.items[0]).toMatchObject({ morning: 1, noon: 0, afternoon: 0.5, evening: 1, days: 3 });
    // The server rebuilt the snapshot from the slip, and worked out the quantity.
    const slip = (await response.json()) as {
      diagnoses: { planCode: string; diagnosisName: string; toothCodes: number[] }[];
      items: { quantity: number }[];
    };
    expect(slip.diagnoses.map((d) => [d.planCode, d.diagnosisName, d.toothCodes])).toEqual([
      [seed.planCode, seed.first.name, [36, 37]],
      [seed.planCode, seed.second.name, [11, 12]],
    ]);
    expect(slip.items[0].quantity).toBe(7.5);

    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/create=true/);
    const row = page.getByRole("row", { name: new RegExp(escapeRegExp(printedBoth)) });
    await expect(row).toBeVisible();
    await expect(row).toContainText(/DT\d{2}-\d{4}/);

    await page.reload();
    await assertRealApiTraffic(page, PRESCRIPTIONS_API);
    await expect(page.getByRole("row", { name: new RegExp(escapeRegExp(printedBoth)) })).toBeVisible();

    // The template the tick made is offered on the next slip with the very
    // same sessions — the template doses by session too (R-884) — advice included.
    await page.getByRole("button", { name: "Tạo đơn thuốc" }).click();
    const next = page.getByRole("dialog");
    await next.getByLabel("Chọn đơn thuốc mẫu").fill(template);
    await pickOption(page, template);
    await expect(lineField(next, "Sáng — thuốc 1")).toHaveValue("1");
    await expect(lineField(next, "Trưa — thuốc 1")).toHaveValue("0");
    await expect(lineField(next, "Chiều — thuốc 1")).toHaveValue("0.5");
    await expect(lineField(next, "Tối — thuốc 1")).toHaveValue("1");
    await expect(lineField(next, "Số ngày — thuốc 1")).toHaveValue("3");
    await expect(lineField(next, "Số lượng — thuốc 1")).toHaveValue("7.5");
    await expect(next.getByLabel("Nhập lời dặn")).toHaveValue(`Lời dặn e2e ${id}`);
    await next.getByRole("button", { name: /Hủy$/ }).click();
    await expect(next).toBeHidden();
  });

  test("Sửa reopens the picks, note and doses, and keeps a typed note", async ({ page }) => {
    await login(page);
    await openPrescriptionTab(page, patientUrl);

    await page
      .getByRole("row", { name: new RegExp(escapeRegExp(printedBoth)) })
      .getByRole("button", { name: "Sửa" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Cập nhật đơn thuốc")).toBeVisible();
    const section = dialog.getByRole("region", { name: "Chẩn đoán" });
    await expect(section.locator(".rx-dx-table tbody tr.ant-table-row")).toHaveCount(2);
    const note = dialog.getByLabel("Ghi chú chẩn đoán (không bắt buộc)");
    await expect(note).toHaveValue(`- ${noteA}\n- ${noteB}`);
    await expect(lineField(dialog, "Sáng — thuốc 1")).toHaveValue("1");
    await expect(lineField(dialog, "Chiều — thuốc 1")).toHaveValue("0.5");
    await expect(lineField(dialog, "Tối — thuốc 1")).toHaveValue("1");
    await expect(lineField(dialog, "Số ngày — thuốc 1")).toHaveValue("3");
    await expect(lineField(dialog, "Số lượng — thuốc 1")).toHaveValue("7.5");

    // A note the doctor typed is never overwritten by a pick change.
    await note.fill(editedNote);
    await section
      .getByRole("button", { name: `Bỏ chẩn đoán ${seed.planCode} ${seed.second.name}` })
      .click();
    await expect(note).toHaveValue(editedNote);

    const updated = saved(page, "PUT");
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    const response = await updated;
    expect(response.ok(), await response.text()).toBeTruthy();
    await expect(dialog).toBeHidden();

    await page.reload();
    await assertRealApiTraffic(page, PRESCRIPTIONS_API);
    const row = page.getByRole("row", { name: new RegExp(`${escapeRegExp(printedFirst)}(?!;)`) });
    await expect(row).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(escapeRegExp(printedBoth)) })).toHaveCount(0);

    await row.getByRole("button", { name: "Sửa" }).click();
    const reopened = page.getByRole("dialog");
    await expect(reopened.getByRole("region", { name: "Chẩn đoán" }).locator(".rx-dx-table tbody tr.ant-table-row")).toHaveCount(1);
    await expect(reopened.getByLabel("Ghi chú chẩn đoán (không bắt buộc)")).toHaveValue(editedNote);
    await reopened.getByRole("button", { name: /Hủy$/ }).click();
  });

  test("In đơn thuốc shows the slip read-only with the session doses", async ({ page }) => {
    await login(page);
    await openPrescriptionTab(page, patientUrl);

    const row = page.getByRole("row", { name: new RegExp(`${escapeRegExp(printedFirst)}(?!;)`) });
    const code = (await row.locator("td").first().textContent())?.trim() ?? "";
    await row.getByRole("button", { name: "In đơn thuốc" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Xem đơn thuốc ${code}`);
    await expect(dialog).toContainText("ĐƠN THUỐC");
    await expect(dialog).toContainText(printedFirst);
    await expect(dialog).toContainText(medicine);
    await expect(dialog).toContainText("Sáng 1 · Chiều 0.5 · Tối 1 · 3 ngày");
    await expect(dialog).toContainText(`Lời dặn e2e ${id}`);
    // Read-only: nothing on the sheet can be typed into.
    await expect(dialog.locator(".rx-sheet input, .rx-sheet textarea")).toHaveCount(0);

    // The browser's own print dialog cannot be driven, so count the call and
    // render print media the way the preview would.
    await page.evaluate(() => {
      const w = window as Window & { printCalls?: number };
      w.printCalls = 0;
      w.print = () => {
        w.printCalls = (w.printCalls ?? 0) + 1;
      };
    });
    await dialog.getByRole("button", { name: "In đơn thuốc" }).click();
    expect(await page.evaluate(() => (window as Window & { printCalls?: number }).printCalls)).toBe(1);

    await page.emulateMedia({ media: "print" });
    const printed = page.locator(".rx-print-sheet");
    await expect(printed).toBeVisible();
    await expect(printed).toContainText(medicine);
    await expect(dialog).toBeHidden();
    await page.emulateMedia({ media: "screen" });

    await dialog.locator("button").filter({ hasText: "Đóng" }).click();
    await expect(dialog).toBeHidden();
    await expect(printed).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/pd-printing/);
  });

  test("the server refuses another patient's treatment slip and a diagnosis picked twice", async ({
    page,
  }) => {
    await login(page);
    await openPrescriptionTab(page, patientUrl);

    const answers = await page.evaluate(
      async ({ api, branch, seed }) => {
        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Clinic-Branch-Id": branch,
        };
        const list = await (
          await fetch(`${api}?patientId=${seed.patientId}&clinicBranchId=${branch}&maxResultCount=1`, {
            credentials: "include",
            headers,
          })
        ).json();
        const existing = list.items[0];
        const attempt = async (patientId: string, diagnoses: unknown[]) => {
          const res = await fetch(api, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({
              patientId,
              clinicBranchId: branch,
              staffId: existing.staffId,
              diagnoses,
              items: [{ medicationId: existing.items[0].medicationId, morning: 1, days: 1, usage: 0 }],
            }),
          });
          const body = await res.json().catch(() => ({}));
          return { status: res.status, code: (body.error?.code ?? null) as string | null };
        };
        const pick = { treatmentPlanId: seed.planId, diagnosisId: seed.first.id };
        return {
          otherPatient: await attempt(seed.otherPatientId, [pick]),
          pickedTwice: await attempt(seed.patientId, [pick, pick]),
        };
      },
      { api: PRESCRIPTIONS_API, branch: BRANCH_ONE, seed },
    );
    expect(answers.otherPatient.status).toBeGreaterThanOrEqual(400);
    expect(answers.otherPatient.code).toBe("BlueDental:Treatment:0044");
    expect(answers.pickedTwice.status).toBeGreaterThanOrEqual(400);
    expect(answers.pickedTwice.code).toBe("BlueDental:Treatment:0045");
  });

  test("an account limited to another branch is refused the slip and its diagnoses", async ({
    browser,
  }) => {
    const page = await freshPage(browser);
    await login(page, BRANCH2_USER);

    const refused = await page.evaluate(
      async ({ api, patientId, branch }) => {
        const read = async (url: string) => {
          const res = await fetch(url, { headers: { accept: "application/json" } });
          const json = await res.json().catch(() => ({}));
          return { status: res.status, items: (json.items ?? []) as unknown[] };
        };
        return {
          list: await read(`${api}?patientId=${patientId}&clinicBranchId=${branch}`),
          sources: await read(`${api}/diagnosis-sources?patientId=${patientId}&clinicBranchId=${branch}`),
        };
      },
      { api: PRESCRIPTIONS_API, patientId: seed.patientId, branch: BRANCH_ONE },
    );
    expect(refused.list.status).toBe(403);
    expect(refused.list.items).toHaveLength(0);
    expect(refused.sources.status).toBe(403);
    expect(refused.sources.items).toHaveLength(0);

    await page.goto(`${patientUrl}?tab=prescription`);
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
    await expect(page.getByRole("row", { name: new RegExp(escapeRegExp(printedFirst)) })).toHaveCount(0);
    await page.close();
  });

  test("Xóa asks first, then removes the slip for good", async ({ page }) => {
    await login(page);
    await openPrescriptionTab(page, patientUrl);

    const row = page.getByRole("row", { name: new RegExp(`${escapeRegExp(printedFirst)}(?!;)`) });
    await row.getByRole("button", { name: "Xóa" }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toContainText(/DT\d{2}-\d{4}/);

    const deleted = saved(page, "DELETE");
    await confirm.getByRole("button", { name: /Xoá$/ }).click();
    expect((await deleted).ok()).toBeTruthy();
    await expect(confirm).toBeHidden();
    await expect(row).toHaveCount(0);

    await page.reload();
    await assertRealApiTraffic(page, PRESCRIPTIONS_API);
    await expect(page.getByRole("row", { name: new RegExp(`${escapeRegExp(printedFirst)}(?!;)`) })).toHaveCount(0);
  });
});

async function freshPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}
