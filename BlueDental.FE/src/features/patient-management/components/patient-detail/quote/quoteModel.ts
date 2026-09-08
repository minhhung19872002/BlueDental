import {
  formatTeeth,
  type PatientAdviseDto,
  type PatientDiagnosisDto,
} from "@/features/treatment-management/api/consultingApi";
import { formatVND } from "@/utils/format";

/**
 * The shapes the quote modal and its two printed sheets work with — built
 * once from the ticked advise rows, never from the raw DTO in a component.
 */
export interface QuoteRow {
  id: string;
  service: string;
  diagnosis: string;
  /** "16, 26" — empty when the advise names no tooth. */
  teeth: string;
  quantity: number;
  unitPrice: number;
  clinicDiscount: number;
  voucherDiscount: number;
  /** The diagnosis slip's note, the seed for "Nội dung chẩn đoán". */
  diagnosisContent: string;
  doctors: string[];
}

export interface QuoteClinic {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
}

export interface QuoteCustomer {
  code: string;
  name: string;
  phone: string;
  address: string;
  dateOfBirth: string;
}

export interface QuoteImage {
  id: string;
  src: string;
  alt: string;
}

export interface QuoteTotals {
  gross: number;
  discount: number;
  /** "Giảm giá bác sĩ" — the plan-level voucher on top of the row discounts. */
  extra: number;
  net: number;
}

export interface DiagnosisDoctorItem {
  key: string;
  doctor: string;
  teeth: string;
  diagnosisLabel: string;
  explanationHtml: string;
}

export interface DiagnosisGroup {
  name: string;
  services: QuoteRow[];
  doctors: DiagnosisDoctorItem[];
}

export const money = (value: number) => `${formatVND(value)} đ`;

export const rowDiscount = (row: QuoteRow) => row.clinicDiscount + row.voucherDiscount;

export const lineTotal = (row: QuoteRow) => row.quantity * row.unitPrice - rowDiscount(row);

/** "16, 26 - Sâu răng" — the blue label in the Chẩn đoán column. */
export const diagnosisLabel = (row: QuoteRow) =>
  [row.teeth, row.diagnosis].filter(Boolean).join(" - ") || "-";

export function toQuoteRow(
  row: PatientAdviseDto,
  slips: ReadonlyMap<string, PatientDiagnosisDto>,
): QuoteRow {
  return {
    id: row.id,
    service: row.serviceName ?? "",
    diagnosis: row.diagnosisName ?? "",
    teeth: row.teeth.length === 0 ? "" : formatTeeth(row.teeth),
    quantity: row.quantity,
    unitPrice: row.price,
    clinicDiscount: row.discountAmount,
    voucherDiscount: row.voucherDiscountAmount ?? 0,
    diagnosisContent: slips.get(row.patientDiagnosisId)?.note?.trim() ?? "",
    doctors: [row.staffName, row.secondStaffName].map((name) => name?.trim() ?? "").filter(Boolean),
  };
}

export function quoteTotals(rows: QuoteRow[], extra: number): QuoteTotals {
  const gross = rows.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
  const discount = rows.reduce((sum, row) => sum + rowDiscount(row), 0);
  return { gross, discount, extra, net: Math.max(0, gross - discount - extra) };
}

/** 1 → "I", 4 → "IV" — the section numbers on the diagnosis sheet. */
export function romanNumeral(value: number): string {
  const steps: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = value;
  let out = "";
  for (const [size, glyph] of steps) {
    while (rest >= size) {
      out += glyph;
      rest -= size;
    }
  }
  return out;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A slip note is plain text; the editor and the sheet both speak HTML. */
export function noteToHtml(note: string): string {
  return note
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** The reference's stand-in explanation when a slip carries no content. */
export function defaultExplanationHtml(): string {
  return [
    "<p>Cùng với việc kiểm tra các mô nha chu, tình trạng vệ sinh răng miệng của bệnh nhân cũng phải được đánh giá. Sự hiện diện của mảng sinh học được ghi nhận theo từng bề mặt răng trong quá trình thăm khám.</p>",
    "<p>Nội dung tư vấn, chỉ định điều trị và các lưu ý sau điều trị sẽ được cập nhật tại đây trước khi in dịch vụ.</p>",
  ].join("");
}

/** One block per diagnosis, in first-seen order, with a doctor card per row. */
export function groupByDiagnosis(rows: QuoteRow[]): DiagnosisGroup[] {
  const groups = new Map<string, DiagnosisGroup>();
  for (const row of rows) {
    const name = row.diagnosis || "-";
    let group = groups.get(name);
    if (!group) {
      group = { name, services: [], doctors: [] };
      groups.set(name, group);
    }
    group.services.push(row);
    group.doctors.push({
      key: `${name}::${group.doctors.length}`,
      doctor: row.doctors.join(", ") || "-",
      teeth: row.teeth,
      diagnosisLabel: row.diagnosis || "-",
      explanationHtml: row.diagnosisContent
        ? noteToHtml(row.diagnosisContent)
        : defaultExplanationHtml(),
    });
  }
  return Array.from(groups.values());
}

/**
 * Quill 2 writes every space as `&nbsp;`, so a paragraph it produced cannot
 * wrap and copies out with the entities in it. Give each run of spaces one
 * ordinary space at its end: single spaces become plain again, deliberate
 * runs still render as wide.
 */
export function normalizeEditorHtml(html: string): string {
  return html.replace(/(?:&nbsp;|\u00a0)+/g, (run) => {
    const count = run.replace(/\u00a0/g, "&nbsp;").length / "&nbsp;".length;
    return "&nbsp;".repeat(count - 1) + " ";
  });
}

/** Plain text of a fragment of editor HTML, one line per block. */
export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(doc.body.children);
  const lines =
    blocks.length > 0 ? blocks.map((el) => el.textContent ?? "") : [doc.body.textContent ?? ""];
  return lines
    .map((line) => line.replace(/\u00a0/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
