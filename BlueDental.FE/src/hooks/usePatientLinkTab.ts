import { useAuthStore } from "@/features/auth/store/authStore";

/** The patient-record tab a patient's name opens from Tiếp nhận or Lịch hẹn. */
export type PatientLinkTab = "consulting" | "profile";

/**
 * Clinical staff — any of the "Bác sĩ", "Phụ tá", "Y sĩ" ticks on the staff
 * form — go straight to "Chẩn đoán & Tư vấn"; everyone else (reception,
 * accounting…) to "Hồ sơ" (BA 2026-10-05).
 *
 * The ticks come with the signed-in account (`current-user`), so the answer
 * does not wait on a request nor need the "Nhân viên – xem" permission.
 * Lives here rather than in a feature because Tiếp nhận and Lịch hẹn both
 * open the record.
 */
export function usePatientLinkTab(): PatientLinkTab {
  const isClinical = useAuthStore(
    (s) => !!s.user && (s.user.isDentist || s.user.isAssistant || s.user.isHygienist),
  );
  return isClinical ? "consulting" : "profile";
}
