import { useCallback, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  CATALOG_GROUP,
  useCatalogOptionSearch,
  useTaxonomyGroupPages,
} from "@/hooks/useCatalogOptions";

/** The reference waits this long after the last keystroke before it searches. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * What "Chọn Dịch Vụ" lists: the service groups for its strip and the
 * services under them, both **from the server** a page at a time, as the
 * reference reads them (`careServiceApi.list({ taxonomyId, search, page,
 * perPage: 20 })`). Holding one 200-row slice and filtering it here hid every
 * service past the slice — a group with services showed "Không có dịch vụ phù
 * hợp" once the catalogue outgrew it.
 */
export function useAdviseCatalog(enabled: boolean) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const term = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);

  const groupPages = useTaxonomyGroupPages(CATALOG_GROUP.CareService, enabled);
  const servicePages = useCatalogOptionSearch(CATALOG_GROUP.CareService, {
    search: term,
    taxonomyId: groupId ?? undefined,
    includeInactive: true,
    enabled,
  });

  const groups = useMemo(
    () => groupPages.data?.pages.flatMap((page) => page.items) ?? [],
    [groupPages.data],
  );
  const services = useMemo(
    () => servicePages.data?.pages.flatMap((page) => page.items) ?? [],
    [servicePages.data],
  );

  const { hasNextPage: moreGroups, isFetchingNextPage: fetchingGroups, fetchNextPage: nextGroups } =
    groupPages;
  const loadMoreGroups = useCallback(() => {
    if (moreGroups && !fetchingGroups) void nextGroups();
  }, [moreGroups, fetchingGroups, nextGroups]);

  const {
    hasNextPage: moreServices,
    isFetchingNextPage: fetchingServices,
    fetchNextPage: nextServices,
  } = servicePages;
  const loadMoreServices = useCallback(() => {
    if (moreServices && !fetchingServices) void nextServices();
  }, [moreServices, fetchingServices, nextServices]);

  /** Every open starts on every group with an empty search. */
  const reset = useCallback(() => {
    setGroupId(null);
    setSearch("");
  }, []);

  return {
    groupId,
    setGroupId,
    search,
    setSearch,
    reset,
    groups,
    groupsLoading: groupPages.isLoading,
    groupsLoadingMore: fetchingGroups,
    loadMoreGroups,
    services,
    // A new group or search swaps the whole list: while the old rows only hold
    // the place, the table shows it is loading — the reference empties it too.
    servicesLoading: servicePages.isLoading || servicePages.isPlaceholderData,
    servicesLoadingMore: fetchingServices,
    hasMoreServices: Boolean(moreServices),
    loadMoreServices,
  };
}
