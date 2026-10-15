import { readFileSync } from "node:fs";
import { expect, test, type Download, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { login, runId } from "./fixtures/auth";
import { purgeRunGroups } from "./fixtures/cleanup";

/**
 * BA R-961 (Danh mục > Dịch vụ > Cập nhật dịch vụ > tab Công đoạn): "Xuất" and
 * "Nhập" beside "+ Công đoạn", worded like the catalog toolbar's. "Nhập" opens
 * the catalog import's dialog: Chọn file → Kiểm tra (row-by-row preview) →
 * Hoàn tất.
 *
 * Owner decisions: the file replaces the list, each row keeping the id of the
 * current stage with the same name (so a patient's ticked công đoạn keeps
 * pointing at it); stages the file leaves out show in the preview as "Xóa";
 * one bad row rejects the whole file. The server refuses any save that drops a
 * stage a patient's công đoạn already ticked (Catalogs:0035) — the bin icon,
 * this import and the bulk catalog import alike.
 *
 * Real stack: real login, real API, real PostgreSQL — nothing is intercepted;
 * what was saved is read back with a separate request.
 */

const TAXONOMIES = "/api/v1/app/taxonomies";
const ENTRIES = "/api/v1/app/catalog-entries";
const BRANCH = "11111111-1111-1111-1111-111111111111";
const STAGE_IN_USE = "BlueDental:Catalogs:0035";
const PERCENT = 0;
const AMOUNT = 1;

test.afterAll(async ({ browser }) => {
  await purgeRunGroups(browser, "care_service", ["NHOM CD"]);
});

interface Reply<T> {
  status: number;
  body: T & { error?: { code?: string; message?: string } };
}

async function call<T>(page: Page, method: string, url: string, body?: unknown): Promise<Reply<T>> {
  return page.evaluate(
    async ({ method, url, body, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const init: RequestInit = {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": "vi",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await fetch(url, init);
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : {}) as never };
    },
    { method, url, body, branch: BRANCH },
  );
}

interface Stage {
  id?: string;
  name: string;
  value: number;
  valueType: number;
  isMarketingSalary: boolean;
}

interface Service {
  id: string;
  name: string;
  taxonomyId: string;
  stages: Required<Stage>[];
}

/** A fresh group holding one service with the given stages; returns the service as saved. */
async function seedService(page: Page, label: string, stages: Stage[]): Promise<Service> {
  const id = runId();
  const group = await call<{ id: string }>(page, "POST", TAXONOMIES, {
    clinicBranchId: BRANCH, group: "care_service", name: `NHOM CD ${id}`, sortOrder: 0,
  });
  expect(group.status).toBe(200);
  const created = await call<Service>(page, "POST", ENTRIES, {
    taxonomyId: group.body.id, name: `${label} ${id}`, price: 500000, sortOrder: 0, stages,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  expect(created.body.stages.map((s) => s.name)).toEqual(stages.map((s) => s.name));
  return { ...created.body, taxonomyId: group.body.id };
}

async function readService(page: Page, id: string): Promise<Service> {
  const res = await call<Service>(page, "GET", `${ENTRIES}/${id}`);
  expect(res.status).toBe(200);
  return res.body;
}

/** The PUT the dialog sends, with only the stage table changed. */
function saveStages(page: Page, service: Service, stages: Stage[]) {
  return call<Service>(page, "PUT", `${ENTRIES}/${service.id}`, {
    taxonomyId: service.taxonomyId, name: service.name, price: 500000, sortOrder: 0, isActive: true, stages,
  });
}

async function openStagesTab(page: Page, service: Service) {
  await page.goto(`/taxonomy/service?group=${service.taxonomyId}`);
  await page
    .getByRole("row", { name: new RegExp(service.name) })
    .getByRole("button")
    .nth(1)
    .click();
  // The import dialog opens beside this one, so pin the service dialog by its tab.
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("tab", { name: "Công đoạn" }) });
  await dialog.getByRole("tab", { name: "Công đoạn" }).click();
  return dialog;
}

const HEADER = ["Tên công đoạn *", "Loại *", "Giá trị *", "Tính lương cho phòng MKT"];

/** An .xlsx made the way a user would fill the exported template. */
function workbook(rows: (string | number)[][], header: string[] = HEADER): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Công đoạn");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** A downloaded workbook's first sheet, row by row. */
async function downloadedRows(download: Download): Promise<(string | number)[][]> {
  const book = XLSX.read(readFileSync(await download.path()));
  return XLSX.utils.sheet_to_json<(string | number)[]>(book.Sheets[book.SheetNames[0]], {
    header: 1,
    blankrows: false,
    defval: "",
  });
}

function importDialog(page: Page) {
  return page.getByRole("dialog").filter({ hasText: "Nhập công đoạn từ Excel" });
}

/** Step "Chọn file" → "Kiểm tra file"; leaves the import dialog on its preview. */
async function checkFile(page: Page, rows: (string | number)[][], header?: string[]) {
  const dialog = importDialog(page);
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "cong-doan.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbook(rows, header),
  });
  await dialog.getByRole("button", { name: /Kiểm tra file$/ }).click();
}

