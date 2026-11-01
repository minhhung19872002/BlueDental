import dayjs from "dayjs";
import type {
  SheetFactsDto,
  SheetFactsPlanDto,
  SheetFactsServiceDto,
  SheetFactsVisitDto,
} from "../../../api/medicalRecordSetApi";
import { noteLines } from "../stage/stageNoteLines";
import type { FieldValues } from "./fieldValues";
import { costRowFieldIds } from "./rowEditing";

/**
 * What the sheets of a bộ hồ sơ print about its treatment slips — the clinic's
 * mapping in save/P1810.drawio (2026-10-18), blank by blank.
 *
 * "MS" is not one of them: it is the form's own code (`FORM_CODE_VALUES`).
 */

/** How the caller names a set of teeth: "16, 17", or "Hàm trên" for a whole jaw. */
export type TeethLabel = (toothCodes: readonly number[]) => string;

/** Formats the sheets print in, given as they are so this stays a pure mapping. */
export interface SheetFactFormats {
  teeth: TeethLabel;
  /** "1.200.000". */
  money: (amount: number) => string;
  /** "Một triệu hai trăm nghìn đồng". */
  moneyWords: (amount: number) => string;
  /** Breaks mẫu 5's Chẩn đoán into the full-width lines of the form. */
  consentLines: (text: string) => string[];
}

/** Mẫu 5, II. Chẩn đoán: the two printed lines, then lines added under the second. */
const CONSENT_DIAGNOSIS_LINES = ["consultation.text.5", "consultation.text.6"];

/** Bệnh án chỉnh nha, IX. Kế hoạch điều trị: the seven lines under "Loại mắc cài". */
const ORTHODONTIC_PLAN_LINES = Array.from({ length: 7 }, (_, at) => `orthodontic.text.${105 + at}`);

/** Mẫu 10, "- Kế hoạch điều trị:": the blank after the label and the four lines under it. */
const CONTRACT_PLAN_LINES = Array.from({ length: 5 }, (_, at) => `orthodontic-contract.text.${11 + at}`);

/** Mẫu 10, II. Chi phí niềng răng: Chi phí ban đầu, Giảm giá, Chi phí sau giảm giá. */
const CONTRACT_COST = {
  gross: "orthodontic-contract.text.25",
  discount: "orthodontic-contract.text.26",
  total: "orthodontic-contract.text.27",
} as const;

const TRACKING_ROW = (row: number, cell: string) => `treatment-tracking.page-1.row-${row}.${cell}`;

function put(values: FieldValues, key: string, value: string | null | undefined) {
  const trimmed = value?.trim();
  if (trimmed) values[key] = trimmed;
}

const distinct = (items: readonly (string | null | undefined)[]) =>
  [...new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))];

/** "K12.2 - Viêm mô tế bào và áp xe miệng", or the name alone when Danh mục gives no code. */
function diagnosisLabel(item: { diagnosisCode: string | null; diagnosisName: string | null }): string {
  return [item.diagnosisCode, item.diagnosisName].map((part) => part?.trim()).filter(Boolean).join(" - ");
}

/** "Răng 16, 17 - Chữa tủy răng cối 2 ống tủy" — the drawio's "{Răng} - {dịch vụ}". */
function serviceLine(service: SheetFactsServiceDto, teeth: TeethLabel): string {
  const label = service.toothCodes.length ? teeth(service.toothCodes) : "";
  if (!label) return service.serviceName;
  const named = /^\d/.test(label) ? `Răng ${label}` : label;
  return `${named} - ${service.serviceName}`;
}

/** "DD", "MM" and the year's last two digits — the blanks printed after "/20". */
function dayParts(day: string | null): [string, string, string] | null {
  if (!day) return null;
  const parsed = dayjs(day);
  return parsed.isValid() ? [parsed.format("DD"), parsed.format("MM"), parsed.format("YY")] : null;
}

function putDay(values: FieldValues, keys: readonly [string, string, string], day: string | null) {
  const parts = dayParts(day);
  if (!parts) return;
  keys.forEach((key, at) => put(values, key, parts[at]));
}

/**
 * Lines into a form's printed blanks, one each; past the last, lines added
 * under it, as Enter adds them (`custom.line.<anchor>.<n>`).
 */
function putLines(values: FieldValues, printed: readonly string[], lines: readonly string[]) {
  lines.forEach((line, at) => {
    const blank = printed[at];
    if (blank) put(values, blank, line);
    // Even empty: an added line exists only while it has a value.
    else values[`custom.line.${printed.at(-1)}.${at - printed.length + 1}`] = line;
  });
}

