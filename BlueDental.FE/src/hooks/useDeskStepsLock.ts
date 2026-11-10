import { useAuthStore } from "@/features/auth/store/authStore";

/** The seeded admin role (`BlueDentalAbilitySeedContributor.AdminRoleName`). */
const ADMIN_ROLE = "admin";

/**
 * "Đã đến" and "Đang khám" on a Tiếp nhận bar are the front desk's steps: an
 * account ticked "Bác sĩ" on the staff form may not press them, forward or
 * back, whatever its role's permissions; an admin may (Huỳnh Văn Định
 * 2026-11-10, R-1193). "Hoàn tất" and the outcome column stay open. A screen
 * lock only: the owner asked for no server rule (2026-11-10), and the server's
 * `start` also serves the "Chuyển bác sĩ" outcome a doctor keeps.
 */
export function useDeskStepsLock() {
  const locked = useAuthStore((s) => !!s.user?.isDentist && !s.user.roles.includes(ADMIN_ROLE));
  return { deskStepsLocked: locked };
}
