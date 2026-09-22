import { useMemo } from "react";

import { useAuthStore } from "@/features/auth/store/authStore";
import { isAnyGranted } from "@/lib/permissions";

import { NAV_FLAT, NAV_GROUPS, type NavEntry, type NavGroup } from "./nav";

export interface VisibleNav {
  /** Header groups the user may see; a group with no visible member is gone. */
  groups: readonly NavGroup[];
  /** Flat list for the mobile drawer, in the design's order. */
  items: readonly NavEntry[];
}

function entryVisible(entry: NavEntry, granted: (p: string) => boolean): boolean {
  return isAnyGranted(entry.permissions ?? [], granted);
}

/**
 * The menu, cut down to what the signed-in user may open.
 *
 * The owner's decision (2026-09-22): an entry the user lacks permission for is
 * hidden rather than shown disabled, and a group whose members are all hidden
 * disappears with them. Tổng quan carries no permission, so it always stays.
 */
export function useVisibleNav(): VisibleNav {
  const permissions = useAuthStore((s) => s.user?.permissions);

  return useMemo(() => {
    const set = new Set(permissions ?? []);
    const granted = (p: string) => set.has(p);

    const groups = NAV_GROUPS.flatMap<NavGroup>((group) => {
      if (group.path) {
        return isAnyGranted(group.permissions ?? [], granted) ? [group] : [];
      }
      const items = (group.items ?? []).filter((item) => entryVisible(item, granted));
      return items.length > 0 ? [{ ...group, items }] : [];
    });

    const items = NAV_FLAT.filter((item) => entryVisible(item, granted));

    return { groups, items };
  }, [permissions]);
}