/** Bìa hồ sơ bệnh án. */
function coverValues(facts: SheetFactsDto, values: FieldValues) {
  put(values, "cover.text.1", facts.storageCode);
  // "NĂM 20__": the slip's year, after the printed "20".
  if (facts.year) put(values, "cover.year", String(facts.year % 100).padStart(2, "0"));
  putDay(values, ["cover.text.2", "cover.text.3", "cover.text.4"], facts.treatmentStartDate);
  // Shown only once every service on every slip is finished.
  putDay(values, ["cover.text.5", "cover.text.6", "cover.text.7"], facts.treatmentEndDate);
}

/** The numbers at the top right of Bệnh án ngoại trú, chỉnh nha and Phiếu theo dõi điều trị. */
function numberValues(facts: SheetFactsDto, values: FieldValues) {
  put(values, "outpatient-dental.text.1", facts.outpatientNumber);
  put(values, "outpatient-dental.text.2", facts.storageCode);
  put(values, "orthodontic.text.1", facts.outpatientNumber);
  put(values, "treatment-tracking.page-1.sheet-number", facts.storageCode);
  put(values, "treatment-tracking.page-1.patient.code", facts.outpatientNumber);
}

/**
 * Every service of every slip, one a line, slip by slip and straight on — no
 * slip name above them, no blank line between slips (owner, 2026-11-01, R-1094).
 */
function planLines(facts: SheetFactsDto, teeth: TeethLabel): string[] {
  return facts.plans.flatMap((plan) =>
    facts.services
      .filter((service) => service.treatmentPlanId === plan.treatmentPlanId)
      .map((service) => serviceLine(service, teeth)),
  );
}

/** Bệnh án chỉnh nha, IX; past the seven printed lines the sheet grows lines of its own. */
function orthodonticValues(facts: SheetFactsDto, values: FieldValues, teeth: TeethLabel) {
  putLines(values, ORTHODONTIC_PLAN_LINES, planLines(facts, teeth));
}

/**
 * Hợp đồng thỏa thuận niềng răng (mẫu 10): "- Kế hoạch điều trị" as mẫu 3's IX
 * lists it, and II. Chi phí as the slips' own totals on Kế hoạch điều trị,
 * added up over the set — "45.000.000đ", as the contract writes its fees.
 * Once the set has a mẫu 3, the plan lines are read off that sheet instead
 * (contractFromOrthodontic, R-1097).
 */
function orthodonticContractValues(facts: SheetFactsDto, values: FieldValues, formats: SheetFactFormats) {
  putLines(values, CONTRACT_PLAN_LINES, planLines(facts, formats.teeth));
  if (facts.plans.length === 0) return;

  const sum = (amount: (plan: SheetFactsPlanDto) => number) =>
    facts.plans.reduce((total, plan) => total + amount(plan), 0);
  put(values, CONTRACT_COST.gross, `${formats.money(sum((plan) => plan.grossAmount))}đ`);
  put(values, CONTRACT_COST.discount, `${formats.money(sum((plan) => plan.discountAmount))}đ`);
  put(values, CONTRACT_COST.total, `${formats.money(sum((plan) => plan.totalAmount))}đ`);
}

/**
 * Phiếu Tư Vấn Tổng Quát: "Chúng tôi là: 1. Bác sĩ … Chức vụ …" — the doctor
 * of the oldest slip only, with the Chức vụ of their staff record (not Chức
 * danh). Line 2 is left for the pen (owner, 2026-10-19).
 */
function generalConsultationValues(facts: SheetFactsDto, values: FieldValues) {
  const [first] = facts.plans;
  put(values, "general-consultation.text.6", first?.dentistName);
  put(values, "general-consultation.text.7", first?.dentistPosition);
}

/** Phiếu tư vấn và xác nhận đồng ý điều trị. */
function treatmentConsentValues(facts: SheetFactsDto, values: FieldValues, formats: SheetFactFormats) {
  // Bác sĩ tư vấn and Ngày tư vấn (owner, 2026-10-19): the oldest slip, and of
  // the consulting lines it was opened from, the oldest — its Nhân sự tư vấn 1 and day.
  const firstPlan = facts.plans[0];
  const consulted = facts.services
    .filter((service) => service.treatmentPlanId === firstPlan?.treatmentPlanId && service.consultedAt)
    .sort((a, b) => (a.consultedAt ?? "").localeCompare(b.consultedAt ?? ""))[0];
  if (consulted) {
    put(values, "consultation.text.3", consulted.consultantName);
    // …and the name under VI's "BÁC SĨ TƯ VẤN (ký, ghi rõ họ tên)".
    put(values, "consultation.text.52", consulted.consultantName);
    put(values, "consultation.text.4", dayjs(consulted.consultedAt).format("DD/MM/YYYY"));
  }

  // II. Chẩn đoán as one long run: what does not fit a line goes on to the
  // next dotted line, and past the two printed ones the sheet grows lines.
  const diagnoses = facts.services.map((service) => {
    const label = diagnosisLabel(service);
    if (!label) return "";
    const teeth = service.toothCodes.length ? formats.teeth(service.toothCodes) : "";
    return teeth ? `${teeth} - ${label}` : label;
  });
  putLines(values, CONSENT_DIAGNOSIS_LINES, formats.consentLines(distinct(diagnoses).join("; ")));

  // "1. Bác sĩ điều trị", VII's "Tôi đã được Bác sĩ …" (printed bold) and the
  // name under VII's "BÁC SĨ ĐIỀU TRỊ": the oldest slip's doctor only (owner, 2026-10-19).
  const dentist = facts.plans[0]?.dentistName;
  put(values, "consultation.text.8", dentist);
  put(values, "consultation.text.53", dentist);
  put(values, "consultation.text.57", dentist);

  // IV. Chi phí điều trị: one service a row, then Tổng and the sum in words.
  facts.services.forEach((service, at) => {
    const [serial, content, amount] = costRowFieldIds(at + 1);
    put(values, serial, String(at + 1));
    put(values, content, serviceLine(service, formats.teeth));
    put(values, amount, formats.money(service.amount));
  });
  if (facts.services.length > 0) {
    const total = facts.services.reduce((sum, service) => sum + service.amount, 0);
    put(values, "consultation.text.46", formats.money(total));
    put(values, "consultation.text.47", formats.moneyWords(total));
  }
}

