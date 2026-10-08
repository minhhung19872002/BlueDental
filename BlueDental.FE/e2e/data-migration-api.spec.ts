import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";

/**
 * Feature: chuyển dữ liệu từ hệ thống cũ (F-60) — BlueDental_Migration.xlsx
 * in, patients + treatment history out. BlueDental's own feature with no
 * screen (BA 2026-10-08: Swagger / curl only), so every check here is a real
 * HTTP call from inside the logged-in page: cookie session, antiforgery
 * header, real database. Nothing is intercepted.
 */

const API = "/api/v1/app/data-migration";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const enum RowAction {
  Create = 0,
  Skip = 1,
  Error = 2,
}

interface RowResult {
  row: number;
  patientCode: string | null;
  action: RowAction;
  errors: string[];
}

interface MigrationResult {
  dryRun: boolean;
  committed: boolean;
  errorCount: number;
  patientsCreated: number;
  patientsSkipped: number;
  treatmentPlansCreated: number;
  treatmentStagesCreated: number;
  fileErrors: string[];
  sheets: { name: string; totalRows: number; rows: RowResult[] }[];
}

interface ApiResult<T> {
  status: number;
  body: T & { error?: { code?: string; message?: string } };
}

interface PatientListItem {
  id: string;
  patientCode: string;
}

interface Patient {
  id: string;
  patientCode: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: number; // 1 Nam, 2 Nữ, 3 Khác, 4 không cung cấp
  phoneNumber: string | null;
  email: string | null;
  address: string | null;
  oldAddress: string | null;
  nationalId: string | null;
  insuranceNumber: string | null;
  sourceTaxonomyId: string | null;
  sourceEntryId: string | null;
  occupationEntryId: string | null;
  occupationOther: string | null;
  tagIds: string[];
  diseaseHistoryEntryIds: string[];
  note: string | null;
  creationTime: string;
  examinationReasons: { content: string; creationTime?: string; createdAt?: string }[];
  guardians: { fullName: string; phoneNumber?: string | null; phone?: string | null; nationalId: string }[];
}

interface Slip {
  id: string;
  code: string;
  title: string;
  status: number;
  payableAmount: number;
  services: { price: number; quantity: number }[];
}

interface Stage {
  status: number; // 1 Pending, 2 InProgress, 3 Completed
  name: string | null;
  note: string | null;
  teeth: { toothCode: number; selected: boolean }[];
  startedAt: string | null;
  completedAt: string | null;
  creationTime: string;
  staffId: string | null;
}

/** One multipart POST from the logged-in page: cookie session + antiforgery header. */
async function post<T>(
  page: Page,
  path: "import" | "import-errors",
  upload: { base64: string; clinicBranchId?: string; dryRun?: boolean; fileName?: string },
): Promise<ApiResult<T> & { base64: string }> {
  return page.evaluate(
    async ({ upload, url, mime }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json, text/plain, */*",
        "accept-language": "vi",
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      const bytes = Uint8Array.from(atob(upload.base64), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: mime }), upload.fileName ?? "BlueDental_Migration.xlsx");
      form.append("dryRun", upload.dryRun ? "true" : "false");
      if (upload.clinicBranchId) form.append("clinicBranchId", upload.clinicBranchId);
      const res = await fetch(url, { method: "POST", credentials: "include", headers, body: form });
      const buffer = new Uint8Array(await res.arrayBuffer());
      const isJson = (res.headers.get("content-type") ?? "").includes("json");
      let body: unknown = {};
      if (isJson) {
        try {
          body = JSON.parse(new TextDecoder().decode(buffer));
        } catch {
          body = {};
        }
      }
      let binary = "";
      if (!isJson) buffer.forEach((b) => (binary += String.fromCharCode(b)));
      return { status: res.status, body: body as ApiResult<T>["body"], base64: btoa(binary) };
    },
    { upload, url: `${API}/${path}`, mime: XLSX_MIME },
  );
}

/** GET as JSON from the logged-in page. */
async function getJson<T>(page: Page, url: string, branch = BRANCH_ONE): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ target, branch }) => {
      const res = await fetch(target, {
        credentials: "include",
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "vi",
          "X-Clinic-Branch-Id": branch,
        },
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    },
    { target: url, branch },
  );
}

/** A JSON write from the logged-in page, antiforgery header included. */
async function sendJson<T>(page: Page, method: "POST" | "PUT" | "DELETE", url: string, body?: unknown): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ method, target, payload, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const res = await fetch(target, {
        method,
        credentials: "include",
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "vi",
          "content-type": "application/json",
          "X-Clinic-Branch-Id": branch,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      const text = await res.text();
      let parsed: unknown = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }
      return { status: res.status, body: parsed as ApiResult<T>["body"] };
    },
    { method, target: url, payload: body, branch: BRANCH_ONE },
  );
}

/** GET a file, returned as base64 so the test can open it with SheetJS. */
async function getFile(page: Page, url: string) {
  return page.evaluate(async (target) => {
    const res = await fetch(target, {
      credentials: "include",
      headers: { accept: "application/json, text/plain, */*", "accept-language": "vi" },
    });
    const buffer = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    buffer.forEach((b) => (binary += String.fromCharCode(b)));
    return {
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      disposition: res.headers.get("content-disposition") ?? "",
      base64: btoa(binary),
    };
  }, url);
}

type Cell = string | number | Date | null;

function readSheet(base64: string, index: number): Cell[][] {
  const book = XLSX.read(base64, { type: "base64" });
  const sheet = book.Sheets[book.SheetNames[index]];
  return XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: null, raw: false });
}

/** The template's own two data sheets, header row taken from the template itself, rows appended. */
function fill(template: string, patients: Cell[][], treatments: Cell[][]): string {
  const book = XLSX.read(template, { type: "base64" });
  const [patientSheet, treatmentSheet] = book.SheetNames;
  const patientHeader = readSheet(template, 0)[0];
  const treatmentHeader = readSheet(template, 1)[0];
  book.Sheets[patientSheet] = XLSX.utils.aoa_to_sheet([patientHeader, ...patients]);
  book.Sheets[treatmentSheet] = XLSX.utils.aoa_to_sheet([treatmentHeader, ...treatments]);
  return XLSX.write(book, { type: "base64", bookType: "xlsx" });
}

