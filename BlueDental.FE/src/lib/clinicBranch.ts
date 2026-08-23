import { useAuthStore } from "@/features/auth/store/authStore";

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

export function useCurrentBranchId(): string {
  const clinicId = useAuthStore((s) => s.user?.clinicId);
  return clinicId ?? EMPTY_GUID;
}
