import { useAuthStore } from "@/features/auth/store/authStore";

/** True when `granted` holds any of `required`, or when nothing is required. */
export function isAnyGranted(
  required: readonly string[],
  granted: (permission: string) => boolean,
): boolean {
  return required.length === 0 || required.some(granted);
}

/**
 * Whether the signed-in user holds any of `required`. Subscribes to the
 * permission list itself, so a fresh sign-in re-evaluates it.
 */
export function useHasAnyPermission(required: readonly string[]): boolean {
  const permissions = useAuthStore((s) => s.user?.permissions);
  if (required.length === 0) return true;
  const set = new Set(permissions ?? []);
  return required.some((p) => set.has(p));
}