/** A preview row, picked by its "Dòng" cell. */
function previewRow(page: Page, row: number) {
  return importDialog(page)
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: String(row), exact: true }) });
}

/** Puts `serviceId` on an open slip of the branch and opens a công đoạn on it that ticks `stageId`. */
async function tickStageOnPatient(page: Page, serviceId: string, stageId: string) {
  const slips = await call<{ items: { id: string; patientId: string; branchId: string; status: number; services: { id: string }[] }[] }>(
    page, "GET", "/api/v1/app/patient-treatments?maxResultCount=300",
  );
  // 5 = Completed, 6 = Cancelled: a closed slip takes no new line.
  const slip = slips.body.items.find((s) => s.branchId === BRANCH && s.status !== 5 && s.status !== 6);
  expect(slip, "the demo clinic should have an open treatment slip").toBeTruthy();

  const known = new Set(slip!.services.map((l) => l.id));
  const tooth = { toothCode: 16, selected: true, top: false, right: false, bottom: false, left: false, center: false };
  const added = await call<{ services: { id: string; serviceId: string }[] }>(
    page, "POST", `/api/v1/app/patient-treatments/${slip!.id}/services`,
    { serviceId, price: 500000, quantity: 1, discountType: 0, discountValue: 0, status: 1, teeth: [tooth] },
  );
  expect(added.status, JSON.stringify(added.body)).toBe(200);
  const line = added.body.services.find((l) => !known.has(l.id));
  expect(line, "the new line should come back").toBeTruthy();

  const staff = await call<{ items: { id: string }[] }>(page, "GET", "/api/v1/app/staff?MaxResultCount=1&Role=1");
  const stage = await call(page, "POST", "/api/v1/app/treatment-stages", {
    patientId: slip!.patientId,
    clinicBranchId: BRANCH,
    treatmentId: slip!.id,
    treatmentServiceId: line!.id,
    serviceId,
    name: "e2e công đoạn",
    staffId: staff.body.items[0].id,
    teeth: [tooth],
    serviceItemIds: [stageId],
  });
  expect(stage.status, JSON.stringify(stage.body)).toBe(200);
}

