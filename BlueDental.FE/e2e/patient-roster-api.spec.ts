import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { login, runId } from "./fixtures/auth";
import { createDentist, deleteDentist, openDentistSession } from "./fixtures/restrictedDentist";

/**
 * Feature: xuất / nhập danh sách bệnh nhân (F-69). Every check is a real HTTP
 * call from inside the logged-in page — cookie session, antiforgery header,
 * real database, nothing intercepted. The rows are synthetic patients this
 * spec creates and deletes itself.
 */

const API = "/api/v1/app/patient-roster";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_ONE_NAME = "Nha Khoa Đức Hạnh Premium";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const enum RowAction {
  Create = 0,
  Update = 1,
  Error = 2,
  Delete = 3,
}

interface RosterResult {
  dryRun: boolean;
  committed: boolean;
  totalRows: number;
  errorCount: number;
  created: number;
  updated: number;
  deleted: number;
  unmarked: number;
  fileErrors: string[];
  rows: { row: number; patientCode: string | null; fullName: string | null; action: RowAction; errors: string[] }[];
}

interface ApiResult<T> {
  status: number;
  body: T;
  base64: string;
  contentType: string;
}

interface PatientRow {
  id: string;
  patientCode: string;
  fullName: string;
}

interface Patient extends PatientRow {
  email: string | null;
  note: string | null;
  dateOfBirth: string | null;
  phoneNumber: string | null;
}

type Cell = string | number | null;

/** One request from the logged-in page; a binary reply comes back as base64. */
async function call<T>(
  page: Page,
  method: "GET" | "POST",
  url: string,
  upload?: { base64: string; dryRun: boolean },
): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ method, url, upload, mime, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json, text/plain, */*",
        "accept-language": "vi",
        "X-Clinic-Branch-Id": branch,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      let body: FormData | undefined;
      if (upload) {
        const bytes = Uint8Array.from(atob(upload.base64), (c) => c.charCodeAt(0));
        body = new FormData();
        body.append("file", new Blob([bytes], { type: mime }), "danh-sach-benh-nhan.xlsx");
        body.append("dryRun", upload.dryRun ? "true" : "false");
      }
      const res = await fetch(url, { method, credentials: "include", headers, body });
      const buffer = new Uint8Array(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("json");
      let parsed: unknown = {};
      if (isJson) {
        try {
          parsed = JSON.parse(new TextDecoder().decode(buffer));
        } catch {
          parsed = {};
        }
      }
      let binary = "";
      if (!isJson) buffer.forEach((b) => (binary += String.fromCharCode(b)));
      return { status: res.status, body: parsed as never, base64: btoa(binary), contentType };
    },
    { method, url, upload, mime: XLSX_MIME, branch: BRANCH_ONE },
  );
}

const importFile = (page: Page, base64: string, dryRun: boolean) =>
  call<RosterResult>(page, "POST", `${API}/import`, { base64, dryRun });

function readRows(base64: string): Cell[][] {
  const book = XLSX.read(base64, { type: "base64" });
  return XLSX.utils.sheet_to_json<Cell[]>(book.Sheets[book.SheetNames[0]], { header: 1, defval: null, raw: false });
}

/** The exported header row, with rows keyed by header text (the " *" of required columns ignored). */
function sheetOf(header: Cell[], rows: Record<string, Cell>[]): string {
  const names = header.map((cell) => String(cell ?? "").replace(/\s*\*$/, ""));
  const body = rows.map((row) => names.map((name) => row[name] ?? null));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([header, ...body]), "Bệnh nhân");
  return XLSX.write(book, { type: "base64", bookType: "xlsx" });
}

async function findPatient(page: Page, name: string): Promise<PatientRow | undefined> {
  const res = await call<{ items: PatientRow[] }>(
    page,
    "GET",
    `/api/v1/app/patients?filter=${encodeURIComponent(name)}&maxResultCount=10`,
  );
  expect(res.status).toBe(200);
  return res.body.items.find((item) => item.fullName === name);
}

test.describe.configure({ mode: "serial" });

