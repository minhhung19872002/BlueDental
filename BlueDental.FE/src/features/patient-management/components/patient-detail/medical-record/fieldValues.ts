/**
 * What goes into the blanks on a printed record.
 *
 * A template's blanks are `<span data-medical-record-field="…">` for text and
 * `<input type="checkbox" data-medical-record-field="…">` for boxes. Each may
 * also declare a `data-field-source` — the shared name of the fact it wants, so
 * that eight of the nine forms can ask for `patient.nameUppercase` without
 * repeating the mapping. A blank is filled by its own id first and by its
 * source second, which is what lets a sheet override the record for one print.
 *
 * Measured from the reference on 2026-09-09; see
 * docs/clone/pages/patient-detail.md §Bệnh án.
 */

export type FieldValue = string | boolean;
export type FieldValues = Record<string, FieldValue>;

/** The facts a record can print about the patient, already formatted. */
export interface SheetPatientFacts {
  code?: string;
  name?: string;
  /** `DD/MM/YYYY` — the day, month and year blanks are split off it. */
  dateOfBirth?: string;
  age?: string;
  phone?: string;
  cccd?: string;
  email?: string;
  /** "Số nhà, Phường, Tỉnh" — the whole address on one line. */
  address?: string;
  /** The three parts, for the form that prints them in separate blanks. */
  addressStreet?: string;
  ward?: string;
  province?: string;
  job?: string;
  reason?: string;
  history?: string;
  note?: string;
  insuranceNumber?: string;
  country?: string;
  /** "male" / "female" / "other", or their Vietnamese names. */
  gender?: string;
}

export interface SheetBranch {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
}

function put(values: FieldValues, key: string, value: string | null | undefined) {
  const trimmed = value?.trim();
  if (trimmed) values[key] = trimmed;
}

