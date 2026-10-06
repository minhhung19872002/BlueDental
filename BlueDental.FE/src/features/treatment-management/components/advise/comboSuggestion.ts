import type { CatalogComboOption, CatalogComboPart } from "@/hooks/useCatalogCombos";

export interface ComboSuggestion {
  combo: CatalogComboOption;
  /** The combo's parts not yet ticked — what the clinician would add. */
  missing: CatalogComboPart[];
}

/**
 * The orange "Gợi ý tư vấn" of "Chọn Dịch Vụ" (review P0510): once a ticked
 * service belongs to a combo, name that combo. When several hold ticked
 * services, the one holding the most of them wins, then the one that saves
 * the customer most. A combo already picked is not suggested again.
 */
export function suggestCombo(
  tickedServiceIds: Iterable<string>,
  combos: readonly CatalogComboOption[],
  pickedComboIds: ReadonlySet<string>,
): ComboSuggestion | null {
  const ticked = new Set(tickedServiceIds);
  if (ticked.size === 0) return null;

  let best: { combo: CatalogComboOption; overlap: number } | null = null;
  for (const combo of combos) {
    if (pickedComboIds.has(combo.id)) continue;
    const overlap = combo.parts.filter((part) => ticked.has(part.serviceId)).length;
    if (overlap === 0) continue;
    if (!best || overlap > best.overlap || (overlap === best.overlap && combo.savings > best.combo.savings)) {
      best = { combo, overlap };
    }
  }

  if (!best) return null;
  return { combo: best.combo, missing: best.combo.parts.filter((part) => !ticked.has(part.serviceId)) };
}
