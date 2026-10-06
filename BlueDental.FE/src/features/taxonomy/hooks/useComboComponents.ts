import { useCallback, useMemo, useState } from "react";
import type { CatalogEntryDto, ComboItemDto, ComboItemInput } from "../api/taxonomyApi";

/** One row of "Thành phần combo" as the dialog edits it. */
export interface ComboRow {
  componentEntryId: string;
  name: string;
  taxonomyName: string | null;
  /** "Đơn giá" — the service's own price, read-only here. */
  unitPrice: number;
  /** "Thành tiền" — one unit inside the combo; editing it never touches the service. */
  unitAmount: number;
  quantity: number;
  /** The service was deleted after it was put in the combo. It may stay, not be re-added. */
  isDeleted: boolean;
}

function fromDto(item: ComboItemDto): ComboRow {
  return {
    componentEntryId: item.componentEntryId,
    name: item.name ?? "",
    taxonomyName: item.taxonomyName ?? null,
    unitPrice: item.unitPrice ?? 0,
    unitAmount: item.unitAmount,
    quantity: item.quantity,
    isDeleted: item.isDeleted ?? false,
  };
}

function fromService(service: CatalogEntryDto): ComboRow {
  const price = service.price ?? 0;
  return {
    componentEntryId: service.id,
    name: service.name,
    taxonomyName: service.taxonomyName,
    unitPrice: price,
    // A new row is sold at the service's own price until someone changes it.
    unitAmount: price,
    quantity: 1,
    isDeleted: false,
  };
}

/**
 * The rows of "Thành phần combo". Picking a service already in the combo adds
 * one more of it rather than a second row — the server refuses duplicates.
 *
 * `edits` counts what the user did to the rows since the last `reset`, so the
 * dialog can refill Giá combo after an edit but not when a saved combo loads.
 */
export function useComboComponents() {
  const [rows, setRows] = useState<ComboRow[]>([]);
  const [edits, setEdits] = useState(0);

  const reset = useCallback((items: ComboItemDto[]) => {
    setRows(items.map(fromDto));
    setEdits(0);
  }, []);

  const edit = useCallback((change: (current: ComboRow[]) => ComboRow[]) => {
    setRows(change);
    setEdits((count) => count + 1);
  }, []);

  const add = useCallback((service: CatalogEntryDto) => {
    edit((current) =>
      current.some((row) => row.componentEntryId === service.id)
        ? current.map((row) =>
            row.componentEntryId === service.id ? { ...row, quantity: row.quantity + 1 } : row,
          )
        : [...current, fromService(service)],
    );
  }, [edit]);

  const remove = useCallback((id: string) => {
    edit((current) => current.filter((row) => row.componentEntryId !== id));
  }, [edit]);

  const setQuantity = useCallback((id: string, quantity: number) => {
    edit((current) =>
      current.map((row) =>
        row.componentEntryId === id ? { ...row, quantity: Math.max(1, Math.round(quantity)) } : row,
      ),
    );
  }, [edit]);

  const setUnitAmount = useCallback((id: string, unitAmount: number) => {
    edit((current) =>
      current.map((row) =>
        row.componentEntryId === id ? { ...row, unitAmount: Math.max(0, unitAmount) } : row,
      ),
    );
  }, [edit]);

  /** How many of each service the combo holds — the picker's "×n" badge. */
  const quantities = useMemo(
    () => new Map(rows.map((row) => [row.componentEntryId, row.quantity])),
    [rows],
  );

  const toInput = useCallback(
    (): ComboItemInput[] =>
      rows.map(({ componentEntryId, quantity, unitAmount }) => ({
        componentEntryId,
        quantity,
        unitAmount,
      })),
    [rows],
  );

  return { rows, edits, quantities, reset, add, remove, setQuantity, setUnitAmount, toInput };
}

export type ComboComponents = ReturnType<typeof useComboComponents>;
