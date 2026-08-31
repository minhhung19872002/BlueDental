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

/** The four tabs above the list. "All" is the absence of a filter. */
export type TreatmentTab = "All" | "Completed" | "InTreatment" | "Pending";

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
  examinationReason: string | null;
  note: string | null;

  tagIds: string[];
  diseaseHistoryEntryIds: string[];

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
  examinationReason?: string | null;
  note?: string | null;

  /** On update: omit = keep what is stored; a list replaces it whole. */
  tagIds?: string[];
  diseaseHistoryEntryIds?: string[];
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
