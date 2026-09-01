/**
 * Roles reach the client as their technical names. The ones the seeder creates
 * are already Vietnamese and pass through untouched; these are the
 * ABP-flavoured ones nobody wants to read on screen.
 */
const ROLE_LABELS: Record<string, string> = {
  admin: "Quản trị viên",
  dentist: "Bác sĩ",
  nurse: "Điều dưỡng",
  receptionist: "Lễ tân",
  accountant: "Kế toán",
  manager: "Quản lý",
};

/**
 * @param role The technical role name, if the account has one.
 * @param fallback What to show when it has none.
 */
export function roleLabel(role: string | undefined, fallback: string): string {
  if (!role) return fallback;
  return ROLE_LABELS[role.toLowerCase()] ?? role;
}
