import { useCallback, useState } from "react";

import { isNavGroupActive, type NavEntry, type NavGroup } from "./nav";

interface BrowsedGroup {
  groupId: string;
  /** The page it was picked on; any other page drops it. */
  pathname: string;
}

export interface RibbonGroup {
  /** The group whose members the ribbon is showing, or null for none. */
  shownGroupId: string | null;
  /** Its members — empty for a link-style group or a page outside the menu. */
  items: readonly NavEntry[];
  /** Show another group's members without leaving the page. */
  browse: (groupId: string) => void;
  /** Go back to the members of the group the page belongs to. */
  reset: () => void;
}

/**
 * Which group the always-on ribbon shows (BA, 2026-10-05): the one holding the
 * page on screen, until a group button is clicked — then that one, until the
 * page changes. A group without members, Tổng quan among them, leaves the
 * ribbon standing empty rather than taking it away.
 */
export function useRibbonGroup(groups: readonly NavGroup[], pathname: string): RibbonGroup {
  const [browsed, setBrowsed] = useState<BrowsedGroup | null>(null);

  const browsedGroupId = browsed?.pathname === pathname ? browsed.groupId : null;
  const routeGroupId = groups.find((g) => isNavGroupActive(g, pathname))?.id ?? null;
  const shownGroupId = browsedGroupId ?? routeGroupId;
  const items = groups.find((g) => g.id === shownGroupId)?.items ?? [];

  const browse = useCallback((groupId: string) => setBrowsed({ groupId, pathname }), [pathname]);
  const reset = useCallback(() => setBrowsed(null), []);

  return { shownGroupId, items, browse, reset };
}
