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

import { parsePhone } from "@/components/PhoneInput/phoneValue";

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
  /** The primary guardian's name alone, and only for a patient under 18. */
  minorGuardianName?: string;
  country?: string;
  /** "male" / "female" / "other", or their Vietnamese names. */
  gender?: string;
}

export interface SheetBranch {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
}

/**
 * A phone as the sheets print it: a Vietnamese number with its leading 0
 * (clinic, 2026-10-16). "+84 912…" reads "0912…", and a number kept without
 * its 0 — "912345678", as imported records carry them — gets it back. A
 * foreign number keeps its country code.
 */
export function sheetPhone(value: string | null | undefined): string | undefined {
  const phone = value?.trim();
  if (!phone) return undefined;
  if (phone.startsWith("+")) return parsePhone(phone).national;
  return /^[1-9]/.test(phone) ? `0${phone}` : phone;
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

/** What Tiền sử bệnh says when the hồ sơ records nothing (clinic, 2026-11-09). */
const NOTHING_ABNORMAL = "Chưa phát hiện gì bất thường";

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
  put(values, "patient.minorGuardianName", facts.minorGuardianName);

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
  // The cover prints the ward and province on a line of their own (clinic, 2026-10-16).
  alias("cover.patient.address", "patient.addressStreet");
  alias("cover.patient.ward", "patient.ward");
  alias("cover.patient.province", "patient.province");
  alias("consultation.text.1", "patient.code");
  alias("consultation.text.2", "patient.cccd");
  alias("consultation.text.51", "patient.name");
  alias("consultation.text.54", "patient.name");
  alias("consultation.text.56", "patient.name");
  alias("orthodontic.text.2", "patient.cccd");
  // Bệnh án chỉnh nha: the name under NGƯỜI BỆNH/THÂN NHÂN (clinic, 2026-11-10).
  alias("orthodontic.text.114", "patient.name");
  alias("general-consultation.text.10", "patient.nameUppercase");
  alias("general-consultation.text.11", "patient.birthYear");
  alias("general-consultation.text.12", "patient.address");
  alias("general-consultation.text.13", "patient.code");

  /*
   * Bệnh án ngoại trú splits the address over Số nhà / Xã, phường / Tỉnh. Its
   * Số nhà blank asks for the whole address by source, so it is answered by id
   * with the street alone — the ward and province have blanks of their own.
   * The printed Thôn, phố and Huyện blanks were dropped: the 2025 two-level
   * units have neither (clinic, 2026-10-16).
   */
  if (values["patient.address"] !== undefined) {
    // Even empty: left unanswered it would fall back to the whole address.
    values["outpatient.patient.address"] = values["patient.addressStreet"] ?? "";
  }
  alias("outpatient-dental.text.5", "patient.ward");
  alias("outpatient-dental.text.7", "patient.province");

  /*
   * Clinic, 2026-10-16: "II. Lý do vào viện" is the hồ sơ's Lý do đến khám —
   * its first line, the second stays for the pen.
   */
  alias("custom.text.66d78a3bbe7442658cecbf611b7b286d", "patient.reason");

  /*
   * Tiền sử bệnh (clinic, 2026-11-09): "+ Bản thân" reads the disease history
   * from Danh mục, else "Chưa phát hiện gì bất thường". "+ Gia đình" is the
   * family's illnesses, which the hồ sơ does not keep, so it always starts as
   * "Chưa phát hiện gì bất thường" for the doctor to write over. It printed the
   * primary guardian's name and phone from 2026-10-16 until the clinic asked
   * who had put it there (2026-11-10, R-1195).
   */
  values["outpatient.patient.history"] = values["patient.history"] ?? NOTHING_ABNORMAL;
  values["outpatient-dental.text.23"] = NOTHING_ABNORMAL;

  // Giấy đồng ý phẫu thuật/thủ thuật: "… cho người bệnh:".
  alias("surgery-consent.text.3", "patient.name");

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
 * 2026-10-14). So is "Giấy đồng ý thực hiện phẫu thuật/thủ thuật": a patient
 * may carry many diagnosis slips and the sheet cannot tell which one the
 * operation is for, so the doctor writes it (clinic, 2026-10-16). The contract
 * (mẫu 10) takes it as Bệnh án chỉnh nha does — until the set has a mẫu 3,
 * whose VIII it then copies (contractFromOrthodontic, R-1097).
 */
