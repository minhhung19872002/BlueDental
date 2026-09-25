import { useCallback, useMemo, useState } from "react";
import type { ServiceCatalogGroupDto } from "../api/clinicIntegrationApi";
import {
  buildSyncInput,
  filterGroups,
  selectAll,
  toggleGroup,
  toggleService,
  totalSyncable,
} from "../serviceCatalogSync";

/**
 * What the sync dialog holds while it is open: the search, the ticks and which
 * groups are unfolded. Everything is cleared when the dialog closes, as the
 * reference's is.
 */
export function useServiceSyncSelection(groups: ServiceCatalogGroupDto[]) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const visibleGroups = useMemo(() => filterGroups(groups, search), [groups, search]);
  const syncableCount = useMemo(() => totalSyncable(groups), [groups]);
  const allSelected = syncableCount > 0 && selected.size === syncableCount;
  const input = useMemo(() => buildSyncInput(groups, selected), [groups, selected]);

  const handleToggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : selectAll(groups));
  }, [allSelected, groups]);

  /** Ticks against the full group, not the filtered one: a group tick means the whole group. */
  const handleToggleGroup = useCallback(
    (taxonomyId: string) => {
      const group = groups.find((item) => item.taxonomyId === taxonomyId);
      if (group) setSelected((current) => toggleGroup(group, current));
    },
    [groups],
  );

  const handleToggleService = useCallback((id: string) => {
    setSelected((current) => toggleService(id, current));
  }, []);

  const handleExpandedChange = useCallback((taxonomyId: string, open: boolean) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(taxonomyId);
      else next.delete(taxonomyId);
      return next;
    });
  }, []);

  /** A search unfolds every group it leaves, so the matches are in view. */
  const isExpanded = useCallback(
    (taxonomyId: string) => search.trim().length > 0 || expanded.has(taxonomyId),
    [expanded, search],
  );

  const reset = useCallback(() => {
    setSearch("");
    setSelected(new Set());
    setExpanded(new Set());
  }, []);

  return {
    search,
    setSearch,
    selected,
    selectedCount: selected.size,
    syncableCount,
    allSelected,
    visibleGroups,
    input,
    isExpanded,
    handleToggleAll,
    handleToggleGroup,
    handleToggleService,
    handleExpandedChange,
    reset,
  };
}
