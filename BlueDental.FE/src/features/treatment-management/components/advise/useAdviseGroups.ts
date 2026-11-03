import { useCallback, useMemo, useState } from "react";
import { CATALOG_GROUP, useTaxonomyGroupPages } from "@/hooks/useCatalogOptions";
import type { AdviseGroupNav, AdviseKind } from "./adviseTypes";

/**
 * The group list of one tab of "Chọn dịch vụ", read from the server a page at
 * a time, with the group picked on it. Each tab counts its own kind: Dịch vụ
 * lẻ the single services of a group, Combo its combos — and Combo lists only
 * the groups that hold one (R-1116).
 */
export function useAdviseGroups(kind: AdviseKind, enabled: boolean, allCount?: number) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const pages = useTaxonomyGroupPages(CATALOG_GROUP.CareService, enabled, kind === "combo");

  const groups = useMemo(
    () =>
      (pages.data?.pages.flatMap((page) => page.items) ?? []).map((group) => ({
        id: group.id,
        name: group.name,
        count: kind === "combo" ? group.comboCount : group.itemCount - group.comboCount,
      })),
    [pages.data, kind],
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pages;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const nav: AdviseGroupNav = {
    groups,
    allCount: allCount ?? groups.reduce((sum, group) => sum + group.count, 0),
    activeId: groupId,
    loading: pages.isLoading,
    hasMore: Boolean(hasNextPage),
    onChange: setGroupId,
    onLoadMore: loadMore,
  };

  return { groupId, setGroupId, nav };
}
