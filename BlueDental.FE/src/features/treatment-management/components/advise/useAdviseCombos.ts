import { useCallback, useMemo, useState } from "react";
import { useCatalogComboOptions } from "@/hooks/useCatalogCombos";
import { useDebounce } from "@/hooks/useDebounce";
import type { AdviseKind } from "./adviseTypes";
import { suggestCombo } from "./comboSuggestion";
import { useAdviseGroups } from "./useAdviseGroups";
import type { AdviseSelection } from "./useAdviseSelection";

/** The reference's search delay, kept for the combo search too. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The combo half of "Chọn Dịch Vụ" (review P0510): which tab is open, the
 * combo groups and search, the combos the server returns for them, and the
 * suggestion the ticked services earn — read against every combo, not the
 * searched few.
 */
export function useAdviseCombos(enabled: boolean, selection: AdviseSelection) {
  const [kind, setKind] = useState<AdviseKind>("single");
  const [search, setSearch] = useState("");
  const term = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);

  const all = useCatalogComboOptions("", enabled);
  // "Combo (n)" and its "Tất cả" count every combo, whatever the group or search.
  const total = all.data?.totalCount ?? 0;
  const { groupId, setGroupId, nav } = useAdviseGroups("combo", enabled && kind === "combo", total);
  const listed = useCatalogComboOptions(term, enabled, groupId);

  const suggestion = useMemo(
    () => suggestCombo(selection.rows.keys(), all.data?.items ?? [], new Set(selection.combos.keys())),
    [selection.rows, selection.combos, all.data],
  );

  /** Every open starts on Dịch vụ lẻ, every group, with an empty combo search. */
  const reset = useCallback(() => {
    setKind("single");
    setGroupId(null);
    setSearch("");
  }, [setGroupId]);

  return {
    kind,
    setKind,
    search,
    setSearch,
    setGroupId,
    reset,
    nav,
    combos: listed.data?.items ?? [],
    total,
    loading: listed.isLoading || listed.isPlaceholderData,
    suggestion,
  };
}
