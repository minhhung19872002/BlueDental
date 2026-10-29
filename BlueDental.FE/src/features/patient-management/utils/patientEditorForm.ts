import dayjs, { type Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import { GENDER_BY_CODE } from "../api/patientAdapters";
import type {
  Gender,
  PatientDto,
  PatientPrefill,
  PhoneGuardian,
  RegisterPatientRequest,
} from "../types/patient";

export interface PatientFormValues {
  codeSequence: string;
  createdAtLabel: string;
  fullName: string;
  uppercase: boolean;
  phone: string;
  sourceTaxonomyId?: string;
  sourceEntryId?: string;
  examinationReason: string;
  gender: Gender;
  dateOfBirth: Dayjs | null;
  email: string;
  note: string;
  occupationEntryId?: string;
  /** Free text behind the occupation list's "Khác"; absent until it is ticked. */
  occupationOther?: string;
  nationalId: string;
  insuranceNumber: string;
  country: string;
  address: string;
  provinceCode?: string;
  wardCode?: string;
  /** Địa chỉ cũ — the pre-2025 address off the CCCD, kept apart from the new one. */
  oldAddress: string;
}

/** The server's refusal of a "Mã khách hàng" another record already holds. */
export const DUPLICATE_PATIENT_CODE = "BlueDental:Patient:0002";
/** The server's refusal of a CCCD another record in the branch already holds. */
export const DUPLICATE_NATIONAL_ID = "BlueDental:Patient:0012";
export const INVALID_NAME = "BlueDental:Patient:0020";
export const DUPLICATE_PHONE = "BlueDental:Patient:0021";
/** P2710_02: the same name already on the number. */
export const DUPLICATE_NAME_ON_PHONE = "BlueDental:Patient:0035";
/** P2710_02: "Là … của …" missing (0033), naming someone off the number or too young (0034), or a relation that may not be. */
export const SHARED_PHONE_LINK_ERROR = /^BlueDental:(Patient:003[34]|PatientRelation:0003)$/;
/** The server's guardian refusals (Patient:0013–0019) — shown on the guardian pane. */
export const GUARDIAN_ERROR = /^BlueDental:Patient:001[3-9]$/;

export const EMPTY_PATIENT_FORM: PatientFormValues = {
  codeSequence: "",
  createdAtLabel: "",
  fullName: "",
  uppercase: false,
  phone: "",
  sourceTaxonomyId: undefined,
  sourceEntryId: undefined,
  examinationReason: "",
  gender: "male",
  dateOfBirth: null,
  email: "",
  note: "",
  occupationEntryId: undefined,
  occupationOther: "",
  nationalId: "",
  insuranceNumber: "",
  country: "",
  address: "",
  provinceCode: undefined,
  wardCode: undefined,
  oldAddress: "",
};

/**
 * "Lê Thị Liên" from "LÊ THỊ LIÊN".
 *
 * Unticking "IN HOA" has to put the name back the way a name is written, not
 * just stop shouting future keystrokes. Cased with the Vietnamese locale so the
 * diacritics survive the round trip.
 */
export function titleCaseName(name: string): string {
  return name
    .toLocaleLowerCase("vi")
    .split(/(\s+)/)
    .map((part) =>
      /\s/.test(part) ? part : part.charAt(0).toLocaleUpperCase("vi") + part.slice(1),
    )
    .join("");
}

/**
 * A stored code split the way the server builds it and the dialog renders it:
 * a clinic prefix and a two-digit year that are shown but not edited, then the
 * sequence that is. A code that does not fit that shape is left whole in the
 * editable half rather than being silently cut somewhere arbitrary.
 */
export function splitPatientCode(code: string): { prefix: string; sequence: string } {
  const match = /^(\D+\d{2})(\d+)$/.exec(code);
  return match ? { prefix: match[1], sequence: match[2] } : { prefix: "", sequence: code };
}

/** A scanned CCCD (or a walk-in's details) laid over an empty form; the desk reviews it before saving. */
export function valuesFromPrefill(prefill: PatientPrefill): Partial<PatientFormValues> {
  return {
    nationalId: prefill.nationalId ?? "",
    fullName: prefill.fullName ?? "",
    phone: prefill.phone ?? "",
    // Cards print the name in capitals, so the IN HOA tick follows suit.
    uppercase: Boolean(prefill.fullName && prefill.fullName === prefill.fullName.toLocaleUpperCase("vi")),
    dateOfBirth: prefill.dateOfBirth ? dayjs(prefill.dateOfBirth) : null,
    gender: prefill.gender ?? EMPTY_PATIENT_FORM.gender,
    address: prefill.address ?? "",
    provinceCode: prefill.provinceCode,
    wardCode: prefill.wardCode,
    oldAddress: prefill.oldAddress ?? "",
  };
}

export function valuesFromPatient(patient: PatientDto, codeSequence: string): PatientFormValues {
  return {
    ...EMPTY_PATIENT_FORM,
    codeSequence,
    createdAtLabel: dayjs(patient.creationTime).format("DD/MM/YYYY"),
    fullName: patient.fullName,
    uppercase: patient.fullName === patient.fullName.toUpperCase(),
    phone: patient.phoneNumber ?? "",
    sourceTaxonomyId: patient.sourceTaxonomyId ?? undefined,
    sourceEntryId: patient.sourceEntryId ?? undefined,
    examinationReason: patient.examinationReason ?? "",
    gender: GENDER_BY_CODE[patient.gender] ?? "other",
    dateOfBirth: patient.dateOfBirth ? dayjs(patient.dateOfBirth) : null,
    email: patient.email ?? "",
    note: patient.note ?? "",
    occupationEntryId: patient.occupationEntryId ?? undefined,
    occupationOther: patient.occupationOther ?? "",
    nationalId: patient.nationalId ?? "",
    insuranceNumber: patient.insuranceNumber ?? "",
    country: t("Patient:DefaultCountry"),
    address: patient.address ?? "",
    provinceCode: patient.provinceCode ?? undefined,
    wardCode: patient.wardCode ?? undefined,
    oldAddress: patient.oldAddress ?? "",
  };
}

/**
 * A guardian picked from the phone's dropdown (P2710_02): what they were
 * declared with fills the form once — the desk may still change any of it.
 * The address is the ward's when "cùng địa chỉ" was ticked; the server already
 * resolved that.
 */
export function valuesFromGuardian(guardian: PhoneGuardian): Partial<PatientFormValues> {
  return {
    fullName: guardian.fullName,
    nationalId: guardian.nationalId ?? "",
    dateOfBirth: guardian.dateOfBirth ? dayjs(guardian.dateOfBirth) : null,
    ...(guardian.gender ? { gender: GENDER_BY_CODE[guardian.gender] ?? "other" } : {}),
    email: guardian.email ?? "",
    occupationEntryId: guardian.occupationEntryId ?? undefined,
    address: guardian.address ?? "",
    provinceCode: guardian.provinceCode ?? undefined,
    wardCode: guardian.wardCode ?? undefined,
  };
}

/** What the request carries beside the form's own fields. */
export type PatientPayloadExtras = Pick<
  RegisterPatientRequest,
  | "sourceAppointmentId"
  | "tagIds"
  | "diseaseHistoryEntryIds"
  | "guardians"
  | "guardiansConsented"
  | "sharedPhoneLink"
  | "sourceGuardianId"
>;

export function buildPatientPayload(
  values: PatientFormValues,
  codePrefix: string,
  extras: PatientPayloadExtras,
): RegisterPatientRequest {
  const name = values.fullName.trim();
  const words = name.split(/\s+/).filter(Boolean);

  return {
    // The dialog collects one "Họ và tên"; the record keeps họ and tên apart,
    // so the last word is the given name and the rest the family name.
    lastName: words.length > 1 ? words.slice(0, -1).join(" ") : name,
    firstName: words.length > 1 ? words[words.length - 1] : "",
    dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format("YYYY-MM-DD") : null,
    gender: values.gender,
    phoneNumber: values.phone.trim(),
    email: values.email.trim() || undefined,
    nationalId: values.nationalId.trim() || undefined,
    patientCode: values.codeSequence.trim() ? `${codePrefix}${values.codeSequence.trim()}` : undefined,
    sourceTaxonomyId: values.sourceTaxonomyId ?? null,
    sourceEntryId: values.sourceEntryId ?? null,
    occupationEntryId: values.occupationEntryId ?? null,
    // Only registered once "Khác" is ticked, so it can be absent entirely.
    occupationOther: values.occupationOther?.trim() || null,
    insuranceNumber: values.insuranceNumber.trim() || null,
    address: values.address.trim() || null,
    provinceCode: values.provinceCode ?? null,
    wardCode: values.wardCode ?? null,
    oldAddress: values.oldAddress.trim() || null,
    examinationReason: values.examinationReason.trim() || null,
    note: values.note.trim() || null,
    ...extras,
  };
}
