export type Gender = "male" | "female" | "other";

export type PatientStatus = "NoActivity" | "InTreatment" | "Completed";

/** Matches BlueDental.PatientManagement.Gender (numeric on the wire). */
export const GENDER = { Male: 1, Female: 2, Other: 3, PreferNotToSay: 4 } as const;
export type GenderCode = (typeof GENDER)[keyof typeof GENDER];

/** Matches BlueDental.PatientManagement.PatientStatus. */
export const PATIENT_STATUS = { Active: 1, Inactive: 2, Deceased: 3, Transferred: 4 } as const;
export type PatientStatusCode = (typeof PATIENT_STATUS)[keyof typeof PATIENT_STATUS];

/**
 * Mirrors BlueDental.PatientManagement.PatientDto exactly. The UI shape lives in
 * PatientListItem / Patient and is produced by the adapters — the two drifted
 * apart before, which crashed the list as soon as a patient existed.
 */
export interface PatientDto {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  gender: GenderCode;
  phoneNumber: string | null;
  email: string | null;
  nationalId: string | null;
  status: PatientStatusCode;
  branchId: string;
  creationTime: string;
  lastModificationTime: string | null;
}

export interface PatientListItem {
  id: string;
  code: string;
  fullName: string;
  createdAt: string;
  dateOfBirth: string | null;
  gender: Gender;
  phone: string;
  email: string | null;
  status: PatientStatus;
  serviceName: string | null;
  doctorName: string | null;
  totalAmount: number;
  collectedAmount: number;
  debtAmount: number;
  nextAppointmentAt: string | null;
  lastVisitAt: string | null;
}

/**
 * Mirrors BlueDental.PatientManagement.RegisterPatientDto. The server takes
 * `phoneNumber` (not `phone`), a real `dateOfBirth` and the branch the patient
 * belongs to, so those names must match exactly or the request 400s.
 */
export interface RegisterPatientRequest {
  firstName: string;
  lastName: string;
  /** "YYYY-MM-DD" — the server binds this to DateOnly. */
  dateOfBirth: string;
  gender: Gender;
  phoneNumber?: string;
  email?: string;
  nationalId?: string;
  branchId: string;
}

export type UpdatePatientRequest = Partial<RegisterPatientRequest>;

export interface PatientListQuery {
  keyword?: string;
  status?: PatientStatus | "All";
  doctorId?: string;
  serviceCategory?: string;
  tagId?: string;
  skipCount?: number;
  maxResultCount?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

/** Client-side enriched patient with computed fields. */
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
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email: string | null;
  nationalId: string | null;
  status: PatientStatus;
  branchId: string;
  createdAt: string;
  age: number;
  initials: string;
  /** Not served by the API yet — kept so detail views can render a placeholder. */
  address: string | null;
  medicalHistory: string | null;
  allergies: string[];
  lastVisitAt: string | null;
}
