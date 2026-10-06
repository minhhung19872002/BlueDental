import { useCallback, useMemo, useState } from "react";
import { useCatalogComboOptions } from "@/hooks/useCatalogCombos";
import { useDebounce } from "@/hooks/useDebounce";
import type { AdviseKind } from "./AdvisePickerHead";
import { rowTotals } from "./adviseTypes";
import type { AdviseSummaryItem } from "./AdviseSummaryFooter";
import { suggestCombo } from "./comboSuggestion";
import type { AdviseSelection } from "./useAdviseSelection";

/** The reference's search delay, kept for the combo search too. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The combo half of "Chọn Dịch Vụ" (review P0510): which tab is open, the
 * combo search, the combos the server returns for it, and the suggestion
 * the ticked services earn — read against every combo, not the searched few.
 */
export function useAdviseCombos(enabled: boolean, selection: AdviseSelection) {
  const [kind, setKind] = useState<AdviseKind>("single");
  const [search, setSearch] = useState("");
  const term = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);

  const listed = useCatalogComboOptions(term, enabled);
  const all = useCatalogComboOptions("", enabled);

  const suggestion = useMemo(
    () => suggestCombo(selection.rows.keys(), all.data?.items ?? [], new Set(selection.combos.keys())),
    [selection.rows, selection.combos, all.data],
  );

  /** Every open starts on Dịch vụ lẻ with an empty combo search. */
  const reset = useCallback(() => {
    setKind("single");
    setSearch("");
  }, []);

  return {
    kind,
    setKind,
    search,
    setSearch,
    reset,
    combos: listed.data?.items ?? [],
    // "Combo (n)" counts every combo, whatever the search narrows to.
    total: all.data?.totalCount ?? 0,
    loading: listed.isLoading || listed.isPlaceholderData,
    suggestion,
  };
}

/** The summary card's lines: the ticked services first, then the picked combos. */
export function summaryItemsOf(selection: AdviseSelection): AdviseSummaryItem[] {
  const singles = [...selection.rows.values()].map((row) => ({
    id: row.service.id,
    kind: "single" as const,
    name: row.service.name,
    amount: rowTotals(row).effective,
  }));
  const combos = [...selection.combos.values()].map((combo) => ({
    id: combo.id,
    kind: "combo" as const,
    name: combo.name,
    amount: combo.salePrice,
  }));
  return [...singles, ...combos];
}
