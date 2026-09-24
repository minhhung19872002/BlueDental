import { expect, test, type Browser, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";

/**
 * Feature: Danh mục → Nhập từ Excel — the rules the API keeps on its own
 * (docs/clone/api.md, Catalog import). BlueDental's own feature; the
 * reference has no import.
 *
 * Every call is a real HTTP request from inside the logged-in page, with the
 * cookie the real login left and the antiforgery token the server set. The
 * workbooks are built here with SheetJS and posted as real multipart uploads.
 * Nothing is intercepted, no token is injected, the database is the real one.
 */

const ENTRIES = "/api/v1/app/catalog-entries";
const TAXONOMIES = "/api/v1/app/taxonomies";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

interface RowResult {
  row: number;
  values: (string | null)[];
  action: number; // 0 Create, 1 Skip, 2 Restore, 3 Line, 4 Error, 5 Update
  errors: string[];
}

interface ImportResult {
  dryRun: boolean;
  committed: boolean;
  fileErrors: string[];
  totalRows: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  restoreCount: number;
  errorCount: number;
  newGroups: string[];
  sheets: { name: string; columns: string[]; rows: RowResult[] }[];
}

interface Entry {
  id: string;
  name: string;
  taxonomyId: string;
  taxonomyName?: string;
  sortOrder: number;
  isDeleted: boolean;
  content?: string | null;
  price?: number | null;
  unit?: string | null;
  medicine?: { purchasePrice: number; activeIngredient?: string | null } | null;
  prescriptionLines: { medicineEntryId: string; timesPerDay: number; days: number; usage: number }[];
}

interface ApiResult<T> {
  status: number;
  body: T & { error?: { code?: string; message?: string }; items?: Entry[] };
}

interface Upload {
  group: string;
  base64: string;
  dryRun?: boolean;
  clinicBranchId?: string;
  fileName?: string;
  mime?: string;
}

/** One multipart POST from the logged-in page: cookie session + antiforgery header. */
async function postImport(
  page: Page,
  upload: Upload,
  path = "import",
  branchHeader?: string,
): Promise<ApiResult<ImportResult>> {
  return page.evaluate(
    async ({ upload, url, branchHeader }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json, text/plain, */*",
        "accept-language": "vi",
        ...(branchHeader ? { "X-Clinic-Branch-Id": branchHeader } : {}),
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      const bytes = Uint8Array.from(atob(upload.base64), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append(
        "file",
        new Blob([bytes], {
          type:
            upload.mime ??
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        upload.fileName ?? "import.xlsx",
      );
      form.append("group", upload.group);
      form.append("dryRun", upload.dryRun ? "true" : "false");
      if (upload.clinicBranchId) form.append("clinicBranchId", upload.clinicBranchId);
      const res = await fetch(url, { method: "POST", credentials: "include", headers, body: form });
      const text = await res.text();
      let body: unknown = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
      return { status: res.status, body: body as ApiResult<ImportResult>["body"] };
    },
    { upload, url: `${ENTRIES}/${path}`, branchHeader },
  );
}

/** GET as JSON from the logged-in page. */
async function getJson<T>(page: Page, url: string): Promise<ApiResult<T>> {
  return page.evaluate(async (target) => {
    const res = await fetch(target, {
      credentials: "include",
      headers: { accept: "application/json, text/plain, */*", "accept-language": "vi" },
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }, url);
}

/** GET as a file: status, headers and the first bytes, without downloading through the UI. */
async function getFile(page: Page, url: string) {
  return page.evaluate(async (target) => {
    // The same Accept axios sends: it decides whether ABP answers a refusal as JSON.
    const res = await fetch(target, {
      credentials: "include",
      headers: { accept: "application/json, text/plain, */*", "accept-language": "vi" },
    });
    const buffer = new Uint8Array(await res.arrayBuffer());
    return {
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      disposition: res.headers.get("content-disposition") ?? "",
      magic: String.fromCharCode(...buffer.slice(0, 2)),
      size: buffer.length,
    };
  }, url);
}

async function listEntries(page: Page, group: string, filter: string): Promise<Entry[]> {
  const res = await getJson<{ items: Entry[] }>(
    page,
    `${ENTRIES}?group=${group}&clinicBranchId=${BRANCH_ONE}&filter=${encodeURIComponent(filter)}&maxResultCount=100`,
  );
  expect(res.status).toBe(200);
  return res.body.items ?? [];
}

async function listGroups(page: Page, group: string, filter: string): Promise<{ id: string; name: string }[]> {
  const res = await getJson<{ items: { id: string; name: string }[] }>(
    page,
    `${TAXONOMIES}?group=${group}&clinicBranchId=${BRANCH_ONE}&filter=${encodeURIComponent(filter)}&maxResultCount=100`,
  );
  expect(res.status).toBe(200);
  return res.body.items ?? [];
}

/** A workbook with one sheet per entry, rows given as arrays (header first). */
function workbook(sheets: { name: string; rows: (string | number | null)[][] }[]): string {
  const book = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  }
  return XLSX.write(book, { type: "base64", bookType: "xlsx" });
}

const SOURCE_HEADER = ["Nhóm phân loại *", "Tên nguồn đến *", "Mức độ ưu tiên"];

async function reset(page: Page) {
  await login(page);
  await page.goto("/taxonomy/source");
  await assertRealApiTraffic(page, "/api/v1/app/taxonomies");
}

test.describe("Danh mục — nhập từ Excel (API)", () => {
  test("hands out an .xlsx template per catalog and refuses the ones left out", async ({ page }) => {
    await reset(page);

    const template = await getFile(page, `${ENTRIES}/import-template?group=care_service`);
    expect(template.status).toBe(200);
    expect(template.contentType).toContain("spreadsheetml");
    expect(template.disposition).toMatch(/filename/);
    expect(template.magic).toBe("PK");
    expect(template.size).toBeGreaterThan(1000);

    // Bệnh án mẫu is deferred by the owner: no template, no import.
    const refused = await getJson<{ error?: { code?: string } }>(
      page,
      `${ENTRIES}/import-template?group=medical_record_template`,
    );
    expect(refused.status).not.toBe(200);
    expect(refused.body.error?.code).toBe("BlueDental:Catalogs:0024");
  });

  test("dry run reports the plan and writes nothing; the real run creates group and rows", async ({ page }) => {
    await reset(page);
    const id = runId();
    const groupName = `Nhóm nhập ${id}`;
    const nameA = `Nguồn A ${id}`;
    const nameB = `Nguồn B ${id}`;
    const file = workbook([
      {
        name: "Nguồn đến",
        rows: [SOURCE_HEADER, [groupName, nameA, null], [groupName, nameB, null]],
      },
    ]);

    const dry = await postImport(page, { group: "source", base64: file, dryRun: true });
    expect(dry.status).toBe(200);
    expect(dry.body.dryRun).toBe(true);
    expect(dry.body.committed).toBe(false);
    expect(dry.body.errorCount).toBe(0);
    expect(dry.body.createCount).toBe(2);
    expect(dry.body.newGroups).toEqual([groupName]);
    expect(dry.body.sheets[0].rows.map((r) => r.action)).toEqual([0, 0]);

    // Nothing landed: neither the group nor the rows.
    expect(await listGroups(page, "source", groupName)).toHaveLength(0);
    expect(await listEntries(page, "source", id)).toHaveLength(0);

    const real = await postImport(page, { group: "source", base64: file });
    expect(real.status).toBe(200);
    expect(real.body.committed).toBe(true);
    expect(real.body.createCount).toBe(2);

    const groups = await listGroups(page, "source", groupName);
    expect(groups.map((g) => g.name)).toEqual([groupName]);

    const rows = await listEntries(page, "source", id);
    expect(rows.map((r) => r.name).sort()).toEqual([nameA, nameB].sort());
    expect(rows.every((r) => r.taxonomyId === groups[0].id)).toBe(true);
    // Blank priority → the file's row order.
    const a = rows.find((r) => r.name === nameA)!;
    const b = rows.find((r) => r.name === nameB)!;
    expect(a.sortOrder).toBeLessThan(b.sortOrder);

    // Same file again: every row is already there, so it is skipped and nothing doubles.
    const again = await postImport(page, { group: "source", base64: file });
    expect(again.status).toBe(200);
    expect(again.body.createCount).toBe(0);
    expect(again.body.skipCount).toBe(2);
    expect(again.body.sheets[0].rows.map((r) => r.action)).toEqual([1, 1]);
    expect(again.body.updateCount).toBe(0);
    expect(await listEntries(page, "source", id)).toHaveLength(2);
    expect(await listGroups(page, "source", groupName)).toHaveLength(1);

    // A row that exists but differs in another column is updated in place;
    // the one that does not differ is still skipped. Nothing doubles either way.
    const changed = workbook([
      {
        name: "Nguồn đến",
        rows: [SOURCE_HEADER, [groupName, nameA, 42], [groupName, nameB, null]],
      },
    ]);
    const dryUpdate = await postImport(page, { group: "source", base64: changed, dryRun: true });
    expect(dryUpdate.body.updateCount).toBe(1);
    expect(dryUpdate.body.skipCount).toBe(1);
    expect(dryUpdate.body.sheets[0].rows.map((r) => r.action)).toEqual([5, 1]);
    expect((await listEntries(page, "source", nameA))[0].sortOrder).toBe(a.sortOrder);

    const updated = await postImport(page, { group: "source", base64: changed });
    expect(updated.status).toBe(200);
    expect(updated.body.committed).toBe(true);
    expect(updated.body.createCount).toBe(0);
    expect(updated.body.updateCount).toBe(1);
    expect(updated.body.skipCount).toBe(1);

    const afterUpdate = await listEntries(page, "source", id);
    expect(afterUpdate).toHaveLength(2);
    const a2 = afterUpdate.find((r) => r.name === nameA)!;
    const b2 = afterUpdate.find((r) => r.name === nameB)!;
    expect(a2.id).toBe(a.id);
    expect(a2.sortOrder).toBe(42);
    expect(b2.sortOrder).toBe(b.sortOrder);
  });

  test("a soft-deleted twin is restored, not duplicated", async ({ page }) => {
    await reset(page);
    const id = runId();
    const groupName = `Nhóm khôi phục ${id}`;
    const name = `Nguồn xoá ${id}`;
    const file = workbook([{ name: "Nguồn đến", rows: [SOURCE_HEADER, [groupName, name, 5]] }]);

    const first = await postImport(page, { group: "source", base64: file });
    expect(first.body.createCount).toBe(1);
    const [created] = await listEntries(page, "source", name);
    expect(created.sortOrder).toBe(5);

    // The tab's own delete is a soft delete: the row stays listed, flagged.
    const deleted = await page.evaluate(async ({ url }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {},
      });
      return res.status;
    }, { url: `${ENTRIES}/${created.id}` });
    expect(deleted).toBeLessThan(300);
    expect((await listEntries(page, "source", name))[0].isDeleted).toBe(true);

    const restored = await postImport(page, { group: "source", base64: file });
    expect(restored.status).toBe(200);
    expect(restored.body.restoreCount).toBe(1);
    expect(restored.body.createCount).toBe(0);
    expect(restored.body.sheets[0].rows[0].action).toBe(2);

    const after = await listEntries(page, "source", name);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(created.id);
    expect(after[0].isDeleted).toBe(false);

    // A restore takes the file's values: the priority moves with it.
    const moved = workbook([{ name: "Nguồn đến", rows: [SOURCE_HEADER, [groupName, name, 7]] }]);
    await page.evaluate(async ({ url }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {},
      });
    }, { url: `${ENTRIES}/${created.id}` });
    const restoredMoved = await postImport(page, { group: "source", base64: moved });
    expect(restoredMoved.body.restoreCount).toBe(1);
    expect(restoredMoved.body.updateCount).toBe(0);
    const [again] = await listEntries(page, "source", name);
    expect(again.id).toBe(created.id);
    expect(again.isDeleted).toBe(false);
    expect(again.sortOrder).toBe(7);
  });

  test("one bad row rejects the whole file, named by row, and nothing is saved", async ({ page }) => {
    await reset(page);
    const id = runId();
    const groupName = `Nhóm lỗi ${id}`;
    const dup = `Nguồn trùng ${id}`;
    const file = workbook([
      {
        name: "Nguồn đến",
        rows: [
          SOURCE_HEADER,
          [groupName, `Nguồn ok ${id}`, null],
          [groupName, dup, null],
          [groupName, dup, null],
          [groupName, null, "abc"],
        ],
      },
    ]);

    const res = await postImport(page, { group: "source", base64: file });
    expect(res.status).toBe(200);
    expect(res.body.committed).toBe(false);
    expect(res.body.errorCount).toBe(2);
    const rows = res.body.sheets[0].rows;
    expect(rows.map((r) => r.row)).toEqual([2, 3, 4, 5]);
    expect(rows.map((r) => r.action)).toEqual([0, 0, 4, 4]);
    expect(rows[2].errors.join(" ")).toContain("dòng 3");
    expect(rows[3].errors.join(" ")).toContain("Tên nguồn đến");
    expect(rows[3].errors.join(" ")).toContain("Mức độ ưu tiên");

    expect(await listEntries(page, "source", id)).toHaveLength(0);
    expect(await listGroups(page, "source", groupName)).toHaveLength(0);

    // The error file is the same rows with a "Lỗi" column appended.
    const errorFile = await page.evaluate(
      async ({ url, base64 }) => {
        const xsrf = document.cookie
          .split("; ")
          .find((c) => c.startsWith("XSRF-TOKEN="))
          ?.substring("XSRF-TOKEN=".length);
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const form = new FormData();
        form.append("file", new Blob([bytes]), "loi.xlsx");
        form.append("group", "source");
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: {
            accept: "application/json, text/plain, */*",
            "accept-language": "vi",
            ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
          },
          body: form,
        });
        const buffer = new Uint8Array(await res.arrayBuffer());
        let binary = "";
        for (const b of buffer) binary += String.fromCharCode(b);
        return { status: res.status, type: res.headers.get("content-type") ?? "", base64: btoa(binary) };
      },
      { url: `${ENTRIES}/import-errors`, base64: file },
    );
    expect(errorFile.status).toBe(200);
    expect(errorFile.type).toContain("spreadsheetml");
    const book = XLSX.read(errorFile.base64, { type: "base64" });
    const sheet = XLSX.utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]], { header: 1 });
    expect(sheet[0][3]).toBe("Lỗi");
    expect(sheet[3][3]).toContain("dòng 3");
    expect(sheet[1][3] ?? "").toBe("");
  });

  test("a file without the required column, or not an .xlsx at all, is refused", async ({ page }) => {
    await reset(page);
    const wrongHeader = workbook([
      { name: "Nguồn đến", rows: [["Nhóm phân loại", "Tên", "Mức độ ưu tiên"], ["N", "X", null]] },
    ]);
    const res = await postImport(page, { group: "source", base64: wrongHeader });
    expect(res.status).toBe(200);
    expect(res.body.committed).toBe(false);
    expect(res.body.fileErrors).toHaveLength(1);
    expect(res.body.fileErrors[0]).toContain("Tên nguồn đến");
    expect(res.body.errorCount).toBe(1);

    const notExcel = await postImport(page, {
      group: "source",
      base64: btoa("id,name\n1,x"),
      fileName: "x.csv",
      mime: "text/csv",
    });
    expect(notExcel.status).not.toBe(200);
    expect(notExcel.body.error?.code).toBe("BlueDental:Catalogs:0023");
  });

  test("diagnosis content keeps its paragraphs; medicine money accepts VN formatting", async ({ page }) => {
    await reset(page);
    const id = runId();
    const dx = `Chẩn đoán ${id}`;
    const diagnosis = workbook([
      {
        name: "Chẩn đoán",
        rows: [
          ["Nhóm phân loại", "Tên chẩn đoán", "Nội dung", "Ghi chú", "Mức độ ưu tiên"],
          [`Nhóm CĐ ${id}`, dx, "Dòng một\nDòng hai", "ghi chú", null],
        ],
      },
    ]);
    const dxRes = await postImport(page, { group: "diagnosis", base64: diagnosis });
    expect(dxRes.body.committed).toBe(true);
    const [dxRow] = await listEntries(page, "diagnosis", dx);
    expect(dxRow.content).toBe("<p>Dòng một</p><p>Dòng hai</p>");

    const med = `Thuốc ${id}`;
    const medicine = workbook([
      {
        name: "Loại thuốc",
        rows: [
          ["Nhóm phân loại", "Tên thuốc", "Hoạt chất", "Giá mua", "Giá bán", "Đơn vị tính"],
          [`Nhóm thuốc ${id}`, med, "Paracetamol", "1.000.000 đ", 1500000, "Viên"],
          [`Nhóm thuốc ${id}`, `${med} lỗi`, null, "-5", null, null],
        ],
      },
    ]);
    const bad = await postImport(page, { group: "medication_type", base64: medicine });
    expect(bad.body.committed).toBe(false);
    expect(bad.body.sheets[0].rows[1].errors.join(" ")).toContain("Giá mua");

    const fixed = workbook([
      {
        name: "Loại thuốc",
        rows: [
          ["Nhóm phân loại", "Tên thuốc", "Hoạt chất", "Giá mua", "Giá bán", "Đơn vị tính"],
          [`Nhóm thuốc ${id}`, med, "Paracetamol", "1.000.000 đ", 1500000, "Viên"],
        ],
      },
    ]);
    const ok = await postImport(page, { group: "medication_type", base64: fixed });
    expect(ok.body.committed).toBe(true);
    const [medRow] = await listEntries(page, "medication_type", med);
    expect(medRow.price).toBe(1500000);
    expect(medRow.unit).toBe("Viên");
    expect(medRow.medicine?.purchasePrice).toBe(1000000);
    expect(medRow.medicine?.activeIngredient).toBe("Paracetamol");

    // Re-imported with a new price and unit: an update. The blank cells keep
    // what is stored — a blank never clears a value on an existing row.
    const repriced = workbook([
      {
        name: "Loại thuốc",
        rows: [
          ["Nhóm phân loại", "Tên thuốc", "Hoạt chất", "Giá mua", "Giá bán", "Đơn vị tính"],
          [`Nhóm thuốc ${id}`, med, null, null, "1.600.000", "Hộp"],
        ],
      },
    ]);
    const upd = await postImport(page, { group: "medication_type", base64: repriced });
    expect(upd.body.committed).toBe(true);
    expect(upd.body.updateCount).toBe(1);
    expect(upd.body.sheets[0].rows[0].action).toBe(5);
    const [medAfter] = await listEntries(page, "medication_type", med);
    expect(medAfter.id).toBe(medRow.id);
    expect(medAfter.price).toBe(1600000);
    expect(medAfter.unit).toBe("Hộp");
    expect(medAfter.medicine?.purchasePrice).toBe(1000000);
    expect(medAfter.medicine?.activeIngredient).toBe("Paracetamol");

    // The very same file once more changes nothing: skipped.
    const same = await postImport(page, { group: "medication_type", base64: repriced });
    expect(same.body.updateCount).toBe(0);
    expect(same.body.skipCount).toBe(1);
  });

  test("prescription templates take their lines from the second sheet, by medicine name", async ({ page }) => {
    await reset(page);
    const id = runId();
    const med = `Thuốc đơn ${id}`;
    await postImport(page, {
      group: "medication_type",
      base64: workbook([
        { name: "Loại thuốc", rows: [["Nhóm phân loại", "Tên thuốc"], [`Nhóm thuốc ${id}`, med]] },
      ]),
    });
    const [medicine] = await listEntries(page, "medication_type", med);

    const template = `Đơn mẫu ${id}`;
    const linesHeader = [
      "Tên đơn thuốc mẫu",
      "Tên thuốc",
      "Số lần/ngày",
      "Liều/lần",
      "Số ngày",
      "Cách dùng",
      "Cách dùng khác",
    ];
    const withUnknown = workbook([
      { name: "Đơn thuốc mẫu", rows: [["Tên đơn thuốc mẫu", "Lời dặn"], [template, "Uống đủ nước"]] },
      {
        name: "Thuốc",
        rows: [
          linesHeader,
          [template, med, 2, 1, 5, "Sau khi ăn; Trước khi ngủ", null],
          [template, `Không có ${id}`, 1, 1, 1, null, null],
          [`Đơn khác ${id}`, med, 1, 1, 1, "Khác", null],
        ],
      },
    ]);
    const bad = await postImport(page, { group: "prescription_template", base64: withUnknown });
    expect(bad.status).toBe(200);
    expect(bad.body.committed).toBe(false);
    const lines = bad.body.sheets[1].rows;
    expect(lines.map((r) => r.action)).toEqual([3, 4, 4]);
    expect(lines[1].errors.join(" ")).toContain("Không tìm thấy thuốc");
    expect(lines[2].errors.join(" ")).toContain("Không tìm thấy đơn thuốc mẫu");
    expect(await listEntries(page, "prescription_template", template)).toHaveLength(0);

    const good = workbook([
      { name: "Đơn thuốc mẫu", rows: [["Tên đơn thuốc mẫu", "Lời dặn"], [template, "Uống đủ nước"]] },
      { name: "Thuốc", rows: [linesHeader, [template, med, 2, 1, 5, "Sau khi ăn; Trước khi ngủ", null]] },
    ]);
    const ok = await postImport(page, { group: "prescription_template", base64: good });
    expect(ok.body.committed).toBe(true);
    expect(ok.body.createCount).toBe(1);

    const [saved] = await listEntries(page, "prescription_template", template);
    expect(saved.prescriptionLines).toHaveLength(1);
    expect(saved.prescriptionLines[0].medicineEntryId).toBe(medicine.id);
    expect(saved.prescriptionLines[0].timesPerDay).toBe(2);
    expect(saved.prescriptionLines[0].days).toBe(5);
    expect(saved.prescriptionLines[0].usage).toBe(1 + 16);

    // The template exists; only a line differs (7 days) → the template is
    // updated and its lines replaced by the file's.
    const longer = workbook([
      { name: "Đơn thuốc mẫu", rows: [["Tên đơn thuốc mẫu", "Lời dặn"], [template, "Uống đủ nước"]] },
      { name: "Thuốc", rows: [linesHeader, [template, med, 2, 1, 7, "Sau khi ăn; Trước khi ngủ", null]] },
    ]);
    const upd = await postImport(page, { group: "prescription_template", base64: longer });
    expect(upd.body.committed).toBe(true);
    expect(upd.body.updateCount).toBe(1);
    expect(upd.body.sheets[0].rows[0].action).toBe(5);
    expect(upd.body.sheets[1].rows[0].action).toBe(3);
    const [after] = await listEntries(page, "prescription_template", template);
    expect(after.id).toBe(saved.id);
    expect(after.prescriptionLines).toHaveLength(1);
    expect(after.prescriptionLines[0].days).toBe(7);

    // Same lines again: nothing differs, skipped.
    const same = await postImport(page, { group: "prescription_template", base64: longer });
    expect(same.body.skipCount).toBe(1);
    expect(same.body.updateCount).toBe(0);
  });

  test("a branch-scoped account cannot import into another branch", async ({ page }) => {
    await login(page, BRANCH2_USER);
    await page.goto("/taxonomy/source");
    const file = workbook([{ name: "Nguồn đến", rows: [SOURCE_HEADER, ["N", `X ${runId()}`, null]] }]);

    const res = await postImport(page, { group: "source", base64: file, clinicBranchId: BRANCH_ONE });
    expect(res.status).toBe(403);
    expect(res.body.committed).toBeUndefined();
  });

  test("an account without the tab's create right gets 403, whatever the file", async ({ page, browser }) => {
    await login(page);
    const id = runId();
    const userName = `imp${id}`;
    const password = "Import@123456";
    const fullName = `Nhập liệu ${id}`;

    // A staff member on the seeded `dentist` role, which carries no grants.
    await page.goto("/staff");
    await assertRealApiTraffic(page, "/api/v1/app/staff");
    await page.getByRole("button", { name: /Tạo/ }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Họ và tên/).fill(fullName);
    await dialog.getByLabel(/Email/).fill(`${userName}@bluedental.local`);
    await dialog.getByLabel(/^Mật khẩu/).fill(password);
    await dialog.getByLabel(/Nhập lại mật khẩu/).fill(password);
    await dialog.getByLabel(/Nhóm quyền/).click();
    await page.locator('.ant-select-item-option[title="dentist"]').click();
    await dialog.getByLabel(/Chi nhánh/).click();
    await page.locator('.ant-select-item-option[title="Nha Khoa Đức Hạnh Premium"]').click();
    await dialog.getByLabel(/Họ và tên/).click();
    await dialog.getByRole("button", { name: /Lưu/ }).click();
    await expect(dialog).toBeHidden();

    const other = await openSession(browser, userName, password);
    try {
      const file = workbook([{ name: "Nguồn đến", rows: [SOURCE_HEADER, ["N", `X ${id}`, null]] }]);
      const res = await postImport(other.page, { group: "source", base64: file, dryRun: true });
      expect(res.status).toBe(403);
      const template = await getFile(other.page, `${ENTRIES}/import-template?group=source`);
      expect(template.status).toBe(403);
    } finally {
      await other.context.close();
      await page.goto("/staff");
      const row = page.getByRole("row").filter({ hasText: fullName });
      await expect(row).toBeVisible();
      await row.getByRole("button").nth(1).click();
      const confirm = page.getByRole("dialog").filter({ hasText: "Xác nhận xoá" });
      await confirm.getByRole("button", { name: /Xoá$/ }).click();
      await expect(row).toHaveCount(0);
    }
  });
});

async function openSession(browser: Browser, userName: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password });
  return { context, page };
}
