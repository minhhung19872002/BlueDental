import { t } from "@/lib/i18n";

const ROLE_KEYS: Record<string, string> = {
  admin: "Quản trị viên",
  dentist: "Bác sĩ",
  nurse: "Điều dưỡng",
  receptionist: "Lễ tân",
  accountant: "Kế toán",
  manager: "Quản lý",
};

export function roleLabel(role: string | undefined, fallback: string): string {
  if (!role) return fallback;
  const key = ROLE_KEYS[role.toLowerCase()];
  return key ? t(key) : role;
}
