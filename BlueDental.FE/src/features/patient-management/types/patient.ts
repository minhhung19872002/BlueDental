export type Gender = "male" | "female" | "other";

/** Matches BlueDental.PatientManagement.Gender (numeric on the wire). */
export const GENDER = { Male: 1, Female: 2, Other: 3, PreferNotToSay: 4 } as const;
export type GenderCode = (typeof GENDER)[keyof typeof GENDER];

/** Matches BlueDental.PatientManagement.PatientStatus. */
export const PATIENT_STATUS = { Active: 1, Inactive: 2, Deceased: 3, Transferred: 4 } as const;
export type PatientStatusCode = (typeof PATIENT_STATUS)[keyof typeof PATIENT_STATUS];

/**
 * Matches BlueDental.PatientManagement.PatientTreatmentStatus. Derived server
 * side from the patient's treatment slips — never stored, never sent back.
 */
export const TREATMENT_STATUS = { None: 1, Created: 2, InProgress: 3, Done: 4 } as const;
export type TreatmentStatusCode = (typeof TREATMENT_STATUS)[keyof typeof TREATMENT_STATUS];

/** Matches BlueDental.PatientManagement.GuardianRelation — the popup's relation pills. */
export const GUARDIAN_RELATION = {
  Father: 1,
  Mother: 2,
  Grandfather: 3,
  Grandmother: 4,
  Sibling: 5,
  AuntUncle: 6,
  LegalGuardian: 7,
  Other: 8,
} as const;
export type GuardianRelationCode = (typeof GUARDIAN_RELATION)[keyof typeof GUARDIAN_RELATION];

/** Matches BlueDental.PatientManagement.GuardianProofType — "Giấy tờ chứng minh quyền giám hộ". */
export const GUARDIAN_PROOF_TYPE = {
  PowerOfAttorney: 1,
  GuardianshipDecision: 2,
  BirthCertificate: 3,
  Other: 4,
} as const;
export type GuardianProofTypeCode = (typeof GUARDIAN_PROOF_TYPE)[keyof typeof GUARDIAN_PROOF_TYPE];

/** PatientGuardianConsts — the BA's limits, enforced again by the server. */
export const GUARDIAN_LIMITS = {
  maxPerPatient: 3,
  /** Age as "năm hiện tại − năm sinh"; below this a guardian is required. */
  requiredUnderAge: 16,
  maxProofFileBytes: 5 * 1024 * 1024,
} as const;

/** Mirrors BlueDental.PatientManagement.PatientGuardianDto. */
export interface PatientGuardianDto {
  id: string;
  linkedPatientId: string | null;
  relation: GuardianRelationCode;
  relationNote: string | null;
  proofType: GuardianProofTypeCode | null;
  proofBlobName: string | null;
  proofFileName: string | null;
  fullName: string;
  phone: string;
  nationalId: string;
  /** "YYYY-MM-DD". */
  dateOfBirth: string | null;
  idIssuedOn: string | null;
  idIssuedPlace: string | null;
  gender: GenderCode | null;
  email: string | null;
  occupationEntryId: string | null;
  sameAddressAsPatient: boolean;
  address: string | null;
  isPrimaryContact: boolean;
  consentedAt: string;
}

/** Mirrors BlueDental.PatientManagement.PatientGuardianInput; no id = a new guardian. */
export type PatientGuardianInput = Omit<PatientGuardianDto, "id" | "consentedAt"> & {
  id: string | null;
};

/** Mirrors BlueDental.PatientManagement.UpdatePatientGuardiansDto — the Hồ sơ tab's guardian block. */
export interface UpdatePatientGuardiansRequest {
  guardians: PatientGuardianInput[];
  guardiansConsented: boolean;
}

/** Mirrors BlueDental.PatientManagement.GuardianCandidateSource. */
export const GUARDIAN_CANDIDATE_SOURCE = {
  Patient: 1,
  Guardian: 2,
} as const;
export type GuardianCandidateSourceCode =
  (typeof GUARDIAN_CANDIDATE_SOURCE)[keyof typeof GUARDIAN_CANDIDATE_SOURCE];

/** Mirrors BlueDental.PatientManagement.GuardianWardDto — a patient a guardian already answers for. */
export interface GuardianWard {
  patientId: string;
  patientCode: string;
  fullName: string;
}

/**
 * Mirrors BlueDental.PatientManagement.GuardianCandidateDto: a hồ sơ, or a
 * guardian already on file for another patient (BA 2026-10-07, R-780).
 */
export interface GuardianCandidate {
  source: GuardianCandidateSourceCode;
  /** The hồ sơ a copied guardian links to, if any. */
  patientId: string | null;
  patientCode: string | null;
  fullName: string;
  phone: string | null;
  nationalId: string | null;
  /** "YYYY-MM-DD". */
  dateOfBirth: string | null;
  idIssuedOn: string | null;
  idIssuedPlace: string | null;
  gender: GenderCode | null;
  email: string | null;
  occupationEntryId: string | null;
  wards: GuardianWard[];
}

/** What the guardian-document upload hands back. */
export interface GuardianDocument {
  blobName: string;
  fileName: string;
  contentType: string;
  sizeInBytes: number;
}

/** The four tabs above the list. "All" is the absence of a filter. */
export type TreatmentTab = "All" | "Completed" | "InTreatment" | "Pending";

/**
 * Mirrors BlueDental.PatientManagement.PatientExaminationReasonDto — one dated
 * line of "Lý do đến khám".
 */
export interface ExaminationReason {
  id: string;
  content: string;
  note: string | null;
  /** The line the hồ sơ dialog edits; the + button never writes another one. */
  isRoot: boolean;
  recordedAt: string;
}

