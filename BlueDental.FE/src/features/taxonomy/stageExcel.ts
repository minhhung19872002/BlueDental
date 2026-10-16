import * as XLSX from "xlsx";
import { MAX_VND } from "@/components/CurrencyInput";
import {
  SERVICE_STAGE_VALUE_TYPE,
  type ServiceStageDto,
  type ServiceStageValueType,
} from "./api/taxonomyApi";

/**
 * Excel round trip of a service's công đoạn (BA request R-962): the sheet is
 * the dialog's table — Tên công đoạn * | Loại * | Giá trị * | Tính lương cho
 * phòng MKT — and reading it back replaces the table. As in the catalog import
 * template, a required header ends in " *" and columns are found by header,
 * so their order does not matter; every row is checked against the same rules
 * the dialog's table enforces.
 */

/** The dialog's name box and the share cap; the table reads them from here too. */
export const STAGE_NAME_MAX = 100;
export const STAGE_PERCENT_MAX = 100;

const PERCENT_LABEL = "%";
const AMOUNT_LABEL = "VNĐ";
const REQUIRED_MARK = " *";

export type StageColumn = "name" | "type" | "value" | "marketing";

export const STAGE_COLUMNS: StageColumn[] = ["name", "type", "value", "marketing"];
const REQUIRED_COLUMNS: StageColumn[] = ["name", "type", "value"];

/** Header text of each column, without the required mark. */
export type StageSheetHeaders = Record<StageColumn, string>;

export interface StageSheetWords {
  headers: StageSheetHeaders;
  /** What a ticked "Tính lương cho phòng MKT" is written as; [0] is what export writes. */
  yes: string[];
  /** What an unticked one may be written as, besides a blank cell. */
  no: string[];
}

export function stageHeader(column: StageColumn, headers: StageSheetHeaders): string {
  return REQUIRED_COLUMNS.includes(column) ? headers[column] + REQUIRED_MARK : headers[column];
}

/** One stage as the sheet writes it, column by column. */
function stageCells(stage: ServiceStageDto, words: StageSheetWords): (string | number)[] {
  return [
    stage.name,
    stage.valueType === SERVICE_STAGE_VALUE_TYPE.Amount ? AMOUNT_LABEL : PERCENT_LABEL,
    stage.value,
    stage.isMarketingSalary ? words.yes[0] : "",
  ];
}

/** Header row, then one row per stage; with no stages it is the blank template. */
export function stagesToSheetRows(stages: ServiceStageDto[], words: StageSheetWords): unknown[][] {
  return [
    STAGE_COLUMNS.map((column) => stageHeader(column, words.headers)),
    ...stages.map((stage) => stageCells(stage, words)),
  ];
}

export function downloadStageWorkbook(rows: unknown[][], filename: string, sheetName: string) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 48 }, { wch: 10 }, { wch: 16 }, { wch: 28 }, { wch: 60 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, `${filename}.xlsx`);
}

