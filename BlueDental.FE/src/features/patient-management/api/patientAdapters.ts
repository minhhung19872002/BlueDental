import dayjs from "dayjs";
import {
  GENDER,
  PATIENT_STATUS,
  type Gender,
  type Patient,
  type PatientDto,
  type PatientListItem,
  type PatientStatus,
} from "../types/patient";

const GENDER_BY_CODE: Record<number, Gender> = {
  [GENDER.Male]: "male",
  [GENDER.Female]: "female",
  [GENDER.Other]: "other",
  [GENDER.PreferNotToSay]: "other",
};

/**
 * The server tracks a lifecycle (Active/Inactive/...) while the list tabs speak
 * in treatment terms. Only "Active" maps onto a treatment state today; the rest
 * collapse to "no activity" until treatment status is served by the API.
 */
const STATUS_BY_CODE: Record<number, PatientStatus> = {
  [PATIENT_STATUS.Active]: "NoActivity",
  [PATIENT_STATUS.Inactive]: "NoActivity",
  [PATIENT_STATUS.Deceased]: "NoActivity",
  [PATIENT_STATUS.Transferred]: "NoActivity",
};

/**
 * Computes client-side derived fields:
 * - `age`: calculated from dateOfBirth to today (in years)
 * - `initials`: first letter of each name word, max 2 chars
 */
export function adaptPatient(dto: PatientDto): Patient {
  const age = dayjs().diff(dayjs(dto.dateOfBirth), "year");

  const words = [dto.lastName, dto.firstName].filter(Boolean).join(" ").trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
      : words[0]?.slice(0, 2).toUpperCase() ?? "??";

  return {
    id: dto.id,
    code: dto.patientCode,
    firstName: dto.firstName,
    lastName: dto.lastName,
    fullName: [dto.lastName, dto.firstName].filter(Boolean).join(" ").trim(),
    dateOfBirth: dto.dateOfBirth,
    gender: GENDER_BY_CODE[dto.gender] ?? "other",
    phone: dto.phoneNumber ?? "",
    email: dto.email,
    nationalId: dto.nationalId,
    status: STATUS_BY_CODE[dto.status] ?? "NoActivity",
    branchId: dto.branchId,
    createdAt: dto.creationTime,
    age,
    initials,
    address: null,
    medicalHistory: null,
    allergies: [],
    lastVisitAt: null,
  };
}

/**
 * The list endpoint returns the patient DTO, not the row shape the table wants:
 * `patientCode` vs `code`, `phoneNumber` vs `phone`, `creationTime` vs
 * `createdAt`, and no financial rollup at all. Mapping here keeps those names in
 * one place — binding the DTO straight to the table crashed every row that tried
 * to format a missing amount.
 */
export function adaptPatientListItem(dto: PatientDto): PatientListItem {
  return {
    id: dto.id,
    code: dto.patientCode,
    // Vietnamese order: họ (lastName) first, then tên (firstName).
    fullName: [dto.lastName, dto.firstName].filter(Boolean).join(" ").trim(),
    createdAt: dto.creationTime,
    dateOfBirth: dto.dateOfBirth ?? null,
    gender: GENDER_BY_CODE[dto.gender] ?? "other",
    phone: dto.phoneNumber ?? "",
    email: dto.email ?? null,
    status: STATUS_BY_CODE[dto.status] ?? "NoActivity",
    serviceName: null,
    doctorName: null,
    totalAmount: 0,
    collectedAmount: 0,
    debtAmount: 0,
    nextAppointmentAt: null,
    lastVisitAt: null,
  };
}
