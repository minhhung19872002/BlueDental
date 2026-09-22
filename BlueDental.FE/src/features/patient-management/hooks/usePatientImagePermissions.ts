import { useAuthStore } from "@/features/auth/store/authStore";
import { abilityPermission } from "@/lib/permissionConstants";

const PERMISSION = {
  create: abilityPermission("treatmentImage", "create"),
  update: abilityPermission("treatmentImage", "update"),
  delete: abilityPermission("treatmentImage", "delete"),
} as const;

export interface PatientImagePermissions {
  /** "Tải ảnh" is shown. */
  canUpload: boolean;
  /** The grip on each card is shown and the cards can be dragged. */
  canSort: boolean;
  /** The trash on each card is shown. */
  canDelete: boolean;
}

/**
 * Which of the tab's commands this user gets. The server checks the same
 * abilities again on every call; hiding a button is only about not offering
 * something that would be refused.
 */
export function usePatientImagePermissions(): PatientImagePermissions {
  const canUpload = useAuthStore((s) => s.hasPermission(PERMISSION.create));
  const canSort = useAuthStore((s) => s.hasPermission(PERMISSION.update));
  const canDelete = useAuthStore((s) => s.hasPermission(PERMISSION.delete));
  return { canUpload, canSort, canDelete };
}
