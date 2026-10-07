import { useCallback, useMemo } from "react";
import { CATALOG_GROUP, useCatalogOptions, useTaxonomyGroupOptions } from "@/hooks/useCatalogOptions";
import type { TicketDto } from "../api/ticketApi";

/**
 * Danh mục → Nguồn đến, the same two levels the patient record uses: a group
 * (Nguồn) and an entry under it (Kênh kết nối).
 */
export function useSourceOptions() {
  const groups = useTaxonomyGroupOptions(CATALOG_GROUP.Source);
  const entries = useCatalogOptions(CATALOG_GROUP.Source);

  const groupOptions = useMemo(
    () => (groups.data ?? []).map((group) => ({ value: group.id, label: group.name })),
    [groups.data],
  );

  const channelsOf = useCallback(
    (groupId?: string | null) =>
      (entries.data ?? [])
        .filter((entry) => entry.taxonomyId === groupId)
        .map((entry) => ({ value: entry.id, label: entry.name })),
    [entries.data],
  );

  const sourceName = useCallback(
    (ticket: Pick<TicketDto, "sourceTaxonomyId" | "sourceEntryId">) => {
      const group = groupOptions.find((option) => option.value === ticket.sourceTaxonomyId)?.label;
      const entry = entries.data?.find((option) => option.id === ticket.sourceEntryId)?.name;
      return [group, entry].filter(Boolean).join(" · ") || null;
    },
    [groupOptions, entries.data],
  );

  return { groupOptions, channelsOf, sourceName };
}
