import { useAuthStore } from "@/features/auth/store/authStore";

/**
 * Current clinic branch.
 *
 * Reads the `clinicId` that the backend returns in the current-user profile
 * after login. Falls back to the seeded branch ID only when no session is
 * active (e.g. during unit tests or before the login redirect fires).
 *
 * Replace with a branch-switcher selector once multi-branch switching lands —
 * every caller already goes through this hook.
 */
export const DEFAULT_BRANCH_ID = "11111111-1111-1111-1111-111111111111";

export function useCurrentBranchId(): string {
  const clinicId = useAuthStore((s) => s.user?.clinicId);
  return clinicId ?? DEFAULT_BRANCH_ID;
}
