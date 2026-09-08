import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { PatientAdviseDto } from "@/features/treatment-management/api/consultingApi";
import {
  useCreatePatientQuote,
  useDeletePatientQuote,
  useDuplicatePatientQuote,
  usePatientQuotes,
  useUpdatePatientQuote,
  type PatientQuoteLineDto,
} from "@/features/treatment-management/api/patientQuoteApi";
import { extractApiError } from "@/lib/apiError";
import { moveItem } from "@/utils/array";

/** One báo giá raised off Phiếu tư vấn, with its lines resolved to their rows. */
export interface AdviseQuote {
  id: string;
  /** "BG 1", "BG 2" — numbered per patient, and the number only ever climbs. */
  label: string;
  rows: PatientAdviseDto[];
  /** Which of its own rows are ticked; a quote is priced on its own selection. */
  selected: string[];
}

export interface AdviseQuotesState {
  /** Newest first, as the reference stacks them beside "Phiếu tư vấn". */
  quotes: AdviseQuote[];
  /** `null` while the Phiếu tư vấn tab is the one showing. */
  activeId: string | null;
  active: AdviseQuote | null;
  loading: boolean;
  show: (id: string | null) => void;
  /** Raises a quote off the given rows and opens it. Does nothing if empty. */
  create: (rows: PatientAdviseDto[]) => void;
  /** "Sao chép báo giá" — a fresh quote holding the same rows and ticks. */
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  /** Moves a row inside the open quote. Its order is the quote's own. */
  move: (from: number, to: number) => void;
  /** Re-ticks the open quote. */
  select: (ids: string[]) => void;
}

/**
 * The báo giá tabs beside "Phiếu tư vấn", stored server-side.
 *
 * A quote keeps only the **set** of consulting lines, their order and their
 * ticks — never a copy of a price. The rows are resolved against the consulting
 * list on every read, so a corrected price is never stale on a quote and the
 * money is worked out the way the plan block works it out.
 *
 * A line whose consulting row has since gone is dropped from the view rather
 * than drawn empty.
 *
 * The numbering and the order are the server's: it counts quotes ever raised
 * for the patient, deleted ones included, so dropping "BG 1" never renames
 * "BG 2". Nothing here re-derives either.
 *
 * UNKNOWN_REFERENCE_BEHAVIOR: what the reference stores against a quote was
 * never observed — this shape is BlueDental's own. See docs/clone/unknowns.md.
 */
export function useAdviseQuotes(
  patientId: string,
  branchId: string | null,
  adviseRows: PatientAdviseDto[],
): AdviseQuotesState {
  const [activeId, setActiveId] = useState<string | null>(null);

  const list = usePatientQuotes(patientId, branchId ?? undefined);
  const createQuote = useCreatePatientQuote();
  const duplicateQuote = useDuplicatePatientQuote();
  const updateQuote = useUpdatePatientQuote();
  const deleteQuote = useDeletePatientQuote();

  const byId = useMemo(() => new Map(adviseRows.map((row) => [row.id, row])), [adviseRows]);

  /** The server hands these back newest first; the ordinal is the label. */
  const quotes = useMemo<AdviseQuote[]>(
    () =>
      (list.data?.items ?? []).map((quote) => {
        const resolved = [...quote.lines]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((line) => ({ line, row: byId.get(line.adviseId) }))
          .filter((entry): entry is { line: PatientQuoteLineDto; row: PatientAdviseDto } =>
            Boolean(entry.row),
          );

        return {
          id: quote.id,
          label: `BG ${quote.ordinal}`,
          rows: resolved.map((entry) => entry.row),
          selected: resolved.filter((entry) => entry.line.isSelected).map((entry) => entry.row.id),
        };
      }),
    [list.data, byId],
  );

  const active = useMemo(
    () => quotes.find((quote) => quote.id === activeId) ?? null,
    [quotes, activeId],
  );

  const create = useCallback(
    (rows: PatientAdviseDto[]) => {
      if (rows.length === 0 || !branchId) return;

      createQuote
        .mutateAsync({
          patientId,
          clinicBranchId: branchId,
          adviseIds: rows.map((row) => row.id),
        })
        // Opening the new one is what the reference does: the quote just made
        // is the tab showing.
        .then((quote) => setActiveId(quote.id))
        .catch((error) => toast.error(extractApiError(error)));
    },
    [branchId, patientId, createQuote],
  );

  const duplicate = useCallback(
    (id: string) => {
      duplicateQuote
        .mutateAsync(id)
        .then((quote) => setActiveId(quote.id))
        .catch((error) => toast.error(extractApiError(error)));
    },
    [duplicateQuote],
  );

  const remove = useCallback(
    (id: string) => {
      deleteQuote
        .mutateAsync(id)
        .then(() => setActiveId((current) => (current === id ? null : current)))
        .catch((error) => toast.error(extractApiError(error)));
    },
    [deleteQuote],
  );

  /** Sends the open quote's whole set, which is what the endpoint takes. */
  const write = useCallback(
    (rows: PatientAdviseDto[], selected: string[]) => {
      if (!active) return;

      updateQuote
        .mutateAsync({
          id: active.id,
          lines: rows.map((row, index) => ({
            adviseId: row.id,
            isSelected: selected.includes(row.id),
            sortOrder: index + 1,
          })),
        })
        .catch((error) => toast.error(extractApiError(error)));
    },
    [active, updateQuote],
  );

  const move = useCallback(
    (from: number, to: number) => {
      if (!active) return;
      write(moveItem(active.rows, from, to), active.selected);
    },
    [active, write],
  );

  const select = useCallback(
    (ids: string[]) => {
      if (!active) return;
      write(active.rows, ids);
    },
    [active, write],
  );

  return {
    quotes,
    activeId,
    active,
    loading: list.isPending,
    show: setActiveId,
    create,
    duplicate,
    remove,
    move,
    select,
  };
}