/** A file name from the service's name: no marks, no spaces, nothing a file system refuses. */
export function stageFileName(serviceName: string | undefined): string {
  const slug = (serviceName ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `cong-doan-${slug}` : "cong-doan";
}

export type StageRowProblem =
  | "NameMissing"
  | "NameTooLong"
  | "TypeMissing"
  | "TypeInvalid"
  | "ValueMissing"
  | "ValueInvalid"
  | "PercentTooHigh"
  | "AmountTooHigh"
  | "MarketingInvalid";

export type StageFileProblem =
  | { reason: "Unreadable" | "Empty" }
  | { reason: "MissingColumns"; columns: StageColumn[] };

export interface StageSheetRow {
  /** The row as Excel numbers it, header included. */
  row: number;
  /** The four cells as the file has them, for the preview and the error file. */
  values: string[];
  stage: ServiceStageDto | null;
  problems: StageRowProblem[];
}

export interface StageSheet {
  fileProblem: StageFileProblem | null;
  rows: StageSheetRow[];
}

type CellOf = (column: StageColumn) => unknown;

/** Reads the first sheet; row 1 is the header. Every problem of every row is reported. */
export function readStageSheet(data: ArrayBuffer, words: StageSheetWords): StageSheet {
  let cells: unknown[][];
  try {
    const book = XLSX.read(data, { type: "array" });
    const first = book.Sheets[book.SheetNames[0]];
    if (!first) return { fileProblem: { reason: "Unreadable" }, rows: [] };
    cells = XLSX.utils.sheet_to_json<unknown[]>(first, { header: 1, defval: "", blankrows: true });
  } catch {
    return { fileProblem: { reason: "Unreadable" }, rows: [] };
  }

  const at = locateColumns(cells[0] ?? [], words.headers);
  const missing = REQUIRED_COLUMNS.filter((column) => at[column] === undefined);
  if (missing.length) return { fileProblem: { reason: "MissingColumns", columns: missing }, rows: [] };

  const yes = new Set(words.yes.map(fold));
  const no = new Set(words.no.map(fold));
  const rows: StageSheetRow[] = [];

  cells.slice(1).forEach((cellsOfRow, index) => {
    const cell: CellOf = (column) => {
      const position = at[column];
      return position === undefined ? "" : cellsOfRow[position];
    };
    const values = STAGE_COLUMNS.map((column) => text(cell(column)));
    // A row with nothing to say is a gap in the sheet, not a stage.
    if (values.every((value) => value === "")) return;
    rows.push({ row: index + 2, values, ...parseRow(cell, yes, no) });
  });

  return { fileProblem: rows.length ? null : { reason: "Empty" }, rows };
}

/** Header cell → column, the trailing "*" of a required header ignored. */
function locateColumns(header: unknown[], headers: StageSheetHeaders): Partial<Record<StageColumn, number>> {
  const keys = header.map((cell) => fold(text(cell).replace(/\s*\*+$/, "")));
  const at: Partial<Record<StageColumn, number>> = {};
  for (const column of STAGE_COLUMNS) {
    const position = keys.indexOf(fold(headers[column]));
    if (position >= 0) at[column] = position;
  }
  return at;
}

function parseRow(
  cell: CellOf,
  yes: Set<string>,
  no: Set<string>,
): { stage: ServiceStageDto | null; problems: StageRowProblem[] } {
  const problems: StageRowProblem[] = [];

  const name = text(cell("name"));
  if (!name) problems.push("NameMissing");
  else if (name.length > STAGE_NAME_MAX) problems.push("NameTooLong");

  const type = text(cell("type"));
  const valueType = type ? parseType(type) : null;
  if (!type) problems.push("TypeMissing");
  else if (valueType === null) problems.push("TypeInvalid");

  const value = text(cell("value")) === "" ? null : parseValue(cell("value"));
  if (text(cell("value")) === "") problems.push("ValueMissing");
  else if (value === null) problems.push("ValueInvalid");
  else if (valueType === SERVICE_STAGE_VALUE_TYPE.Percentage && value > STAGE_PERCENT_MAX)
    problems.push("PercentTooHigh");
  else if (valueType === SERVICE_STAGE_VALUE_TYPE.Amount && value > MAX_VND) problems.push("AmountTooHigh");

  const marketing = fold(text(cell("marketing")));
  if (marketing && !yes.has(marketing) && !no.has(marketing)) problems.push("MarketingInvalid");

  if (problems.length || valueType === null || value === null) return { stage: null, problems };
  return { stage: { name, valueType, value, isMarketingSalary: yes.has(marketing) }, problems };
}

/** "%" or "VNĐ" (also "VND"). */
function parseType(raw: string): ServiceStageValueType | null {
  const folded = fold(raw);
  if (folded === PERCENT_LABEL) return SERVICE_STAGE_VALUE_TYPE.Percentage;
  if (folded === "vnd" || folded === fold(AMOUNT_LABEL)) return SERVICE_STAGE_VALUE_TYPE.Amount;
  return null;
}

/**
 * A whole number of 0 or more, as the dialog's box takes it: a numeric cell, or
 * text written the Vietnamese way ("1.000.000").
 */
function parseValue(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isInteger(raw) && raw >= 0 ? raw : null;
  const written = text(raw).replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(written)) return null;
  return Number(written.replace(/\./g, ""));
}

