import dayjs, { type Dayjs } from "dayjs";
import { GENDER_BY_CODE } from "../api/patientAdapters";
import {
  GENDER,
  GUARDIAN_LIMITS,
  GUARDIAN_PROOF_TYPE,
  GUARDIAN_RELATION,
  type Gender,
  type GenderCode,
  type GuardianProofTypeCode,
  type GuardianRelationCode,
  type PatientDto,
  type PatientGuardianDto,
  type PatientGuardianInput,
} from "../types/patient";

/**
 * One người giám hộ as the popup edits it. Dates are Dayjs for the pickers and
 * text fields are never null, so the AntD form always holds a controlled value.
 */
export interface GuardianDraft {
  /** The popup's own handle for the row — React key and accordion key. Never sent. */
  uid: string;
  /** The record on file; null until the hồ sơ is saved with it. */
  id: string | null;
  linkedPatientId: string | null;
  relation?: GuardianRelationCode;
  relationNote: string;
  proofType?: GuardianProofTypeCode;
  proofBlobName: string | null;
  proofFileName: string | null;
  fullName: string;
  phone: string;
  nationalId: string;
  dateOfBirth: Dayjs | null;
  idIssuedOn: Dayjs | null;
  idIssuedPlace: string;
  gender?: Gender;
  email: string;
  occupationEntryId?: string;
  sameAddressAsPatient: boolean;
  address: string;
  isPrimaryContact: boolean;
}

/** The guardian group the hồ sơ dialog carries until its own Lưu. */
export interface GuardianGroup {
  guardians: GuardianDraft[];
  /** "Các người giám hộ xác nhận thông tin chính xác và đồng ý …" — one tick for the group. */
  consented: boolean;
}

export const EMPTY_GUARDIAN_GROUP: GuardianGroup = { guardians: [], consented: false };

/** The relation pills' i18n keys; the pills list them in code order, the BA's order. */
export const RELATION_LABEL: Record<GuardianRelationCode, string> = {
  [GUARDIAN_RELATION.Father]: "Patient:Guardian:Relation:Father",
  [GUARDIAN_RELATION.Mother]: "Patient:Guardian:Relation:Mother",
  [GUARDIAN_RELATION.Grandfather]: "Patient:Guardian:Relation:Grandfather",
  [GUARDIAN_RELATION.Grandmother]: "Patient:Guardian:Relation:Grandmother",
  [GUARDIAN_RELATION.Sibling]: "Patient:Guardian:Relation:Sibling",
  [GUARDIAN_RELATION.AuntUncle]: "Patient:Guardian:Relation:AuntUncle",
  [GUARDIAN_RELATION.LegalGuardian]: "Patient:Guardian:Relation:LegalGuardian",
  [GUARDIAN_RELATION.Other]: "Patient:Guardian:Relation:Other",
};

export const RELATION_OPTIONS = Object.values(GUARDIAN_RELATION).map((value) => ({
  value,
  label: RELATION_LABEL[value],
}));

export const PROOF_TYPE_OPTIONS: { value: GuardianProofTypeCode; label: string }[] = [
  { value: GUARDIAN_PROOF_TYPE.PowerOfAttorney, label: "Patient:Guardian:Proof:PowerOfAttorney" },
  { value: GUARDIAN_PROOF_TYPE.GuardianshipDecision, label: "Patient:Guardian:Proof:GuardianshipDecision" },
  { value: GUARDIAN_PROOF_TYPE.BirthCertificate, label: "Patient:Guardian:Proof:BirthCertificate" },
  { value: GUARDIAN_PROOF_TYPE.Other, label: "Patient:Guardian:Proof:Other" },
];

/** The file types the server accepts behind "Tải ảnh / PDF giấy tờ". */
export const GUARDIAN_FILE_ACCEPT = ".jpg,.jpeg,.png,.pdf";
const GUARDIAN_FILE_PATTERN = /\.(jpe?g|png|pdf)$/i;

/** The i18n key of what is wrong with a chosen paper, or null when it may be uploaded. */
export function guardianFileProblem(file: File): string | null {
  if (!GUARDIAN_FILE_PATTERN.test(file.name)) return "Patient:Guardian:FileType";
  if (file.size > GUARDIAN_LIMITS.maxProofFileBytes) return "Patient:Guardian:FileSize";
  return null;
}

/** Age as the BA counts it: this year minus the birth year, birthday or not. */
export function ageByYear(dateOfBirth: Dayjs | string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const born = dayjs(dateOfBirth);
  return born.isValid() ? dayjs().year() - born.year() : null;
}

export function requiresGuardian(age: number | null): boolean {
  return age !== null && age < GUARDIAN_LIMITS.requiredUnderAge;
}

let uidSequence = 0;
const nextUid = () => `guardian-${++uidSequence}`;

export function emptyGuardian(isPrimaryContact: boolean): GuardianDraft {
  return {
    uid: nextUid(),
    id: null,
    linkedPatientId: null,
    relation: undefined,
    relationNote: "",
    proofType: undefined,
    proofBlobName: null,
    proofFileName: null,
    fullName: "",
    phone: "",
    nationalId: "",
    dateOfBirth: null,
    idIssuedOn: null,
    idIssuedPlace: "",
    gender: undefined,
    email: "",
    occupationEntryId: undefined,
    sameAddressAsPatient: true,
    address: "",
    isPrimaryContact,
  };
}