/**
 * One part of the .xlsx package as text, "" when absent. SheetJS keeps the raw
 * parts under `files` when asked (`bookFiles`); its typings leave that out.
 */
function xlsxPart(base64: string, path: string): string {
  const book: object = XLSX.read(base64, { type: "base64", bookFiles: true });
  const files = "files" in book && typeof book.files === "object" && book.files !== null ? book.files : {};
  const entry: unknown = Object.entries(files).find(([name]) => name.endsWith(path))?.[1];
  if (typeof entry !== "object" || entry === null || !("content" in entry) || !(entry.content instanceof Uint8Array)) {
    return "";
  }
  return new TextDecoder().decode(entry.content);
}

const unescapeXml = (text: string) =>
  text.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The list validations of the n-th sheet: columns ("D", "H:J") → error style and formula. */
function pickLists(base64: string, sheet: number): Map<string, { style: string; formula: string }> {
  const xml = xlsxPart(base64, `xl/worksheets/sheet${sheet}.xml`);
  const lists = new Map<string, { style: string; formula: string }>();
  for (const [, attrs, formula] of xml.matchAll(/<(?:x:)?dataValidation\s([^>]*)>\s*<(?:x:)?formula1>([^<]*)</g)) {
    if (!/type="list"/.test(attrs)) continue;
    const [first, last] = (/sqref="([^"]*)"/.exec(attrs)?.[1] ?? "").split(":").map((ref) => ref.replace(/\d+/g, ""));
    const columns = first === last ? first : `${first}:${last}`;
    lists.set(columns, { style: /errorStyle="(\w+)"/.exec(attrs)?.[1] ?? "stop", formula: unescapeXml(formula) });
  }
  return lists;
}

/** The values of an inline list formula ("a,b,c"). */
const inlineValues = (formula: string) => formula.slice(1, -1).split(",");

/** Khách hàng columns, in the template's order (DataMigrationLayout.Patients). */
const PATIENT_COLUMNS = [
  "code", "fullName", "dateOfBirth", "gender", "phone", "email",
  "address", "oldAddress", "nationalId", "insurance",
  "source", "channel", "occupation", "diseaseHistory", "tags",
  "reason", "note", "emergencyName", "emergencyPhone", "registeredOn",
  "guardianName", "guardianPhone", "guardianNationalId", "guardianRelation",
] as const;

type PatientColumn = (typeof PATIENT_COLUMNS)[number];

function patientRow(values: Partial<Record<PatientColumn, Cell>>): Cell[] {
  return PATIENT_COLUMNS.map((key) => values[key] ?? null);
}

/** Điều trị columns: Mã KH, Ngày, Mã phiếu, Dịch vụ, Công đoạn, Răng, Nội dung, BS điều trị, BS hỗ trợ, Phụ tá, Trạng thái. */
function treatmentRow(
  code: string,
  day: string,
  slip: string | null,
  service: string,
  stage: string | null,
  teeth: string | null,
  content: string | null,
  dentist: string | null,
  status: string | null,
): Cell[] {
  return [code, day, slip, service, stage, teeth, content, dentist, null, null, status];
}

interface CatalogPicks {
  service: string;
  /** A second service, for slips holding two lines. */
  service2: string;
  staff: string;
  staffName: string;
  /** Blocks that may be empty in a branch: null / [] when they are. */
  source: string | null;
  channel: string | null;
  occupation: string | null;
  diseases: string[];
  tags: string[];
}

interface NamedRow {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
  isCombo?: boolean;
}

interface StaffRow {
  userName: string;
  name: string | null;
  surname: string | null;
}

/**
 * Names the import can match, read from the branch's live catalogs (the
 * template carries none). Names used twice, or holding a list separator for
 * the multi-value cells, are left out.
 */
async function catalogPicks(page: Page): Promise<CatalogPicks> {
  const list = async <T,>(url: string): Promise<T[]> => {
    const res = await getJson<{ items: T[] }>(page, url);
    expect(res.status, url).toBe(200);
    return res.body.items ?? [];
  };
  const entries = (group: string, extra = "") =>
    list<NamedRow>(
      `/api/v1/app/catalog-entries?ClinicBranchId=${BRANCH_ONE}&Group=${group}&IsActive=true&MaxResultCount=1000${extra}`,
    ).then((rows) => rows.filter((r) => r.isActive !== false && !r.isCombo).map((r) => r.name));
  const unique = (values: string[]) => values.filter((v) => values.filter((x) => x === v).length === 1);
  const listable = (values: string[]) => [...new Set(values.filter((v) => !/[;,]/.test(v)))];

  const services = unique(await entries("care_service", "&IsCombo=false"));
  const staffRows = (await list<StaffRow>(`/api/v1/app/staff?BranchId=${BRANCH_ONE}&MaxResultCount=1000`))
    .map((r) => ({ userName: r.userName, name: [r.surname, r.name].filter((x) => x?.trim()).join(" ").trim() || r.userName }));
  const staff = staffRows.find((r) => staffRows.filter((x) => x.name === r.name).length === 1);
  if (services.length < 2 || !staff) throw new Error("Branch one has no usable services or staff");

  const sources = await list<NamedRow>(`/api/v1/app/taxonomies?ClinicBranchId=${BRANCH_ONE}&Group=source&MaxResultCount=1000`);
  let source: string | null = null;
  let channel: string | null = null;
  for (const s of unique(sources.map((x) => x.name))) {
    const id = sources.find((x) => x.name === s)!.id;
    const channels = unique(await entries("source", `&TaxonomyId=${id}`));
    source ??= s;
    if (channels.length) {
      source = s;
      channel = channels[0];
      break;
    }
  }

  const tags = await list<NamedRow>(`/api/v1/app/patient-tags?ClinicBranchId=${BRANCH_ONE}&IsActive=true&MaxResultCount=1000`);
  return {
    service: services[0],
    service2: services[1],
    staff: staff.userName,
    staffName: staff.name,
    source,
    channel,
    occupation: unique(await entries("occupation"))[0] ?? null,
    diseases: listable(unique(await entries("disease_history"))).slice(0, 2),
    tags: listable(unique(tags.filter((t) => t.isActive !== false).map((t) => t.name))).slice(0, 2),
  };
}

