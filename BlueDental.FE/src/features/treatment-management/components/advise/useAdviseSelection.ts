import { useCallback, useMemo, useState } from "react";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { newRowDraft, sumTotals, type AdviseRowDraft, type AdviseTotals } from "./adviseTypes";

export interface AdviseSelection {
  /** Drafts keyed by service id, in the order they were ticked. */
  rows: ReadonlyMap<string, AdviseRowDraft>;
  totals: AdviseTotals;
  isSelected: (serviceId: string) => boolean;
  toggle: (service: CatalogOption, checked: boolean) => void;
  /** Ticks (or unticks) every service currently on screen. */
  toggleAll: (services: CatalogOption[], checked: boolean) => void;
  update: (serviceId: string, patch: Partial<AdviseRowDraft>) => void;
  clear: () => void;
}

/**
 * Which services are ticked in "Chọn Dịch Vụ" and what was typed on each.
 * A row's draft survives being filtered out of view — unticking is the only
 * thing that drops it — so switching group filters never loses an edit.
 */
export function useAdviseSelection(): AdviseSelection {
  const [rows, setRows] = useState<Map<string, AdviseRowDraft>>(() => new Map());

  const isSelected = useCallback((serviceId: string) => rows.has(serviceId), [rows]);

  const toggle = useCallback((service: CatalogOption, checked: boolean) => {
    setRows((current) => {
      const next = new Map(current);
      if (checked) {
        if (!next.has(service.id)) next.set(service.id, newRowDraft(service));
      } else {
        next.delete(service.id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((services: CatalogOption[], checked: boolean) => {
    setRows((current) => {
      const next = new Map(current);
      for (const service of services) {
        if (checked) {
          if (!next.has(service.id)) next.set(service.id, newRowDraft(service));
        } else {
          next.delete(service.id);
        }
      }
      return next;
    });
  }, []);

  const update = useCallback((serviceId: string, patch: Partial<AdviseRowDraft>) => {
    setRows((current) => {
      const row = current.get(serviceId);
      if (!row) return current;
      const next = new Map(current);
      next.set(serviceId, { ...row, ...patch });
      return next;
    });
  }, []);

  const clear = useCallback(() => setRows(new Map()), []);

  const totals = useMemo(() => sumTotals(rows.values()), [rows]);

  return { rows, totals, isSelected, toggle, toggleAll, update, clear };
}
