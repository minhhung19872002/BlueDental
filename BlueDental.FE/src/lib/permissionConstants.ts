/**
 * Central permission name constants.
 *
 * Every literal `"BlueDental.…"` permission string in the FE must come from
 * here (or from `abilityName()` in `useAbility.ts`, which shares the same
 * `PERMISSION_GROUP` prefix).  This eliminates magic-string drift between FE
 * and the BE `BlueDentalPermissions` / `BlueDentalAbilityPermissions` classes.
 */

export const PERMISSION_GROUP = "BlueDental";

/* ── helper (re-exported so callers don't need a second import) ───────── */

import type { AbilityAction } from "@/hooks/useAbility";

export function abilityPermission(subject: string, action: AbilityAction): string {
  return `${PERMISSION_GROUP}.${subject}.${action}`;
}

/* ── Legacy (module-style) permission names ───────────────────────────── */

export const LegacyPermissions = {
  Organizations: {
    View: `${PERMISSION_GROUP}.Organizations.View`,
  },
  BranchManager: {
    View: `${PERMISSION_GROUP}.BranchManager.View`,
  },
  SystemAdmin: {
    Users: `${PERMISSION_GROUP}.SystemAdmin.Users`,
    UsersCreate: `${PERMISSION_GROUP}.SystemAdmin.Users.Create`,
    UsersEdit: `${PERMISSION_GROUP}.SystemAdmin.Users.Edit`,
    UsersDelete: `${PERMISSION_GROUP}.SystemAdmin.Users.Delete`,
    Roles: `${PERMISSION_GROUP}.SystemAdmin.Roles`,
    RolesCreate: `${PERMISSION_GROUP}.SystemAdmin.Roles.Create`,
    RolesDelete: `${PERMISSION_GROUP}.SystemAdmin.Roles.Delete`,
    AuditLogs: `${PERMISSION_GROUP}.SystemAdmin.AuditLogs`,
  },
} as const;

/* ── ABP framework permissions (not BlueDental-defined) ───────────────── */

export const AbpPermissions = {
  Identity: {
    Users: "AbpIdentity.Users",
    Roles: "AbpIdentity.Roles",
  },
} as const;