async function findPatient(page: Page, code: string): Promise<PatientListItem[]> {
  const res = await getJson<{ items: PatientListItem[] }>(
    page,
    `/api/v1/app/patients?branchId=${BRANCH_ONE}&filter=${encodeURIComponent(code)}&maxResultCount=50`,
  );
  expect(res.status).toBe(200);
  return (res.body.items ?? []).filter((p) => p.patientCode === code);
}

/** Same instant as the clinic's wall clock (UTC+7) says. */
const clinicTime = (iso: string) => Date.parse(`${iso}+07:00`);

test.describe("Chuyển dữ liệu hệ thống cũ (API)", () => {
  test.describe.configure({ mode: "serial" });

  let template = "";
  let picks!: CatalogPicks;

  test.beforeEach(async ({ page }) => {
    await login(page);
    await Promise.all([assertRealApiTraffic(page, "/api/v1/app/patients"), page.goto("/patient")]);
  });

  test("hands out BlueDental_Migration.xlsx with both data sheets and a guide", async ({ page }) => {
    const file = await getFile(page, `${API}/template?clinicBranchId=${BRANCH_ONE}`);
    expect(file.status).toBe(200);
    expect(file.contentType).toContain("spreadsheetml");
    expect(file.disposition).toContain("BlueDental_Migration");
    expect(atob(file.base64).slice(0, 2)).toBe("PK");

    const book = XLSX.read(file.base64, { type: "base64" });
    expect(book.SheetNames).toEqual(["Khách hàng", "Điều trị", "Hướng dẫn"]);

    const patientHeader = readSheet(file.base64, 0)[0];
    expect(patientHeader).toHaveLength(24);
    expect(patientHeader[0]).toBe("Mã KH *");
    expect(patientHeader[1]).toBe("Họ và tên *");
    expect(readSheet(file.base64, 1)[0]).toEqual([
      "Mã KH *", "Ngày điều trị *", "Mã phiếu", "Dịch vụ *", "Công đoạn", "Răng",
      "Nội dung điều trị", "Bác sĩ điều trị *", "Bác sĩ hỗ trợ", "Phụ tá", "Trạng thái",
    ]);

    template = file.base64;
    picks = await catalogPicks(page);
  });

  test("drop-down lists sit only on the fixed-choice columns and every value they offer imports clean", async ({ page }) => {
    const patientLists = pickLists(template, 1);
    const treatmentLists = pickLists(template, 2);
    // D Giới tính, X Quan hệ | K Trạng thái. Catalog and staff columns carry none:
    // the file is filled offline, a list from one database would refuse names valid on another.
    expect([...patientLists.keys()].sort()).toEqual(["D", "X"]);
    expect([...treatmentLists.keys()]).toEqual(["K"]);
    for (const [columns, list] of [...patientLists, ...treatmentLists]) expect(list.style, columns).toBe("stop");

    const genders = inlineValues(patientLists.get("D")!.formula);
    const relations = inlineValues(patientLists.get("X")!.formula);
    const statuses = inlineValues(treatmentLists.get("K")!.formula);
    expect(genders).toEqual(["Nam", "Nữ", "Khác"]);
    expect(relations).toEqual(["Bố", "Mẹ", "Ông", "Bà", "Anh / Chị ruột", "Cô / Dì / Chú / Bác", "Người giám hộ hợp pháp"]);
    expect(statuses).toEqual(["Hoàn thành", "Đang điều trị"]);

    // Every offered value, each on its own row, must pass the import's own reading.
    const id = runId();
    const code = (tag: string, i: number) => `MIG${id}${tag}${i}`;
    const two = (i: number) => String(i).padStart(2, "0");
    // A shared phone is allowed (BA decision 4); the rows only differ in the picked value.
    const picked = (values: Partial<Record<PatientColumn, Cell>>) => patientRow({ phone: "0944444444", ...values });
    const patients = [
      ...genders.map((gender, i) => picked({ code: code("G", i), fullName: `Chọn Giới ${i}`, gender })),
      ...relations.map((guardianRelation, i) => picked({
        code: code("R", i), fullName: `Chọn Quan Hệ ${i}`, dateOfBirth: "01/01/2018",
        guardianName: `Giám Hộ ${i}`, guardianPhone: `091234${id.slice(-2)}${two(i)}`.slice(0, 10),
        guardianNationalId: `0012345678${two(i)}`, guardianRelation,
      })),
    ];
    const treatments: Cell[][] = statuses.map((status, i) =>
      [code("G", 0), `0${i + 1}/03/2023`, null, picks.service, null, null, null, picks.staffName, null, null, status]);
    const dry = await post<MigrationResult>(page, "import", {
      base64: fill(template, patients, treatments), clinicBranchId: BRANCH_ONE, dryRun: true,
    });
    expect(dry.status, JSON.stringify(dry.body)).toBe(200);
    const errors = dry.body.sheets.flatMap((s) => s.rows.filter((r) => r.errors.length).map((r) => `${s.name} ${r.row}: ${r.errors}`));
    expect(errors).toEqual([]);
    expect(dry.body.fileErrors).toEqual([]);
    expect(dry.body.patientsCreated).toBe(patients.length);
    expect(dry.body.treatmentStagesCreated).toBe(treatments.length);

    // The error file copies the sheets, drop-downs included.
    const errorFile = await post<MigrationResult>(page, "import-errors", { base64: template, clinicBranchId: BRANCH_ONE });
    expect(errorFile.status).toBe(200);
    expect(pickLists(errorFile.base64, 2).get("K")?.formula).toBe(treatmentLists.get("K")?.formula);
  });

  test("dry run plans everything and writes nothing; a real import backdates the history at price 0", async ({ page }) => {
    const id = runId();
    const adult = `MIG${id}A`;
    const child = `MIG${id}C`;
    const phone = `09${id}12`.slice(0, 10);

    const file = fill(
      template,
      [
        patientRow({
          code: adult, fullName: `Nguyễn Văn Chuyển ${id}`, dateOfBirth: "05/06/1985", gender: "Nam",
          phone, email: `mig${id}@example.test`, address: "12 Đường Thử", note: "Ghi chú cũ",
          reason: "Đau răng hàm", registeredOn: "01/03/2019",
        }),
        // Under 16, no guardian, the same phone: allowed (BA decision 4).
        patientRow({ code: child, fullName: `Trần Bé ${id}`, dateOfBirth: "10/10/2018", gender: "Nữ", phone }),
      ],
      [
        treatmentRow(adult, "15/03/2019", "PX01", picks.service, "Lấy cao răng", "11, 12", "Nội dung 1", picks.staff, "Hoàn thành"),
        treatmentRow(adult, "20/03/2019", "PX01", picks.service, "Tái khám", "11", null, picks.staffName, null),
        treatmentRow(adult, "10/01/2020", null, picks.service, null, "21", "Đang làm dở", picks.staff, "Đang điều trị"),
      ],
    );

    const dry = await post<MigrationResult>(page, "import", { base64: file, clinicBranchId: BRANCH_ONE, dryRun: true });
    expect(dry.status, JSON.stringify(dry.body)).toBe(200);
    expect(dry.body.fileErrors).toEqual([]);
    expect(dry.body.errorCount, JSON.stringify(dry.body.sheets)).toBe(0);
    expect(dry.body.dryRun).toBe(true);
    expect(dry.body.committed).toBe(false);
    expect(dry.body.patientsCreated).toBe(2);
    expect(dry.body.treatmentPlansCreated).toBe(2);
    expect(dry.body.treatmentStagesCreated).toBe(3);
    expect(await findPatient(page, adult)).toHaveLength(0);

    const real = await post<MigrationResult>(page, "import", { base64: file, clinicBranchId: BRANCH_ONE });
    expect(real.status, JSON.stringify(real.body)).toBe(200);
    expect(real.body.committed).toBe(true);
    expect(real.body.patientsCreated).toBe(2);

    // Read back with separate requests.
    const [listed] = await findPatient(page, adult);
    expect(listed).toBeDefined();
    expect(await findPatient(page, child)).toHaveLength(1);

    const patient = (await getJson<Patient>(page, `/api/v1/app/patients/${listed.id}`)).body;
    expect(patient.fullName).toBe(`Nguyễn Văn Chuyển ${id}`);
    expect(patient.phoneNumber).toBe(phone);
    expect(patient.email).toBe(`mig${id}@example.test`);
    expect(patient.dateOfBirth?.slice(0, 10)).toBe("1985-06-05");
    expect(patient.note).toBe("Ghi chú cũ");
    expect(Date.parse(patient.creationTime)).toBe(clinicTime("2019-03-01T08:00:00"));
    expect(patient.examinationReasons.map((r) => r.content)).toEqual(["Đau răng hàm"]);

    const slips = await getJson<{ items: Slip[] }>(
      page,
      `/api/v1/app/patient-treatments?patientId=${listed.id}&clinicBranchId=${BRANCH_ONE}&maxResultCount=50`,
    );
    expect(slips.status).toBe(200);
    const byCode = new Map(slips.body.items.map((s) => [s.code, s]));
    expect([...byCode.keys()].sort()).toEqual(["DT01", "DT02"]);
    expect(byCode.get("DT01")?.title).toBe("Kế hoạch điều trị (PX01)");
    expect(byCode.get("DT01")?.status).toBe(5); // every công đoạn done → Completed
    expect(byCode.get("DT02")?.title).toBe("Kế hoạch điều trị");
    expect(byCode.get("DT02")?.status).not.toBe(5);
    for (const slip of slips.body.items) {
      expect(slip.payableAmount).toBe(0);
      expect(slip.services.every((line) => line.price === 0)).toBe(true);
    }
    expect(byCode.get("DT01")?.services[0].quantity).toBe(2); // teeth 11 + 12

    const stages = await getJson<{ items: Stage[] }>(
      page,
      `/api/v1/app/treatment-stages?patientId=${listed.id}&clinicBranchId=${BRANCH_ONE}&maxResultCount=50`,
    );
    expect(stages.status).toBe(200);
    const sorted = [...stages.body.items].sort((a, b) => Date.parse(a.startedAt ?? "") - Date.parse(b.startedAt ?? ""));
    expect(sorted).toHaveLength(3);
    const teeth = (stage: Stage) => stage.teeth.map((t) => t.toothCode);
    expect(sorted[0]).toMatchObject({ status: 3, name: "Lấy cao răng", note: "Nội dung 1" });
    expect(teeth(sorted[0])).toEqual([11, 12]);
    expect(Date.parse(sorted[0].startedAt ?? "")).toBe(clinicTime("2019-03-15T09:00:00"));
    expect(Date.parse(sorted[0].completedAt ?? "")).toBe(clinicTime("2019-03-15T09:00:00"));
    expect(sorted[1]).toMatchObject({ status: 3, name: "Tái khám" });
    expect(teeth(sorted[1])).toEqual([11]);
    expect(Date.parse(sorted[1].startedAt ?? "")).toBe(clinicTime("2019-03-20T09:00:00"));
    expect(sorted[2]).toMatchObject({ status: 2, note: "Đang làm dở", completedAt: null });
    expect(teeth(sorted[2])).toEqual([21]);
    expect(Date.parse(sorted[2].startedAt ?? "")).toBe(clinicTime("2020-01-10T09:00:00"));
    expect(new Set(sorted.map((s) => s.staffId)).size).toBe(1); // user name and full name → the same dentist

    // No payments migrated: no công nợ.
    const account = await getJson<{ payment: { debt: number } }>(
      page,
      `/api/v1/app/patient-payments/account?patientId=${listed.id}&clinicBranchId=${BRANCH_ONE}`,
    );
    expect(account.status).toBe(200);
    expect(account.body.payment.debt).toBe(0);

    // The same file again: both patients skipped with their rows, nothing doubled.
    const again = await post<MigrationResult>(page, "import", { base64: file, clinicBranchId: BRANCH_ONE });
    expect(again.status, JSON.stringify(again.body)).toBe(200);
    expect(again.body.errorCount).toBe(0);
    expect(again.body.patientsCreated).toBe(0);
    expect(again.body.patientsSkipped).toBe(2);
    expect(again.body.treatmentPlansCreated).toBe(0);
    expect(again.body.treatmentStagesCreated).toBe(0);
    expect(again.body.sheets[1].rows.every((r) => r.action === RowAction.Skip)).toBe(true);
    expect(await findPatient(page, adult)).toHaveLength(1);
    const slipsAfter = await getJson<{ items: Slip[] }>(
      page,
      `/api/v1/app/patient-treatments?patientId=${listed.id}&clinicBranchId=${BRANCH_ONE}&maxResultCount=50`,
    );
    expect(slipsAfter.body.items).toHaveLength(2);
  });

  test("a guardian is kept with the patient", async ({ page }) => {
    const id = runId();
    const code = `MIG${id}G`;
    const file = fill(
      template,
      [
        patientRow({
          code, fullName: `Lê Có Giám Hộ ${id}`, dateOfBirth: "01/02/2016", gender: "Nam", email: `g${id}@example.test`,
          guardianName: `Lê Mẹ ${id}`, guardianPhone: "0912-345.678", guardianNationalId: "001234567890",
          guardianRelation: "Mẹ",
        }),
      ],
      [],
    );
    const res = await post<MigrationResult>(page, "import", { base64: file, clinicBranchId: BRANCH_ONE });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.errorCount, JSON.stringify(res.body.sheets)).toBe(0);

    const [listed] = await findPatient(page, code);
    const patient = (await getJson<Patient>(page, `/api/v1/app/patients/${listed.id}`)).body;
    expect(patient.guardians).toHaveLength(1);
    expect(patient.guardians[0]).toMatchObject({ fullName: `Lê Mẹ ${id}`, phone: "0912345678", nationalId: "001234567890" });
  });

  test("an unknown service or doctor refuses the whole file and the error file marks the rows", async ({ page }) => {
    const id = runId();
    const good = `MIG${id}OK`;
    const bad = `MIG${id}BAD`;
    const file = fill(
      template,
      [
        patientRow({ code: good, fullName: `Phạm Hợp Lệ ${id}`, phone: "0911111111" }),
        patientRow({ code: bad, fullName: `Phạm Sai ${id}`, phone: "0922222222" }),
        // ContactInfo needs a phone or an email: the row names both columns.
        patientRow({ code: `MIG${id}NC`, fullName: `Phạm Không Liên Hệ ${id}` }),
      ],
      [
        treatmentRow(good, "01/04/2021", null, picks.service, null, null, null, picks.staff, null),
        treatmentRow(bad, "02/04/2021", null, `Dịch vụ không có ${id}`, null, null, null, picks.staff, null),
        treatmentRow(bad, "03/04/2021", null, picks.service, null, null, null, `bacsi-khong-co-${id}`, null),
        treatmentRow(`MIG${id}NONE`, "03/04/2021", null, picks.service, null, null, null, picks.staff, null),
      ],
    );

    const res = await post<MigrationResult>(page, "import", { base64: file, clinicBranchId: BRANCH_ONE });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.committed).toBe(false);
    expect(res.body.errorCount).toBe(4);
    // Only refused (or skipped) rows are listed, by their Excel row number.
    const byRow = (sheet: number) => new Map(res.body.sheets[sheet].rows.map((r) => [r.row, r]));
    const patients = byRow(0);
    expect([...patients.keys()]).toEqual([4]);
    expect(patients.get(4)?.errors).toEqual(['Cần có "Số điện thoại" hoặc "Email"']);
    const rows = byRow(1);
    expect(rows.has(2)).toBe(false);
    expect(rows.get(3)?.errors.join(" ")).toContain(`Dịch vụ không có ${id}`);
    expect(rows.get(4)?.errors.join(" ")).toContain(`bacsi-khong-co-${id}`);
    expect(rows.get(5)?.action).toBe(RowAction.Error);
    // All or nothing: not even the valid patient was written.
    expect(await findPatient(page, good)).toHaveLength(0);

    const errors = await post<MigrationResult>(page, "import-errors", { base64: file, clinicBranchId: BRANCH_ONE });
    expect(errors.status).toBe(200);
    const sheet = readSheet(errors.base64, 1);
    const errorColumn = sheet[0].indexOf("Lỗi");
    expect(errorColumn).toBeGreaterThan(10);
    expect(sheet[1][errorColumn]).toBeNull();
    expect(String(sheet[2][errorColumn])).toContain(`Dịch vụ không có ${id}`);
    expect(String(sheet[3][errorColumn])).toContain(`bacsi-khong-co-${id}`);
  });

  test("a file without the required columns is refused before any row is read", async ({ page }) => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Tên"], ["x"]]), "Khách hàng");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Ngày"]]), "Điều trị");
    const res = await post<MigrationResult>(page, "import", {
      base64: XLSX.write(book, { type: "base64", bookType: "xlsx" }),
      clinicBranchId: BRANCH_ONE,
    });
    expect(res.status).toBe(200);
    expect(res.body.committed).toBe(false);
    expect(res.body.fileErrors.join(" ")).toContain("Mã KH");
  });

  test("every Khách hàng column lands on the hồ sơ: number cells, real dates, catalogs, free-text occupation", async ({ page }) => {
    const id = runId();
    const full = `MIG${id}F`;
    const other = `MIG${id}O`;
    const lonely = `MIG${id}L`;
    const file = fill(
      template,
      [
        patientRow({
          code: full, fullName: `Đỗ Đủ Cột ${id}`,
          dateOfBirth: new Date(1990, 4, 17), // a real Excel date cell
          gender: "nữ",
          phone: 912345678, // a number cell: the leading 0 is gone
          email: `full${id}@example.test`,
          address: "34 Đường Mới", oldAddress: "34 Đường Cũ, Phường 5",
          nationalId: 1234567890, // a number cell: 12 digits once the zeros are back
          insurance: "DN4797912345678",
          source: picks.source, channel: picks.channel, occupation: picks.occupation,
          diseaseHistory: picks.diseases.join("; "), tags: picks.tags.join(", "),
          reason: "Niềng răng", note: "Khách cũ",
          emergencyName: "Đỗ Người Thân", emergencyPhone: 987654321,
          registeredOn: "2019-03-01",
        }),
        patientRow({
          code: other, fullName: `Vũ Nghề Khác ${id}`, dateOfBirth: "5/6/1990", gender: "Khác",
          email: `other${id}@example.test`, occupation: `Nghề tự do ${id}`,
        }),
        patientRow({ code: lonely, fullName: `Hà Chưa Khám ${id}`, phone: "0933 333 333" }),
      ],
      [
        // Out of order on purpose: the record opens on the earliest visit, not the first row.
        treatmentRow(other, "12/08/2021", null, picks.service, null, null, null, picks.staff, null),
        treatmentRow(other, "03/02/2021", null, picks.service, null, null, null, picks.staff, null),
      ],
    );

    const startedAt = Date.now();
    const res = await post<MigrationResult>(page, "import", { base64: file, clinicBranchId: BRANCH_ONE });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.errorCount, JSON.stringify(res.body.sheets)).toBe(0);
    expect(res.body.patientsCreated).toBe(3);

    const read = async (code: string) => {
      const [listed] = await findPatient(page, code);
      expect(listed, code).toBeDefined();
      return (await getJson<Patient>(page, `/api/v1/app/patients/${listed.id}`)).body;
    };

    const patient = await read(full);
    expect(patient.dateOfBirth?.slice(0, 10)).toBe("1990-05-17");
    expect(patient).toMatchObject({
      gender: 2,
      phoneNumber: "0912345678",
      email: `full${id}@example.test`,
      nationalId: "001234567890",
      insuranceNumber: "DN4797912345678",
      address: "34 Đường Mới",
      oldAddress: "34 Đường Cũ, Phường 5",
      note: "Khách cũ",
      occupationOther: null,
    });
    expect(patient.sourceTaxonomyId).toEqual(picks.source ? expect.any(String) : null);
    expect(patient.sourceEntryId).toEqual(picks.channel ? expect.any(String) : null);
    expect(patient.occupationEntryId).toEqual(picks.occupation ? expect.any(String) : null);
    expect(patient.diseaseHistoryEntryIds).toHaveLength(picks.diseases.length);
    expect(patient.tagIds).toHaveLength(picks.tags.length);
    expect(Date.parse(patient.creationTime)).toBe(clinicTime("2019-03-01T08:00:00"));
    expect(patient.examinationReasons.map((r) => r.content)).toEqual(["Niềng răng"]);
    // The emergency contact has no field in the patient API; it is read back
    // from the database in the feature doc.

    const freeText = await read(other);
    expect(freeText.dateOfBirth?.slice(0, 10)).toBe("1990-06-05");
    expect(freeText).toMatchObject({ gender: 3, phoneNumber: null, occupationEntryId: null, occupationOther: `Nghề tự do ${id}` });
    expect(Date.parse(freeText.creationTime)).toBe(clinicTime("2021-02-03T09:00:00"));

    const neverSeen = await read(lonely);
    expect(neverSeen.gender).toBe(4); // blank = không cung cấp
    expect(neverSeen.phoneNumber).toBe("0933333333"); // saved as the form would take it
    expect(neverSeen.dateOfBirth).toBeNull();
    const created = Date.parse(neverSeen.creationTime);
    expect(created).toBeGreaterThanOrEqual(startedAt - 60_000);
    expect(created).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  test("history: one Mã phiếu across days is one slip, blank Mã phiếu splits by day, two services make two lines", async ({ page }) => {
    const id = runId();
    const code = `MIG${id}H`;
    const file = fill(
      template,
      [patientRow({ code, fullName: `Bùi Lịch Sử ${id}`, phone: "0977777777" })],
      [
        treatmentRow(code, "20/05/2022", null, picks.service, null, null, null, picks.staff, null),
        treatmentRow(code, "10/05/2022", "px9", picks.service, "Mở tuỷ", "36", null, picks.staff, null),
        treatmentRow(code, "10/05/2022", "PX9", picks.service2, null, null, null, picks.staff, null),
        treatmentRow(code, "15/05/2022", "PX9", picks.service, "Trám bít", "36", null, picks.staff, "Đang điều trị"),
        treatmentRow(code, "25/05/2022", null, picks.service, null, "16 17;18", null, picks.staff, null),
        treatmentRow(code, "20/05/2022", null, picks.service2, null, null, null, picks.staff, null),
      ],
    );
    const res = await post<MigrationResult>(page, "import", { base64: file, clinicBranchId: BRANCH_ONE });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.errorCount, JSON.stringify(res.body.sheets)).toBe(0);
    expect(res.body.treatmentPlansCreated).toBe(3);
    expect(res.body.treatmentStagesCreated).toBe(6);

    const [listed] = await findPatient(page, code);
    const slips = await getJson<{ items: Slip[] }>(
      page,
      `/api/v1/app/patient-treatments?patientId=${listed.id}&clinicBranchId=${BRANCH_ONE}&maxResultCount=50`,
    );
    const byCode = new Map(slips.body.items.map((s) => [s.code, s]));
    expect([...byCode.keys()].sort()).toEqual(["DT01", "DT02", "DT03"]);
    // Numbered by first visit: PX9 (10/05), the 20/05 day, the 25/05 day. Mã phiếu is matched without case.
    expect(byCode.get("DT01")?.title).toBe("Kế hoạch điều trị (px9)");
    expect(byCode.get("DT01")?.services).toHaveLength(2);
    expect(byCode.get("DT01")?.status).not.toBe(5); // 15/05 still in progress
    expect(byCode.get("DT02")?.title).toBe("Kế hoạch điều trị");
    expect(byCode.get("DT02")?.services).toHaveLength(2);
    expect(byCode.get("DT02")?.status).toBe(5);
    expect(byCode.get("DT03")?.services.map((line) => line.quantity)).toEqual([3]);

    const stages = await getJson<{ items: Stage[] }>(
      page,
      `/api/v1/app/treatment-stages?patientId=${listed.id}&clinicBranchId=${BRANCH_ONE}&maxResultCount=50`,
    );
    const times = stages.body.items.map((s) => Date.parse(s.startedAt ?? "")).sort((a, b) => a - b);
    expect(times).toEqual([
      clinicTime("2022-05-10T09:00:00"),
      clinicTime("2022-05-10T09:01:00"),
      clinicTime("2022-05-15T09:00:00"),
      clinicTime("2022-05-20T09:00:00"),
      clinicTime("2022-05-20T09:01:00"),
      clinicTime("2022-05-25T09:00:00"),
    ]);
    const lastDay = stages.body.items.find((s) => Date.parse(s.startedAt ?? "") === clinicTime("2022-05-25T09:00:00"));
    expect(lastDay?.teeth.map((t) => t.toothCode)).toEqual([16, 17, 18]);
    // No Ngày tạo hồ sơ: the record opens with the first visit.
    const patient = (await getJson<Patient>(page, `/api/v1/app/patients/${listed.id}`)).body;
    expect(Date.parse(patient.creationTime)).toBe(clinicTime("2022-05-10T09:00:00"));
  });

  test("Răng takes Hàm trên / Hàm dưới / Nguyên hàm as the picker saves them: every permanent tooth of the jaw, whole", async ({ page }) => {
    const id = runId();
    const code = `MIG${id}J`;
    const upper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
    const lower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
    const patients = [patientRow({ code, fullName: `Đỗ Nguyên Hàm ${id}`, phone: "0966666666" })];
    const visit = (day: string, teeth: string) =>
      treatmentRow(code, day, null, picks.service, null, teeth, null, picks.staff, null);

    // A phrase that is not a jaw is named like any bad tooth, and refuses the file.
    const bad = await post<MigrationResult>(page, "import", {
      base64: fill(template, patients, [visit("01/03/2023", "Hàm giữa, 11")]),
      clinicBranchId: BRANCH_ONE,
    });
    expect(bad.status, JSON.stringify(bad.body)).toBe(200);
    expect(bad.body.errorCount).toBe(1);
    expect(bad.body.sheets[1].rows[0].errors).toEqual([expect.stringContaining('"Hàm giữa"')]);
    expect(await findPatient(page, code)).toHaveLength(0);

    const res = await post<MigrationResult>(page, "import", {
      base64: fill(template, patients, [
        visit("01/03/2023", "Hàm trên"),
        visit("02/03/2023", "hàm   DƯỚI; 11"),
        visit("03/03/2023", "Nguyên hàm, 16"),
        visit("04/03/2023", "ham tren"),
      ]),
      clinicBranchId: BRANCH_ONE,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.errorCount, JSON.stringify(res.body.sheets)).toBe(0);

    const [listed] = await findPatient(page, code);
    const stages = await getJson<{ items: Stage[] }>(
      page,
      `/api/v1/app/treatment-stages?patientId=${listed.id}&clinicBranchId=${BRANCH_ONE}&maxResultCount=50`,
    );
    const onDay = (day: string) =>
      stages.body.items.find((s) => Date.parse(s.startedAt ?? "") === clinicTime(`2023-03-${day}T09:00:00`));
    const codes = (day: string) => onDay(day)?.teeth.map((t) => t.toothCode);
    expect(codes("01")).toEqual(upper);
    expect(codes("02")).toEqual([...lower, 11]);
    expect(codes("03")).toEqual([...upper, ...lower]); // 16 given twice is kept once
    expect(codes("04")).toEqual(upper);
    expect(stages.body.items.flatMap((s) => s.teeth).every((t) => t.selected)).toBe(true);
  });

  test("every bad cell is named on its own row and the file is refused whole", async ({ page }) => {
    const id = runId();
    const elsewhere = await getJson<{ items: PatientListItem[] }>(
      page,
      `/api/v1/app/patients?branchId=${BRANCH_TWO}&maxResultCount=1`,
      BRANCH_TWO,
    );
    const takenCode = elsewhere.body.items?.[0]?.patientCode;
    expect(takenCode, "the seed keeps patients in branch 2").toBeTruthy();

    const row = (suffix: string, extra: Partial<Record<PatientColumn, Cell>> = {}) =>
      patientRow({ code: `MIG${id}${suffix}`, fullName: `Lỗi ${suffix} ${id}`, phone: "0944444444", ...extra });
    const patients: Cell[][] = [
      row("A"), // 2: fine on its own
      row("A"), // 3
      row("a"), // 4: same code, other case
      row("D1", { dateOfBirth: "31/02/2020" }), // 5
      row("D2", { dateOfBirth: "01/01/2099" }), // 6
      row("D3", { dateOfBirth: 1985 }), // 7: a bare year
      row("G", { gender: "Nam/Nữ" }), // 8
      row("H1", { guardianName: "Chỉ Có Tên" }), // 9
      row("H2", {
        guardianName: "Người Lạ", guardianPhone: "0955555555", guardianNationalId: "001234567891",
        guardianRelation: "Hàng xóm",
      }), // 10
      row("S1", { channel: "Facebook" }), // 11
      row("S2", { source: `Nguồn lạ ${id}` }), // 12
      row("T", { tags: `Thẻ lạ ${id}` }), // 13
      row("N", { note: "x".repeat(1001) }), // 14
      patientRow({ code: takenCode, fullName: `Trùng Chi Nhánh ${id}`, phone: "0966666666" }), // 15
      row("P1", { phone: "abc123" }), // 16: the hồ sơ form takes 8–15 digits only
      row("P2", {
        dateOfBirth: "01/01/2018", guardianName: "Mẹ Bé", guardianPhone: "0912",
        guardianNationalId: "001234567892", guardianRelation: "Mẹ",
      }), // 17
    ];
    const a = `MIG${id}A`;
    const treatments: Cell[][] = [
      treatmentRow(a, "hôm qua", null, picks.service, null, null, null, picks.staff, null), // 2
      treatmentRow(a, "01/06/2022", null, picks.service, null, "11, 99", null, picks.staff, null), // 3
      treatmentRow(a, "01/06/2022", null, picks.service, null, "R6", null, picks.staff, null), // 4
      treatmentRow(a, "01/06/2022", null, picks.service, null, null, null, picks.staff, "Xong"), // 5
      treatmentRow(a, "01/06/2022", null, picks.service, null, null, null, null, null), // 6
      treatmentRow(a, "01/01/2099", null, picks.service, null, null, null, picks.staff, null), // 7
      treatmentRow(a, "01/06/2022", null, picks.service, null, "21", null, picks.staff, null), // 8: fine
    ];

    const res = await post<MigrationResult>(page, "import", {
      base64: fill(template, patients, treatments),
      clinicBranchId: BRANCH_ONE,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.committed).toBe(false);
    expect(res.body.fileErrors).toEqual([]);

    const errorsOf = (sheet: number) =>
      new Map(res.body.sheets[sheet].rows.map((r) => [r.row, r.errors.join(" | ")]));
    const people = errorsOf(0);
    expect([...people.keys()].sort((x, y) => x - y)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(people.get(3)).toBe("Mã KH trùng với dòng 2");
    expect(people.get(4)).toBe("Mã KH trùng với dòng 2");
    expect(people.get(5)).toContain("31/02/2020");
    expect(people.get(6)).toContain("01/01/2099");
    expect(people.get(6)).toContain("tương lai");
    expect(people.get(7)).toContain('"1985" không phải ngày');
    expect(people.get(8)).toContain("Nam, Nữ hoặc Khác");
    expect(people.get(9)).toContain("Người giám hộ phải điền đủ");
    expect(people.get(10)).toContain("Hàng xóm");
    expect(people.get(11)).toContain("thì phải có");
    expect(people.get(12)).toContain(`Nguồn lạ ${id}`);
    expect(people.get(13)).toContain(`Thẻ lạ ${id}`);
    expect(people.get(14)).toContain("1000");
    expect(people.get(15)).toContain(String(takenCode));
    expect(people.get(16)).toBe('Cột "Số điện thoại": "abc123" không phải số điện thoại (8–15 chữ số)');
    expect(people.get(17)).toBe('Cột "Người giám hộ - SĐT": "0912" không phải số điện thoại (8–15 chữ số)');

    const visits = errorsOf(1);
    expect([...visits.keys()].sort((x, y) => x - y)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(visits.get(2)).toContain("hôm qua");
    expect(visits.get(3)).toContain('"99"');
    expect(visits.get(3)).not.toContain('"11"');
    expect(visits.get(4)).toContain('"R6"');
    expect(visits.get(5)).toContain("Hoàn thành hoặc Đang điều trị");
    expect(visits.get(6)).toContain("Thiếu");
    expect(visits.get(7)).toContain("tương lai");

    expect(await findPatient(page, a)).toHaveLength(0);
  });

  test("sheets are found by name, not position, and the error file marks the right sheet", async ({ page }) => {
    const id = runId();
    const code = `MIG${id}R`;
    const source = XLSX.read(fill(
      template,
      [patientRow({ code, fullName: `Đặng Đảo Sheet ${id}`, phone: "0988888888" })],
      [treatmentRow(code, "01/07/2022", null, picks.service, null, "99", null, picks.staff, null)],
    ), { type: "base64" });
    // Điều trị first, Khách hàng second, the guide and catalogs dropped.
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, source.Sheets["Điều trị"], "Điều trị");
    XLSX.utils.book_append_sheet(book, source.Sheets["Khách hàng"], "Khách hàng");
    const file: string = XLSX.write(book, { type: "base64", bookType: "xlsx" });

    const res = await post<MigrationResult>(page, "import", { base64: file, clinicBranchId: BRANCH_ONE, dryRun: true });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.fileErrors).toEqual([]);
    expect(res.body.sheets[0].rows).toEqual([]);
    expect(res.body.sheets[1].rows.map((r) => r.row)).toEqual([2]);

    // The error file is laid out Khách hàng, Điều trị whatever the upload's order,
    // each copied from the sheet it was read from.
    const errors = await post<MigrationResult>(page, "import-errors", { base64: file, clinicBranchId: BRANCH_ONE });
    expect(errors.status).toBe(200);
    expect(XLSX.read(errors.base64, { type: "base64" }).SheetNames).toEqual(["Khách hàng", "Điều trị"]);
    const people = readSheet(errors.base64, 0);
    expect(people[1][0]).toBe(code);
    expect(people[1][people[0].indexOf("Lỗi")]).toBeNull();
    const visits = readSheet(errors.base64, 1);
    const errorColumn = visits[0].indexOf("Lỗi");
    expect(errorColumn).toBeGreaterThan(10);
    expect(String(visits[1][errorColumn])).toContain('"99"');
  });

  test("a dentist whose account is locked still matches the history", async ({ page }) => {
    const id = runId();
    const roles = await getJson<string[]>(page, "/api/v1/app/staff/roles");
    expect(roles.status).toBe(200);
    const userName = `bsnghi${id}`.toLowerCase();
    const created = await sendJson<{ id: string }>(page, "POST", "/api/v1/app/staff", {
      userName,
      password: `Nghi@${id}1a`,
      name: "Nghỉ",
      surname: `Bác Sĩ ${id}`,
      email: `${userName}@example.test`,
      isActive: false,
      roleNames: roles.body.slice(0, 1),
      branchIds: [BRANCH_ONE],
      isDentist: true,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(200);

    const code = `MIG${id}X`;
    const res = await post<MigrationResult>(page, "import", {
      base64: fill(
        template,
        [patientRow({ code, fullName: `Lương Khách Cũ ${id}`, phone: "0999999999" })],
        [treatmentRow(code, "01/09/2018", null, picks.service, null, null, null, userName, null)],
      ),
      clinicBranchId: BRANCH_ONE,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.errorCount, JSON.stringify(res.body.sheets)).toBe(0);

    const [patient] = await findPatient(page, code);
    const stages = await getJson<{ items: Stage[] }>(
      page,
      `/api/v1/app/treatment-stages?patientId=${patient.id}&clinicBranchId=${BRANCH_ONE}&maxResultCount=50`,
    );
    expect(stages.body.items.map((s) => s.staffId)).toEqual([created.body.id]);
  });

  test("a file that is not .xlsx, or has no rows, is refused with a message", async ({ page }) => {
    const notExcel = await post<MigrationResult>(page, "import", {
      base64: btoa("Ma KH,Ho va ten\nKH1,Nguyen\n"), clinicBranchId: BRANCH_ONE, dryRun: true, fileName: "khach.csv",
    });
    expect(notExcel.status).toBeGreaterThanOrEqual(400);
    expect(notExcel.status).toBeLessThan(500);
    expect(notExcel.body.error?.message, JSON.stringify(notExcel.body)).toBeTruthy();

    const empty = await post<MigrationResult>(page, "import", {
      base64: fill(template, [], []), clinicBranchId: BRANCH_ONE, dryRun: true,
    });
    expect(empty.status).toBe(200);
    expect(empty.body.fileErrors).toEqual(["File không có dòng dữ liệu nào"]);
  });
});

test("an account outside the branch gets 403 on its import and its template", async ({ page }) => {
  await login(page, BRANCH2_USER);
  await page.goto("/patient");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Mã KH"]]), "Khách hàng");
  const file: string = XLSX.write(book, { type: "base64", bookType: "xlsx" });
  const res = await post<MigrationResult>(page, "import", { base64: file, clinicBranchId: BRANCH_ONE, dryRun: true });
  expect(res.status).toBe(403);
  const template = await getFile(page, `${API}/template?clinicBranchId=${BRANCH_ONE}`);
  expect(template.status).toBe(403);
});
