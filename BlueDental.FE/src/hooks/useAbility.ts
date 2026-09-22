import { useAuthStore } from "@/features/auth/store/authStore";
import { PERMISSION_GROUP } from "@/lib/permissionConstants";

/** The action half of an ability leaf, as the Phân quyền tree names them. */
export type AbilityAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "approve"
  | "finalize"
  | "print"
  | "continue"
  | "complete"
  | "deposit"
  | "withdraw"
  | "transfer"
  | "hidePhone"
  | "attendanceOthers"
  | "manage";

/** `BlueDental.<subject>.<action>` — the permission name the server checks. */
export function abilityName(subject: string, action: AbilityAction): string {
  return `${PERMISSION_GROUP}.${subject}.${action}`;
}

export interface Ability {
  can: (action: AbilityAction) => boolean;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove: boolean;
}

/**
 * What the signed-in user may do with one subject of the ability tree, for
 * showing or hiding the buttons that would otherwise be refused.
 *
 * The server checks the same leaves on every call; this only decides what to
 * offer. Subscribes to the permission list, so a fresh sign-in re-evaluates.
 */
export function useAbility(subject: string): Ability {
  const permissions = useAuthStore((s) => s.user?.permissions);
  const granted = new Set(permissions ?? []);
  const can = (action: AbilityAction) => granted.has(abilityName(subject, action));

  return {
    can,
    canRead: can("read"),
    canCreate: can("create"),
    canUpdate: can("update"),
    canDelete: can("delete"),
    canExport: can("export"),
    canApprove: can("approve"),
  };
}
