import { useMemo } from "react";

import { normalizePhone } from "@/components/PhoneInput";

import { usePhoneAvailability } from "../api/patientQueries";
import type { PatientDto, PhoneGuardian, PhoneOwner } from "../types/patient";

const NO_OWNERS: readonly PhoneOwner[] = [];
const NO_GUARDIANS: readonly PhoneGuardian[] = [];

/**
 * Who already holds the number typed into the hồ sơ dialog (P2710_02). A number
 * an edited record already had is not asked about again (an older record saved
 * without its 0 has it still), and guardians are only offered to a new hồ sơ.
 * `masked` is an account that may not see phones: the server says the number
 * is taken but names nobody, so it is refused as before.
 */
export function usePhoneHolders(phone: string, patient: PatientDto | null) {
  const typed = phone.trim();
  const checking = !patient || normalizePhone(typed) !== normalizePhone((patient.phoneNumber ?? "").trim());
  const availability = usePhoneAvailability(checking ? typed : "", patient?.id);
  const answer = checking ? availability.data : undefined;

  const owners = answer?.owners ?? NO_OWNERS;
  const guardians = (!patient && answer?.guardians) || NO_GUARDIANS;
  const holders = useMemo(() => ({ owners, guardians }), [owners, guardians]);

  return { holders, masked: answer?.exists === true && owners.length === 0 };
}
