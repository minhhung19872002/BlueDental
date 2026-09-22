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
  address?: string;
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
 * Address and country are deliberately absent: the reference declares blanks
 * for them but never fills them, leaving the clinic to write the address by
 * hand on the printed sheet.
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
   * The cover and the consultation sheet were drawn before `data-field-source`
   * existed, so their blanks carry no source and have to be named one by one.
   * Address is not among them on purpose — see above.
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
  alias("consultation.text.2", "patient.cccd");
  alias("consultation.text.51", "patient.name");
  alias("consultation.text.54", "patient.name");
  alias("consultation.text.56", "patient.name");

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