function text(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).normalize("NFC").replace(/\s+/g, " ").trim();
}

function fold(raw: string): string {
  return text(raw).toLocaleLowerCase("vi");
}

export type StageImportAction = "Create" | "Update" | "Same" | "Remove" | "Error";

export interface StageImportLine {
  key: string;
  /** The file's row; null for a current stage the file leaves out. */
  row: number | null;
  values: string[];
  action: StageImportAction;
  problems: StageRowProblem[];
}

export interface StageImportPlan {
  lines: StageImportLine[];
  /** The table after the import; null while the file has any problem. */
  next: ServiceStageDto[] | null;
  removedCount: number;
  counts: Record<Exclude<StageImportAction, "Remove">, number>;
}

/**
 * What importing the sheet would do to the current table, line by line. A row
 * takes the id of the current stage of the same name — the k-th "Gắn mắc cài"
 * in the file the k-th one in the table — so a patient's ticked công đoạn keep
 * pointing at it; a new name is a new stage. Current stages the file leaves out
 * are listed as removed, but only once the file is clean: until then the list
 * of what goes is not final.
 */
export function planStageImport(
  current: ServiceStageDto[],
  sheet: StageSheet,
  words: StageSheetWords,
): StageImportPlan {
  const queues = new Map<string, ServiceStageDto[]>();
  for (const stage of current) {
    const key = fold(stage.name);
    queues.set(key, [...(queues.get(key) ?? []), stage]);
  }

  const kept = new Set<ServiceStageDto>();
  const next: ServiceStageDto[] = [];
  const lines: StageImportLine[] = sheet.rows.map(({ row, values, stage, problems }) => {
    const line = { key: `row-${row}`, row, values, problems };
    if (!stage) return { ...line, action: "Error" };
    const match = queues.get(fold(stage.name))?.shift();
    if (!match) {
      next.push(stage);
      return { ...line, action: "Create" };
    }
    kept.add(match);
    next.push(match.id ? { ...stage, id: match.id } : stage);
    return { ...line, action: sameStage(match, stage) ? "Same" : "Update" };
  });

  const clean = sheet.fileProblem === null && lines.every((line) => line.action !== "Error");
  const removed = clean ? current.filter((stage) => !kept.has(stage)) : [];
  removed.forEach((stage, index) =>
    lines.push({
      key: `removed-${index}`,
      row: null,
      values: stageCells(stage, words).map(String),
      action: "Remove",
      problems: [],
    }),
  );

  const count = (action: StageImportAction) => lines.filter((line) => line.action === action).length;
  return {
    lines,
    next: clean ? next : null,
    removedCount: removed.length,
    counts: { Create: count("Create"), Update: count("Update"), Same: count("Same"), Error: count("Error") },
  };
}

function sameStage(a: ServiceStageDto, b: ServiceStageDto): boolean {
  return (
    a.name === b.name &&
    a.valueType === b.valueType &&
    a.value === b.value &&
    a.isMarketingSalary === b.isMarketingSalary
  );
}

/** The file back with an error column: every row as read, its problems spelled out. */
export function stageErrorRows(
  sheet: StageSheet,
  words: StageSheetWords,
  errorHeader: string,
  describe: (problem: StageRowProblem) => string,
): unknown[][] {
  return [
    [...STAGE_COLUMNS.map((column) => stageHeader(column, words.headers)), errorHeader],
    ...sheet.rows.map((row) => [...row.values, row.problems.map(describe).join("; ")]),
  ];
}