const DIAGNOSIS_FIELDS = [
  "outpatient-dental.text.43",
  "orthodontic.text.86",
  "custom.text.9959ffa6f36f45b89e42d5a486996216",
  "procedure-record.text.1",
  "care.diagnosis",
  "orthodontic-contract.text.7",
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

/**
 * "MS:" — the form code printed in the corner of a sheet (clinic, 2026-10-27).
 * Fixed (BA, 2026-10-29, R-1069): the blank cannot be typed in, and a sheet
 * that wrote another code before shows this one all the same — see renderSheet.
 */
export const FORM_CODE_VALUES: Readonly<FieldValues> = {
  // Bệnh án ngoại trú Răng Hàm Mặt
  "custom.text.8b780086e4014a049f87decd95bffaf3": "16/BV-01",
  // Giấy đồng ý thực hiện phẫu thuật/thủ thuật
  "custom.text.6d1c4222d1b041c1aff9becd446183e1": "01/BV2",
  // Phiếu phẫu thuật/thủ thuật
  "custom.text.8d7eb5b7fe9746b3909ce9c21ba46a31": "PT-11",
};

/**
 * Blanks the clinic fills the same on nearly every sheet: Bệnh án ngoại trú
 * Răng Hàm Mặt (clinic, 2026-11-09) and the doctor's name on Bệnh án chỉnh nha
 * (2026-11-10). Blanks, not print: a sheet writes over any of them and keeps
 * what it wrote — an unticked "Tự đến" is saved as unticked.
 */
export const SHEET_DEFAULT_VALUES: Readonly<FieldValues> = {
  // 5. Dân tộc
  "outpatient-dental.text.3": "Kinh",
  // 13. Chẩn đoán và xử lý của nơi giới thiệu: 2. Tự đến
  "outpatient-dental.checkbox.6": true,
  // Họ và tên under GIÁM ĐỐC PHÒNG KHÁM
  "outpatient-dental.text.59": "BS.CKII. BÙI VĂN TỚI",
  // Bệnh án chỉnh nha: Họ và tên under BÁC SĨ — the slip's doctor once the set has one (sheetFacts)
  "orthodontic.text.112": "BS.CKII. BÙI VĂN TỚI",
};

/**
 * Bên A on the contract (mẫu 10) as the clinic's .docx prints it. The company,
 * its tax code and its representative are this text (clinic, 2026-11-03,
 * R-1139); Địa chỉ and Điện thoại are the branch settings' own fields, and this
 * text only where the branch has none.
 */
export const CONTRACT_PARTY_A = {
  name: "Công ty Cổ phần dịch vụ Nha Khoa Đức Hạnh",
  address: "84 – 86 Phạm Ngọc Thạch, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh",
  phone: "0906.884.440",
  taxCode: "0318531468",
  representative: "Bác sĩ Bùi Văn Tới – Bác sĩ phụ trách",
} as const;

/**
 * What Bên A's blanks start with. They are blanks, not print: a sheet may write
 * over any of them and keeps what it wrote. A line left as it was is not saved
 * (MedicalRecordDocument keeps only what differs), so it follows the settings.
 */
export function contractPartyAValues(branch: SheetBranch | undefined): FieldValues {
  return {
    "contract.partyA.name": CONTRACT_PARTY_A.name,
    "contract.partyA.address": branch?.address?.trim() || CONTRACT_PARTY_A.address,
    "contract.partyA.phone": branch?.phone?.trim() || CONTRACT_PARTY_A.phone,
    "contract.partyA.taxCode": CONTRACT_PARTY_A.taxCode,
    "contract.partyA.representative": CONTRACT_PARTY_A.representative,
  };
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