export function guardianFromDto(dto: PatientGuardianDto): GuardianDraft {
  return {
    uid: nextUid(),
    id: dto.id,
    linkedPatientId: dto.linkedPatientId,
    relation: dto.relation,
    relationNote: dto.relationNote ?? "",
    proofType: dto.proofType ?? undefined,
    proofBlobName: dto.proofBlobName,
    proofFileName: dto.proofFileName,
    fullName: dto.fullName,
    phone: dto.phone,
    nationalId: dto.nationalId,
    dateOfBirth: dto.dateOfBirth ? dayjs(dto.dateOfBirth) : null,
    idIssuedOn: dto.idIssuedOn ? dayjs(dto.idIssuedOn) : null,
    idIssuedPlace: dto.idIssuedPlace ?? "",
    gender: dto.gender ? GENDER_BY_CODE[dto.gender] : undefined,
    email: dto.email ?? "",
    occupationEntryId: dto.occupationEntryId ?? undefined,
    sameAddressAsPatient: dto.sameAddressAsPatient,
    address: dto.address ?? "",
    isPrimaryContact: dto.isPrimaryContact,
  };
}

/**
 * "Tìm & điền": an existing hồ sơ's details over the guardian being typed.
 * The relation, address choice and primary tick stay the desk's to decide.
 */
export function fillGuardianFromPatient(draft: GuardianDraft, patient: PatientDto): GuardianDraft {
  return {
    ...draft,
    linkedPatientId: patient.id,
    fullName: patient.fullName,
    phone: patient.phoneNumber ?? "",
    nationalId: patient.nationalId ?? "",
    dateOfBirth: patient.dateOfBirth ? dayjs(patient.dateOfBirth) : null,
    gender: GENDER_BY_CODE[patient.gender],
    email: patient.email ?? "",
    occupationEntryId: patient.occupationEntryId ?? undefined,
  };
}

const GENDER_CODE: Record<Gender, GenderCode> = {
  male: GENDER.Male,
  female: GENDER.Female,
  other: GENDER.Other,
};

const formatDate = (value: Dayjs | null) => (value ? value.format("YYYY-MM-DD") : null);
const orNull = (value: string) => value.trim() || null;

export function guardianToInput(draft: GuardianDraft): PatientGuardianInput {
  const isOther = draft.relation === GUARDIAN_RELATION.Other;

  return {
    id: draft.id,
    linkedPatientId: draft.linkedPatientId,
    // The form refuses a guardian without a relation, so this only types the gap.
    relation: draft.relation ?? GUARDIAN_RELATION.LegalGuardian,
    relationNote: isOther ? orNull(draft.relationNote) : null,
    proofType: isOther ? draft.proofType ?? null : null,
    proofBlobName: isOther ? draft.proofBlobName : null,
    proofFileName: isOther ? draft.proofFileName : null,
    fullName: draft.fullName.trim(),
    phone: draft.phone.trim(),
    nationalId: draft.nationalId.trim(),
    dateOfBirth: formatDate(draft.dateOfBirth),
    idIssuedOn: formatDate(draft.idIssuedOn),
    idIssuedPlace: orNull(draft.idIssuedPlace),
    gender: draft.gender ? GENDER_CODE[draft.gender] : null,
    email: orNull(draft.email),
    occupationEntryId: draft.occupationEntryId ?? null,
    sameAddressAsPatient: draft.sameAddressAsPatient,
    address: draft.sameAddressAsPatient ? null : orNull(draft.address),
    isPrimaryContact: draft.isPrimaryContact,
  };
}

/** What the accordion header reports: everything the server requires is in. */
export function isGuardianComplete(draft: GuardianDraft | undefined): boolean {
  if (!draft) return false;
  const filled = [draft.fullName, draft.phone, draft.nationalId].every((value) => value?.trim());
  if (!filled || draft.relation === undefined) return false;
  if (draft.relation !== GUARDIAN_RELATION.Other) return true;
  return Boolean(draft.relationNote?.trim()) && draft.proofType !== undefined;
}

/** "079 186 xxx xxx" — the card shows where the number starts, not the number. */
export function maskNationalId(value: string): string {
  const digits = value.replace(/\s+/g, "");
  if (digits.length <= 6) return digits;
  const hidden = digits.slice(6).replace(/./g, "x");
  return [digits.slice(0, 3), digits.slice(3, 6), ...(hidden.match(/.{1,3}/g) ?? [])].join(" ");
}

/** "079 186 ••• 214" — the Hồ sơ tab's card: where the number starts and how it ends. */
export function maskNationalIdEnds(value: string): string {
  const digits = value.replace(/\s+/g, "");
  if (digits.length <= 9) return maskNationalId(digits);
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ••• ${digits.slice(-3)}`;
}

/** "0909 000 222" — a 10-digit phone grouped 4-3-3; anything else as typed. */
export function formatPhoneGroups(value: string): string {
  const digits = value.replace(/\s+/g, "");
  return /^\d{10}$/.test(digits) ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : value;
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase("vi");
  return (words[0][0] + words[words.length - 1][0]).toLocaleUpperCase("vi");
}
