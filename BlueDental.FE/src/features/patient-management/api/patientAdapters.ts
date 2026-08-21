import dayjs from "dayjs";
import type { Patient, PatientDto } from "../types/patient";

/**
 * Computes client-side derived fields:
 * - `age`: calculated from dateOfBirth to today (in years)
 * - `initials`: first letter of each name word, max 2 chars
 */
export function adaptPatient(dto: PatientDto): Patient {
  const age = dayjs().diff(dayjs(dto.dateOfBirth), "year");

  const words = dto.fullName.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
      : words[0]?.slice(0, 2).toUpperCase() ?? "??";

  return {
    ...dto,
    age,
    initials,
  };
}
