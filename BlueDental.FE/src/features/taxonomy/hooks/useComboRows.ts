import { useCallback, useState } from "react";
import type { CatalogEntryDto } from "../api/taxonomyApi";
import type { ComboRowDraft } from "../api/comboPricing";

/** The saved rows of a combo, as the dialog edits them. */
export function rowsOf(entry: CatalogEntryDto | null): ComboRowDraft[] {
  return (entry?.comboItems ?? []).map((item) => ({
    componentEntryId: item.componentEntryId,
    name: item.componentName ?? "",
    retailPrice: item.componentPrice ?? 0,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
}

/**
 * The "Thành phần combo" table. Adding a service already in it raises its
 * quantity — the picker's badge counts it — and a new row starts at the
 * service's own price, which the user may then lower for the combo.
 */
export function useComboRows() {
  const [rows, setRows] = useState<ComboRowDraft[]>([]);

  const add = useCallback((service: CatalogEntryDto) => {
    setRows((current) => {
      if (current.some((row) => row.componentEntryId === service.id)) {
        return current.map((row) =>
          row.componentEntryId === service.id ? { ...row, quantity: row.quantity + 1 } : row,
        );
      }
      const price = service.price ?? 0;
      return [
        ...current,
        { componentEntryId: service.id, name: service.name, retailPrice: price, quantity: 1, unitPrice: price },
      ];
    });
  }, []);

  const update = useCallback((componentEntryId: string, patch: Partial<ComboRowDraft>) => {
    setRows((current) =>
      current.map((row) => (row.componentEntryId === componentEntryId ? { ...row, ...patch } : row)),
    );
  }, []);

  const remove = useCallback((componentEntryId: string) => {
    setRows((current) => current.filter((row) => row.componentEntryId !== componentEntryId));
  }, []);

  return { rows, reset: setRows, add, update, remove };
}