test.describe("F-69 patient roster — real HTTP", () => {
  const run = runId();
  const name = `E2E Roster ${run}`;
  const phone = `09${run.padStart(8, "0")}`;
  const otherPhone = `07${run.padStart(8, "0")}`;
  const nationalId = `0${run.padStart(11, "0")}`;
  let header: Cell[] = [];
  let code = "";

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("export: every patient on one sheet, Action left blank", async ({ page }) => {
    const res = await call<never>(page, "GET", `${API}/export`);
    expect(res.status).toBe(200);
    expect(res.contentType).toContain("spreadsheetml");

    const rows = readRows(res.base64);
    header = rows[0];
    expect(header).toEqual(expect.arrayContaining(["Họ và tên *", "Số điện thoại *", "Chi nhánh *", "Mã khách hàng", "Action"]));
    const action = header.indexOf("Action");
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.slice(1).every((row) => !row[action])).toBe(true);
  });

  test("the file exported as it is changes nothing", async ({ page }) => {
    const exported = await call<never>(page, "GET", `${API}/export`);
    const res = await importFile(page, exported.base64, true);
    expect(res.status).toBe(200);
    expect(res.body.committed).toBe(false);
    expect(res.body.created + res.body.updated + res.body.deleted).toBe(0);
    expect(res.body.fileErrors.join(" ")).toMatch(/Action/);
  });

  test("E with no code adds a patient with a fresh DH code", async ({ page }) => {
    const file = sheetOf(header, [
      { "Họ và tên": name, "Số điện thoại": phone, "Chi nhánh": BRANCH_ONE_NAME, "Giới tính": "Nữ", Email: "roster@example.test", Action: "E" },
    ]);

    const check = await importFile(page, file, true);
    expect(check.status).toBe(200);
    expect(check.body.errorCount, JSON.stringify(check.body.rows)).toBe(0);
    expect(check.body.created).toBe(1);
    expect(check.body.rows[0].action).toBe(RowAction.Create);
    expect(check.body.rows[0].patientCode).toMatch(/^DH\d{6}$/);
    // A dry run writes nothing.
    expect(await findPatient(page, name)).toBeUndefined();

    const done = await importFile(page, file, false);
    expect(done.body.committed).toBe(true);
    const saved = await findPatient(page, name);
    expect(saved).toBeDefined();
    code = saved?.patientCode ?? "";
    expect(code).toBe(check.body.rows[0].patientCode);
  });

  test("E with an existing code edits it; a blank cell clears the value", async ({ page }) => {
    const file = sheetOf(header, [
      { "Họ và tên": name, "Số điện thoại": phone, "Mã khách hàng": code, "Chi nhánh": BRANCH_ONE_NAME, "Ghi chú": "Đã sửa", Action: "e" },
    ]);
    const done = await importFile(page, file, false);
    expect(done.body.errorCount, JSON.stringify(done.body.rows)).toBe(0);
    expect(done.body.updated).toBe(1);
    expect(done.body.rows[0].action).toBe(RowAction.Update);

    const row = await findPatient(page, name);
    const patient = await call<Patient>(page, "GET", `/api/v1/app/patients/${row?.id}`);
    expect(patient.body.note).toBe("Đã sửa");
    expect(patient.body.email ?? null).toBeNull();
  });

  test("any other Action, or a wrong row, refuses the whole file", async ({ page }) => {
    const file = sheetOf(header, [
      { "Họ và tên": `${name} B`, "Số điện thoại": otherPhone, "Chi nhánh": BRANCH_ONE_NAME, Action: "E" },
      { "Họ và tên": name, "Số điện thoại": phone, "Mã khách hàng": code, "Chi nhánh": BRANCH_ONE_NAME, Action: "X" },
      { "Họ và tên": name, "Số điện thoại": phone, "Chi nhánh": "Chi nhánh không có", Action: "E" },
    ]);
    const res = await importFile(page, file, false);
    expect(res.body.committed).toBe(false);
    expect(res.body.errorCount).toBe(2);
    expect(res.body.rows[1].errors.join(" ")).toMatch(/Action/);
    expect(res.body.rows[2].errors.join(" ")).toMatch(/Chi nhánh/);
    expect(await findPatient(page, `${name} B`)).toBeUndefined();

    const errors = await call<never>(page, "POST", `${API}/import-errors`, { base64: file, dryRun: true });
    expect(errors.status).toBe(200);
    const rows = readRows(errors.base64);
    const lastColumn = rows[0].length - 1;
    expect(rows[0][lastColumn]).toBe("Lỗi");
    expect(String(rows[2][lastColumn])).toMatch(/Action/);
    expect(rows[1][lastColumn]).toBeNull();
  });

  // The hồ sơ dialog refuses a phone or CCCD another record of the branch holds
  // (Patient:0021 / 0012); a file may not do what the dialog cannot.
  test("a phone or CCCD already held in the branch, or repeated in the file, is an error", async ({ page }) => {
    const owner = await importFile(page, sheetOf(header, [
      { "Họ và tên": name, "Số điện thoại": phone, "Mã khách hàng": code, "Chi nhánh": BRANCH_ONE_NAME, CCCD: nationalId, Action: "E" },
    ]), false);
    expect(owner.body.errorCount, JSON.stringify(owner.body.rows)).toBe(0);

    const file = sheetOf(header, [
      { "Họ và tên": `${name} C`, "Số điện thoại": phone, "Chi nhánh": BRANCH_ONE_NAME, Action: "E" },
      { "Họ và tên": `${name} D`, "Số điện thoại": otherPhone, "Chi nhánh": BRANCH_ONE_NAME, CCCD: nationalId, Action: "E" },
      { "Họ và tên": `${name} E`, "Số điện thoại": otherPhone, "Chi nhánh": BRANCH_ONE_NAME, Action: "E" },
    ]);
    const res = await importFile(page, file, true);
    expect(res.body.errorCount, JSON.stringify(res.body.rows)).toBe(3);
    expect(res.body.rows[0].errors.join(" ")).toContain(`Số điện thoại" ${phone}`);
    expect(res.body.rows[0].errors.join(" ")).toContain(code);
    expect(res.body.rows[1].errors.join(" ")).toContain(`CCCD" ${nationalId}`);
    expect(res.body.rows[2].errors.join(" ")).toMatch(/Số điện thoại.*dòng 3/);

    // Moving the owner off the number in the same file frees it.
    const swap = await importFile(page, sheetOf(header, [
      { "Họ và tên": name, "Số điện thoại": otherPhone, "Mã khách hàng": code, "Chi nhánh": BRANCH_ONE_NAME, Action: "E" },
      { "Họ và tên": `${name} C`, "Số điện thoại": phone, "Chi nhánh": BRANCH_ONE_NAME, Action: "E" },
    ]), true);
    expect(swap.body.errorCount, JSON.stringify(swap.body.rows)).toBe(0);
  });

  test("D refuses a patient who has records", async ({ page }) => {
    const booked = await call<{ items: { patientId: string | null }[] }>(page, "GET", "/api/v1/app/appointments?maxResultCount=20");
    const patientId = booked.body.items?.find((item) => item.patientId)?.patientId;
    test.skip(!patientId, "no booking in branch one to test against");

    const patient = await call<Patient>(page, "GET", `/api/v1/app/patients/${patientId}`);
    const file = sheetOf(header, [
      { "Họ và tên": patient.body.fullName, "Số điện thoại": "0900000000", "Mã khách hàng": patient.body.patientCode, "Chi nhánh": BRANCH_ONE_NAME, Action: "D" },
    ]);
    const res = await importFile(page, file, true);
    expect(res.body.errorCount).toBe(1);
    expect(res.body.rows[0].action).toBe(RowAction.Error);
  });

  test("D deletes the patient", async ({ page }) => {
    const file = sheetOf(header, [
      { "Họ và tên": name, "Số điện thoại": phone, "Mã khách hàng": code, "Chi nhánh": BRANCH_ONE_NAME, Action: "D" },
    ]);
    const res = await importFile(page, file, false);
    expect(res.body.errorCount, JSON.stringify(res.body.rows)).toBe(0);
    expect(res.body.deleted).toBe(1);
    expect(res.body.rows[0].action).toBe(RowAction.Delete);
    expect(await findPatient(page, name)).toBeUndefined();

    // A deleted record keeps its code under the unique index, so the hồ sơ
    // dialog must not offer it again (it did, and the save then failed with 500).
    const estimate = await call<{ code: string }>(page, "GET", "/api/v1/app/patients/code-estimate");
    expect(estimate.status).toBe(200);
    expect(estimate.body.code).not.toBe(code);

    // Gone means the code can no longer be edited.
    const again = await importFile(page, sheetOf(header, [
      { "Họ và tên": name, "Số điện thoại": phone, "Mã khách hàng": code, "Chi nhánh": BRANCH_ONE_NAME, Action: "E" },
    ]), true);
    expect(again.body.errorCount).toBe(1);
  });
});

// Every seeded account sits in the admin role locally, so the refused caller
// is a throw-away dentist made for the run.
test("F-69 patient roster — an account without the permission gets 403", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const id = runId();
  const userName = `bsroster${id}`;
  const password = "Bacsi@123456";
  const fullName = `BAC SI ROSTER ${id}`;

  await login(page);
  await createDentist(page, fullName, userName, password);
  const dentist = await openDentistSession(browser, userName, password);
  try {
    const exported = await call<never>(dentist.page, "GET", `${API}/export`);
    expect(exported.status).toBe(403);
    const imported = await importFile(dentist.page, sheetOf(["Họ và tên *", "Action"], []), true);
    expect(imported.status).toBe(403);
  } finally {
    await dentist.context.close();
    await deleteDentist(page, fullName);
  }
});
