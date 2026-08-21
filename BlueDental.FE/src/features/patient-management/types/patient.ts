export type Gender = "male" | "female" | "other";

export interface PatientDto {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email: string | null;
  address: string | null;
  medicalHistory: string | null;
  allergies: string[];
  createdAt: string;
  lastVisitAt: string | null;
}

export interface PatientListItem {
  id: string;
  code: string;
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email: string | null;
  lastVisitAt: string | null;
}

export interface RegisterPatientRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email?: string;
  address?: string;
  medicalHistory?: string;
  allergies?: string[];
}

export type UpdatePatientRequest = Partial<RegisterPatientRequest>;

export interface PatientListQuery {
  keyword?: string;
  gender?: Gender;
  skipCount?: number;
  maxResultCount?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

/** Client-side enriched patient with computed fields. */
export interface Patient extends PatientDto {
  age: number;
  initials: string;
}