/**
 * Phiếu theo dõi điều trị: every công đoạn of every slip, oldest first.
 *
 * A day is one block (drawio, P1810): its time is printed once, on its first
 * row; each diagnosis worked that day is a row of its own, with what was done
 * for it beside it — "Dịch vụ: …", then a line per tooth.
 */
function treatmentTrackingValues(facts: SheetFactsDto, values: FieldValues, teeth: TeethLabel) {
  const days = new Map<string, SheetFactsVisitDto[]>();
  for (const visit of facts.visits) {
    days.set(visit.treatmentDate, [...(days.get(visit.treatmentDate) ?? []), visit]);
  }

  let row = 0;
  for (const [day, visits] of days) {
    const byDiagnosis = new Map<string, SheetFactsVisitDto[]>();
    for (const visit of visits) {
      const key = diagnosisLabel(visit);
      byDiagnosis.set(key, [...(byDiagnosis.get(key) ?? []), visit]);
    }

    // Ngày, giờ: when the first công đoạn of every service worked that day was
    // written (owner, 2026-10-19) — printed once, on the day's first row.
    const firstWorked = visits.reduce((first, visit) => (visit.recordedAt < first.recordedAt ? visit : first));
    const when = `${dayjs(day).format("DD/MM/YYYY")} ${dayjs(firstWorked.recordedAt).format("HH:mm")}`;

    let firstOfDay = true;
    for (const [diagnosis, worked] of byDiagnosis) {
      row += 1;
      if (firstOfDay) {
        put(values, TRACKING_ROW(row, "date-time"), when);
        firstOfDay = false;
      }
      put(values, TRACKING_ROW(row, "diagnosis-progress"), diagnosis);
      put(values, TRACKING_ROW(row, "treatment-detail"), treatmentDetail(worked, teeth));
    }
  }
}

/**
 * "Dịch vụ: Chữa tủy" then "- Răng 16 - Lấy tủy", one line per công đoạn,
 * service by service. The công đoạn are listed under their service, each
 * opening with "-"; the service line heads them and takes none (owner,
 * 2026-10-19). A line that only runs on past the cell's width takes none either.
 */
function treatmentDetail(visits: readonly SheetFactsVisitDto[], teeth: TeethLabel): string {
  const byService = new Map<string, SheetFactsVisitDto[]>();
  for (const visit of visits) {
    byService.set(visit.serviceName, [...(byService.get(visit.serviceName) ?? []), visit]);
  }

  const lines: string[] = [];
  for (const [service, worked] of byService) {
    lines.push(`Dịch vụ: ${service}`);
    for (const visit of worked) {
      const label = visit.toothCodes.length ? teeth(visit.toothCodes) : "";
      const tooth = label && /^\d/.test(label) ? `Răng ${label}` : label;
      // Nội dung điều trị is written as a bulleted list now (R-983); on the
      // sheet its points read on one line, "Răng 16 - Chữa tủy, cạo vôi răng".
      const content = noteLines(visit.content).join(", ");
      const line = [tooth, content].filter(Boolean).join(" - ");
      if (line) lines.push(`- ${line}`);
    }
  }
  return lines.join("\n");
}

/** Every blank the set's slips answer, across the forms. */
export function sheetFactFieldValues(facts: SheetFactsDto | undefined, formats: SheetFactFormats): FieldValues {
  const values: FieldValues = {};
  if (!facts) return values;

  coverValues(facts, values);
  numberValues(facts, values);
  orthodonticValues(facts, values, formats.teeth);
  generalConsultationValues(facts, values);
  treatmentConsentValues(facts, values, formats);
  treatmentTrackingValues(facts, values, formats.teeth);
  orthodonticContractValues(facts, values, formats);
  return values;
}