test.describe("Danh mục > Dịch vụ > Công đoạn — Xuất / Nhập Excel", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/taxonomy/service");
  });

  test("export writes the table; import replaces it, keeps ids by name and saves on Lưu", async ({ page }) => {
    const service = await seedService(page, "DV CD EXCEL", [
      { name: "Lấy dấu", value: 30, valueType: PERCENT, isMarketingSalary: true },
      { name: "Gắn sứ", value: 250000, valueType: AMOUNT, isMarketingSalary: false },
      { name: "Kiểm tra", value: 0, valueType: PERCENT, isMarketingSalary: false },
    ]);
    const [impression, crown] = service.stages;
    const dialog = await openStagesTab(page, service);
    const exportButton = dialog.getByRole("button", { name: /Xuất$/ });
    const importButton = dialog.getByRole("button", { name: /Nhập$/ });
    // No bare file picker; the buttons sit on the stage box's row.
    await expect(dialog.locator('input[type="file"]')).toHaveCount(0);
    const boxTop = (await dialog.getByRole("textbox", { name: "Công đoạn", exact: true }).boundingBox())?.y ?? 0;
    for (const button of [dialog.getByRole("button", { name: /Công đoạn$/ }), exportButton, importButton]) {
      const top = (await button.boundingBox())?.y ?? 0;
      expect(Math.abs(top - boxTop)).toBeLessThan(24);
    }

    // ── Xuất: the table as it stands, one row per stage ──────────────────────
    const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
    expect(download.suggestedFilename()).toMatch(/^cong-doan-.+\.xlsx$/);
    const rows = await downloadedRows(download);
    // No STT column; a required header ends in " *", as in the catalog import template.
    expect(rows[0]).toEqual(HEADER);
    expect(rows.slice(1)).toEqual([
      ["Lấy dấu", "%", 30, "Có"],
      ["Gắn sứ", "VNĐ", 250000, ""],
      ["Kiểm tra", "%", 0, ""],
    ]);

    // ── Nhập: "Kiểm tra" is left out, "Đánh bóng" is new ─────────────────────
    await importButton.click();
    const preview = importDialog(page);
    const file = [
      ["Lấy dấu", "%", 40, "Không"],
      ["Đánh bóng", "VNĐ", "100.000", "Có"],
      ["  gắn  SỨ ", "VNĐ", 300000, ""],
    ];
    await checkFile(page, file);
    await expect(preview).toContainText("3 dòng: 1 thêm mới, 2 cập nhật, 0 giữ nguyên, 0 lỗi");
    await expect(preview).toContainText("1 công đoạn không có trong file sẽ bị xóa khỏi dịch vụ");
    await expect(previewRow(page, 2)).toContainText("Cập nhật");
    await expect(previewRow(page, 3)).toContainText("Thêm mới");
    await expect(previewRow(page, 4)).toContainText("Cập nhật");
    await expect(preview.getByRole("row", { name: /Kiểm tra/ })).toContainText("Xóa");

    // The check alone changes nothing; "Chọn file khác" goes back to step one.
    await expect(dialog.getByRole("cell", { name: "Kiểm tra", exact: true })).toHaveCount(1);
    await expect(dialog.getByRole("cell", { name: "Đánh bóng", exact: true })).toHaveCount(0);
    await preview.getByRole("button", { name: "Chọn file khác" }).click();
    await expect(preview.getByRole("button", { name: /Kiểm tra file$/ })).toBeDisabled();

    await checkFile(page, file);
    await preview.getByRole("button", { name: /Nhập 3 dòng$/ }).click();
    await expect(preview).toContainText("Nhập thành công");
    await expect(preview).toContainText("Đã nhập 3 công đoạn. Bấm Lưu để lưu lại.");
    await preview.locator(".bd-modal-foot").getByRole("button", { name: "Đóng" }).click();
    await expect(preview).toBeHidden();
    await expect(dialog.getByRole("cell", { name: "Kiểm tra", exact: true })).toHaveCount(0);
    const polish = dialog.getByRole("row", { name: /Đánh bóng/ });
    await expect(polish.locator(".ant-segmented-item-selected")).toHaveText("VNĐ");
    await expect(polish.getByLabel("Giá trị công đoạn Đánh bóng")).toHaveValue("100.000");
    await expect(polish.getByRole("button", { name: /Tính lương cho phòng MKT/ })).toHaveAttribute("aria-pressed", "true");

    // Nothing is stored until the dialog's own Lưu.
    expect((await readService(page, service.id)).stages.map((s) => s.name)).toEqual(["Lấy dấu", "Gắn sứ", "Kiểm tra"]);

    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(dialog).toBeHidden();

    const saved = (await readService(page, service.id)).stages;
    expect(saved.map((s) => [s.name, s.valueType, s.value, s.isMarketingSalary])).toEqual([
      ["Lấy dấu", PERCENT, 40, false],
      ["Đánh bóng", AMOUNT, 100000, true],
      ["gắn SỨ", AMOUNT, 300000, false],
    ]);
    // Matched by name, so the two old stages are the same rows, updated.
    expect(saved[0].id).toBe(impression.id);
    expect(saved[2].id).toBe(crown.id);
    expect([impression.id, crown.id]).not.toContain(saved[1].id);

  });

  test("one bad row rejects the whole file and leaves the table alone", async ({ page }) => {
    const service = await seedService(page, "DV CD LOI", [
      { name: "Lấy dấu", value: 30, valueType: PERCENT, isMarketingSalary: false },
    ]);
    const dialog = await openStagesTab(page, service);
    await dialog.getByRole("button", { name: /Nhập$/ }).click();
    const preview = importDialog(page);

    // "Tải file mẫu" is the export's header with no rows.
    const [template] = await Promise.all([
      page.waitForEvent("download"),
      preview.getByRole("button", { name: /Tải file mẫu$/ }).click(),
    ]);
    expect(await downloadedRows(template)).toEqual([HEADER]);

    await checkFile(page, [
      ["Mới một", "%", 20, ""],
      ["", "%", 10, ""],
      ["Mới ba", "USD", 10, ""],
      ["Mới bốn", "%", 120, ""],
      ["Mới năm", "VNĐ", -5, ""],
      ["Mới sáu", "%", 10, "khác"],
      ["Mới bảy", "", 10, ""],
      ["Mới tám", "VNĐ", "", ""],
    ]);
    await expect(preview).toContainText("8 dòng: 1 thêm mới, 0 cập nhật, 0 giữ nguyên, 7 lỗi");
    await expect(preview).toContainText("File có lỗi. Sửa các dòng lỗi rồi chọn lại file");
    await expect(previewRow(page, 2)).toContainText("Thêm mới");
    // Every bad row is listed with its reason, the required cells one by one.
    const reasons: [number, string][] = [
      [3, 'Thiếu "Tên công đoạn"'],
      [4, '"Loại" chỉ nhận % hoặc VNĐ'],
      [5, '"Giá trị" theo % không được quá 100'],
      [6, '"Giá trị" phải là số nguyên từ 0 trở lên'],
      [7, '"Tính lương cho phòng MKT" chỉ nhận Có, Không hoặc để trống'],
      [8, 'Thiếu "Loại"'],
      [9, 'Thiếu "Giá trị"'],
    ];
    for (const [row, reason] of reasons) {
      await expect(previewRow(page, row)).toContainText(reason);
      await expect(previewRow(page, row)).toContainText("Lỗi");
    }
    // One bad row blocks the whole file.
    await expect(preview.getByRole("button", { name: /Nhập 0 dòng$/ })).toBeDisabled();

    await preview.getByRole("checkbox", { name: "Chỉ hiện dòng lỗi" }).check();
    await expect(previewRow(page, 2)).toHaveCount(0);
    await expect(previewRow(page, 9)).toHaveCount(1);

    // "Tải file lỗi": the file as sent, each row with its reasons in a "Lỗi" column.
    const [errors] = await Promise.all([
      page.waitForEvent("download"),
      preview.getByRole("button", { name: /Tải file lỗi$/ }).click(),
    ]);
    expect(errors.suggestedFilename()).toMatch(/-loi\.xlsx$/);
    const errorRows = await downloadedRows(errors);
    expect(errorRows[0]).toEqual([...HEADER, "Lỗi"]);
    expect(errorRows).toHaveLength(9);
    expect(errorRows[2]).toEqual(["", "%", "10", "", 'Thiếu "Tên công đoạn"']);

    await expect(dialog.getByRole("cell", { name: "Lấy dấu", exact: true })).toHaveCount(1);
    await expect(dialog.getByRole("cell", { name: "Mới một", exact: true })).toHaveCount(0);

    // A file without a required column is refused before any row is read.
    await preview.getByRole("button", { name: "Chọn file khác" }).click();
    await checkFile(page, [["Mới", "%"]], ["Tên công đoạn *", "Loại *"]);
    await expect(preview).toContainText('File thiếu cột "Giá trị *". Hãy dùng "Tải file mẫu" để đúng cột.');
    await expect(preview.getByRole("button", { name: /Nhập 0 dòng$/ })).toBeDisabled();

    // A file with no stage rows is refused too.
    await preview.getByRole("button", { name: "Chọn file khác" }).click();
    await checkFile(page, []);
    await expect(preview).toContainText("File không có công đoạn nào.");
    await expect(preview.getByRole("button", { name: /Nhập 0 dòng$/ })).toBeDisabled();
    await expect(dialog.getByRole("cell", { name: "Lấy dấu", exact: true })).toHaveCount(1);
  });

  test("a stage a patient's công đoạn ticked cannot be dropped; an unused one can", async ({ page }) => {
    const service = await seedService(page, "DV CD DANG DUNG", [
      { name: "Lấy dấu", value: 30, valueType: PERCENT, isMarketingSalary: false },
      { name: "Gắn sứ", value: 70, valueType: PERCENT, isMarketingSalary: false },
      { name: "Thừa", value: 0, valueType: PERCENT, isMarketingSalary: false },
    ]);
    const [impression, crown, spare] = service.stages;
    await tickStageOnPatient(page, service.id, impression.id);

    // ── API: dropping the ticked stage is refused, by name ───────────────────
    const refused = await saveStages(page, service, [crown, spare]);
    expect(refused.status).toBe(403);
    expect(refused.body.error?.code).toBe(STAGE_IN_USE);
    expect(refused.body.error?.message).toBe(
      "Công đoạn đã được dùng trên phiếu điều trị của bệnh nhân, không thể xóa: Lấy dấu",
    );
    // Renaming it in a file is a drop + a new stage, so that is refused too.
    const renamed = await saveStages(page, service, [{ ...impression, id: undefined, name: "Lấy dấu mới" }, crown, spare]);
    expect(renamed.body.error?.code).toBe(STAGE_IN_USE);
    expect((await readService(page, service.id)).stages.map((s) => s.id)).toEqual([impression.id, crown.id, spare.id]);

    // Editing the ticked stage in place (same id) is fine.
    const edited = await saveStages(page, service, [{ ...impression, value: 40 }, crown, spare]);
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);

    // ── UI: the bin icon + Lưu shows the refusal; the unused one goes ────────
    const dialog = await openStagesTab(page, service);
    await dialog.getByRole("button", { name: "Xoá công đoạn Lấy dấu" }).click();
    await dialog.getByRole("button", { name: /Lưu$/ }).click();
    await expect(
      page.getByText("Công đoạn đã được dùng trên phiếu điều trị của bệnh nhân, không thể xóa: Lấy dấu"),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    expect((await readService(page, service.id)).stages.map((s) => s.name)).toEqual(["Lấy dấu", "Gắn sứ", "Thừa"]);

    await page.reload();
    const fresh = await openStagesTab(page, service);
    await fresh.getByRole("button", { name: "Xoá công đoạn Thừa" }).click();
    await fresh.getByRole("button", { name: /Lưu$/ }).click();
    await expect(fresh).toBeHidden();
    const kept = (await readService(page, service.id)).stages;
    expect(kept.map((s) => s.id)).toEqual([impression.id, crown.id]);
    expect(kept[0].value).toBe(40);
  });
});
