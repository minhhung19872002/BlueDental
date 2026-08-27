import dayjs from "dayjs";
import { GENDER, PATIENT_STATUS, type Gender, type Patient, type PatientDto } from "../types/patient";

export const GENDER_BY_CODE: Record<number, Gender> = {
  [GENDER.Male]: "male",
  [GENDER.Female]: "female",
  [GENDER.Other]: "other",
  [GENDER.PreferNotToSay]: "other",
};

export const GENDER_CODE_BY_NAME: Record<Gender, number> = {
  male: GENDER.Male,
  female: GENDER.Female,
  other: GENDER.Other,
};

/**
 * Computes the client-side derived fields the profile screen renders:
 * - `age`: years from dateOfBirth to today, or null when none was recorded
 * - `initials`: first letter of the first and last name word, max 2 chars
 */
export function adaptPatient(dto: PatientDto): Patient {
  const words = dto.fullName.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
      : words[0]?.slice(0, 2).toUpperCase() ?? "??";

  return {
    id: dto.id,
    code: dto.patientCode,
    firstName: dto.firstName,
    lastName: dto.lastName,
    fullName: dto.fullName,
    dateOfBirth: dto.dateOfBirth,
    gender: GENDER_BY_CODE[dto.gender] ?? "other",
    phone: dto.phoneNumber ?? "",
    email: dto.email,
    nationalId: dto.nationalId,
    status: dto.status ?? PATIENT_STATUS.Active,
    branchId: dto.branchId,
    createdAt: dto.creationTime,
    age: dto.dateOfBirth ? dayjs().diff(dayjs(dto.dateOfBirth), "year") : null,
    initials,
    address: dto.address,
    medicalHistory: null,
    allergies: [],
    lastVisitAt: null,
  };
}