/**
 * Mirrors BlueDental.PatientManagement.PatientDto — the whole record, as the
 * hồ sơ dialog edits it. The table speaks {@link PatientListItem} instead;
 * the two drifted apart before, which crashed the list as soon as a patient
 * existed, so neither derives from the other.
 */
export interface PatientDto {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  /** Null when the front desk registered the patient without one. */
  dateOfBirth: string | null;
  gender: GenderCode;
  phoneNumber: string | null;
  email: string | null;
  nationalId: string | null;
  status: PatientStatusCode;
  branchId: string;

  sourceTaxonomyId: string | null;
  sourceEntryId: string | null;
  occupationEntryId: string | null;
  occupationOther: string | null;
  insuranceNumber: string | null;
  /** Số nhà/ Đường — the street line only. */
  address: string | null;
  provinceCode: string | null;
  wardCode: string | null;
  /** Địa chỉ cũ — the pre-2025 address as printed on the CCCD. */
  oldAddress: string | null;
  /** The root reason's text — what the hồ sơ dialog's Lý do đến khám box binds. */
  examinationReason: string | null;
  /** Lý do đến khám, newest first — the dated list the profile card prints. */
  examinationReasons: ExaminationReason[];
  note: string | null;

  tagIds: string[];
  diseaseHistoryEntryIds: string[];
  /** Người giám hộ, in the order the popup lists them. */
  guardians: PatientGuardianDto[];

  creationTime: string;
  lastModificationTime: string | null;
}

/**
 * Mirrors BlueDental.PatientManagement.PatientListItemDto — one table row,
 * rollup included.
 */
export interface PatientListItem {
  id: string;
  patientCode: string;
  fullName: string;
  dateOfBirth: string | null;
  phoneNumber: string | null;
  treatmentStatus: TreatmentStatusCode;
  serviceNames: string[];
  staffNames: string[];
  totalAmount: number;
  totalRevenue: number;
  totalDebt: number;
  nextAppointmentAt: string | null;
  lastVisitAt: string | null;
  creationTime: string;
}

/** The code the "Tạo hồ sơ" dialog opens with, split as it renders it. */
export interface PatientCodeEstimate {
  /** The fixed half, e.g. "BD26" — shown greyed and not editable. */
  prefix: string;
  /** The editable half, e.g. "0013". */
  sequence: string;
  code: string;
}

/**
 * What a scanned CCCD — or a "Lịch tạm" walk-in's name and phone — fills into
 * a new "Tạo hồ sơ" before the desk reviews it.
 */
export interface PatientPrefill {
  nationalId?: string;
  fullName?: string;
  phone?: string;
  /** "YYYY-MM-DD". */
  dateOfBirth?: string;
  gender?: Gender;
  address?: string;
  provinceCode?: string;
  wardCode?: string;
  oldAddress?: string;
}

/**
 * Answer to "Quét CCCD": is the scanned number already on a record here?
 * Yes/no only — like the duplicate refusal (R-564) it never names the holder.
 */
export interface NationalIdLookup {
  exists: boolean;
}

export interface PhoneAvailability {
  exists: boolean;
  patientName: string | null;
  patientCode: string | null;
}

/**
 * Mirrors BlueDental.PatientManagement.RegisterPatientDto. The server takes
 * `phoneNumber` (not `phone`) and a real `dateOfBirth`, so these names must
 * match exactly or the request 400s.
 */
export interface RegisterPatientRequest {
  firstName: string;
  lastName: string;
  /** "YYYY-MM-DD", or null — the server binds this to DateOnly?. */
  dateOfBirth: string | null;
  gender: Gender;
  phoneNumber?: string;
  email?: string;
  nationalId?: string;
  /** Omit to keep the code the server suggests. */
  patientCode?: string;

  sourceTaxonomyId?: string | null;
  sourceEntryId?: string | null;
  occupationEntryId?: string | null;
  occupationOther?: string | null;
  insuranceNumber?: string | null;
  address?: string | null;
  provinceCode?: string | null;
  wardCode?: string | null;
  oldAddress?: string | null;
  examinationReason?: string | null;
  note?: string | null;

  /** On update: omit = keep what is stored; a list replaces it whole. */
  tagIds?: string[];
  diseaseHistoryEntryIds?: string[];

  /** On update: omit = keep the guardians on file; a list replaces them whole. */
  guardians?: PatientGuardianInput[];
  /** The popup's "xác nhận thông tin … đồng ý cho khách hàng được thăm khám" tick. */
  guardiansConsented?: boolean;
}

export type UpdatePatientRequest = RegisterPatientRequest;

/** Every filter the list can narrow by, exactly as the server names them. */
export interface PatientListQuery {
  branchId?: string;
  filter?: string;
  treatmentStatus?: Exclude<TreatmentTab, "All">;
  staffId?: string;
  serviceTaxonomyId?: string;
  tagId?: string;
  /** ISO instants bounding the Ngày/Tuần/Tháng window. */
  fromDate?: string;
  toDate?: string;
  skipCount?: number;
  maxResultCount?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

/**
 * UI view model for a single patient. Deliberately not `extends PatientDto` —
 * the screens speak in `code`/`phone`/`createdAt` while the server speaks in
 * `patientCode`/`phoneNumber`/`creationTime`, and conflating the two is what
 * broke the list.
 */
export interface Patient {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: Gender;
  phone: string;
  email: string | null;
  nationalId: string | null;
  /** Record lifecycle. Treatment state lives on the list row, not here. */
  status: PatientStatusCode;
  branchId: string;
  createdAt: string;
  /** Null when no birth date was recorded. */
  age: number | null;
  initials: string;
  address: string | null;
  medicalHistory: string | null;
  allergies: string[];
  lastVisitAt: string | null;
}
