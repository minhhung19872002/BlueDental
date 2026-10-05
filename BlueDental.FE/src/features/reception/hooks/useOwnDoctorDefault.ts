import { useEffect, useRef } from "react";
import { useAuthStore } from "@/features/auth/store/authStore";
import type { ReceptionDoctor } from "../api/receptionQueries";

/**
 * A dentist (the "Bác sĩ" tick on the staff form) opening the board starts on
 * their own patients: the doctor filter is set to them once, when the branch's
 * doctors first arrive (BA 2026-10-05). Clearing it shows everyone again, and
 * changing the day or view keeps whatever is picked.
 */
export function useOwnDoctorDefault(
  doctors: ReceptionDoctor[] | undefined,
  selectDoctor: (doctorId: string) => void,
) {
  const userId = useAuthStore((s) => s.user?.id);
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current || !doctors || !userId) return;
    decided.current = true;
    if (doctors.some((d) => d.id === userId && d.isDentist)) selectDoctor(userId);
  }, [doctors, userId, selectDoctor]);
}