/** Strips the tone marks so "Nữ", "nu" and "female" all read the same. */
function normalise(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * The record's facts, under the names the templates ask for.
 *
 * The address is filled although the reference leaves it to be written by
 * hand: the clinic asked for it (2026-10-14), since the hồ sơ already holds it.
 * Country still is not — the hồ sơ has nowhere to keep it.
 */
export function patientFieldValues(facts: SheetPatientFacts): FieldValues {
  const values: FieldValues = {};

  put(values, "patient.code", facts.code);
  put(values, "patient.name", facts.name);
  put(values, "patient.nameUppercase", facts.name?.toUpperCase());
  put(values, "patient.dateOfBirth", facts.dateOfBirth);
  put(values, "patient.age", facts.age);
  put(values, "patient.phone", facts.phone);
  put(values, "patient.cccd", facts.cccd);
  put(values, "patient.email", facts.email);
  put(values, "patient.address", facts.address);
  put(values, "patient.addressStreet", facts.addressStreet);
  put(values, "patient.ward", facts.ward);
  put(values, "patient.province", facts.province);
  put(values, "patient.job", facts.job);
  put(values, "patient.reason", facts.reason);
  put(values, "patient.history", facts.history);
  put(values, "patient.note", facts.note);
  put(values, "patient.insuranceNumber", facts.insuranceNumber);

  const parts = facts.dateOfBirth?.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (parts) {
    put(values, "patient.birthDay", parts[1].padStart(2, "0"));
    put(values, "patient.birthMonth", parts[2].padStart(2, "0"));
    put(values, "patient.birthYear", parts[3]);
  }

  const gender = facts.gender ? normalise(facts.gender) : "";
  if (gender) {
    values["patient.genderMale"] = gender === "male" || gender === "nam";
    values["patient.genderFemale"] = gender === "female" || gender === "nu";
    values["patient.genderOther"] = gender === "other" || gender === "khac";
  }

  /*
   * The cover and the consultation sheets were drawn before `data-field-source`
   * existed, so their blanks carry no source and have to be named one by one.
   */
  const alias = (field: string, source: string) => {
    const value = values[source];
    if (value !== undefined) values[field] = value;
  };

  alias("cover.patient.code", "patient.code");
  alias("cover.patient.name", "patient.nameUppercase");
  alias("cover.patient.gender-male", "patient.genderMale");
  alias("cover.patient.gender-female", "patient.genderFemale");
  alias("cover.patient.birth-day", "patient.birthDay");
  alias("cover.patient.birth-month", "patient.birthMonth");
  alias("cover.patient.birth-year", "patient.birthYear");
  alias("cover.patient.age", "patient.age");
  alias("cover.patient.address", "patient.address");
  alias("consultation.text.1", "patient.code");
  alias("consultation.text.2", "patient.cccd");
  alias("consultation.text.51", "patient.name");
  alias("consultation.text.54", "patient.name");
  alias("consultation.text.56", "patient.name");
  alias("orthodontic.text.2", "patient.cccd");
  alias("general-consultation.text.10", "patient.nameUppercase");
  alias("general-consultation.text.11", "patient.birthYear");
  alias("general-consultation.text.12", "patient.address");
  alias("general-consultation.text.13", "patient.code");

  /*
   * Bệnh án ngoại trú splits the address over Số nhà / Thôn, phố / Xã, phường /
   * Huyện / Tỉnh. Its Số nhà blank asks for the whole address by source, so it
   * is answered by id with the street alone — the ward and province have
   * blanks of their own. The hồ sơ keeps no hamlet or district (the 2025
   * two-level units), so those two stay for the pen.
   */
  if (values["patient.address"] !== undefined) {
    // Even empty: left unanswered it would fall back to the whole address.
    values["outpatient.patient.address"] = values["patient.addressStreet"] ?? "";
  }
  alias("outpatient-dental.text.5", "patient.ward");
  alias("outpatient-dental.text.7", "patient.province");

  return values;
}

/**
 * The "Chẩn đoán" blank of each form. Where a form gives the diagnosis several
 * lines, the first takes it; the rest stay free for the doctor's notes.
 *
 * Bệnh án ngoại trú prints the diagnosis of the examining clinic (mục 5), not
 * the referring one's (mục 13) nor the discharge one, which the clinic writes
 * when the record is closed. "Phiếu tư vấn và xác nhận đồng ý điều trị" is left
 * out: its "II. CHẨN ĐOÁN" is written by hand at the consultation (clinic,
 * 2026-10-14).
 */
const DIAGNOSIS_FIELDS = [
  "outpatient-dental.text.43",
  "orthodontic.text.86",
  "custom.text.9959ffa6f36f45b89e42d5a486996216",
  "surgery-consent.text.4",
  "procedure-record.text.1",
  "care.diagnosis",
] as const;

/** One diagnosis as a sheet prints it. */
export interface SheetDiagnosis {
  name: string;
  /** "16, 26" — empty when the diagnosis names no tooth. */
  teeth: string;
}

/** "Viêm tủy (răng 16, 26); Sâu răng (răng 11)" into every form's Chẩn đoán. */
export function diagnosisFieldValues(diagnoses: readonly SheetDiagnosis[]): FieldValues {
  const lines = diagnoses
    .filter((item) => item.name.trim())
    .map((item) => {
      if (!item.teeth) return item.name.trim();
      // Tooth numbers read "răng 16, 26"; a whole jaw is already named ("Hàm trên").
      const teeth = /^\d/.test(item.teeth) ? `răng ${item.teeth}` : item.teeth.toLowerCase();
      return `${item.name.trim()} (${teeth})`;
    });
  const text = [...new Set(lines)].join("; ");

  const values: FieldValues = {};
  if (!text) return values;
  for (const field of DIAGNOSIS_FIELDS) values[field] = text;
  return values;
}

/** The letterhead, reached from the templates as `{{branch.name}}` and friends. */
export function branchFieldValues(branch: SheetBranch | undefined): FieldValues {
  const values: FieldValues = {};
  if (!branch) return values;

  put(values, "branch.name", branch.name);
  put(values, "branch.address", branch.address);
  put(values, "branch.phone", branch.phone);
  return values;
}
