import { useCallback, useMemo, useState } from "react";
import type { PatientAdviseDto } from "@/features/treatment-management/api/consultingApi";
import { moveItem } from "@/utils/array";

/** One báo giá raised off Phiếu tư vấn: the rows it was built from. */
export interface AdviseQuote {
  id: string;
  /** "BG 1", "BG 2" — the reference numbers them in the order they are raised. */
  label: string;
  rows: PatientAdviseDto[];
}

export interface AdviseQuotesState {
  quotes: AdviseQuote[];
  /** `null` while the Phiếu tư vấn tab is the one showing. */
  activeId: string | null;
  active: AdviseQuote | null;
  show: (id: string | null) => void;
  /** Raises a quote off the given rows and opens it. Returns nothing if empty. */
  create: (rows: PatientAdviseDto[]) => void;
  remove: (id: string) => void;
  /** Moves a row inside the open quote. Its order is the quote's own. */
  move: (from: number, to: number) => void;
}

/**
 * The báo giá tabs beside "Phiếu tư vấn".
 *
 * Held in the browser: the reference raises a quote and lets it be edited
 * before anything is committed, and BlueDental has no quote aggregate yet — so
 * a reload drops them. Recorded in docs/clone/unknowns.md; building the
 * server side is a separate piece of work.
 */
export function useAdviseQuotes(): AdviseQuotesState {
  const [quotes, setQuotes] = useState<AdviseQuote[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Numbering keeps climbing, so removing "BG 1" does not rename "BG 2". */
  const [raised, setRaised] = useState(0);

  const create = useCallback(
    (rows: PatientAdviseDto[]) => {
      if (rows.length === 0) return;

      const ordinal = raised + 1;
      const quote: AdviseQuote = {
        id: `quote-${ordinal}`,
        label: `BG ${ordinal}`,
        // Copied, not referenced: the quote keeps what was ticked when it was
        // raised, even if the plan is re-ticked afterwards.
        rows: [...rows],
      };

      setRaised(ordinal);
      setQuotes((current) => [...current, quote]);
      setActiveId(quote.id);
    },
    [raised],
  );

  const remove = useCallback((id: string) => {
    setQuotes((current) => current.filter((quote) => quote.id !== id));
    setActiveId((current) => (current === id ? null : current));
  }, []);

  const move = useCallback(
    (from: number, to: number) => {
      setQuotes((current) =>
        current.map((quote) =>
          quote.id === activeId ? { ...quote, rows: moveItem(quote.rows, from, to) } : quote,
        ),
      );
    },
    [activeId],
  );

  const active = useMemo(
    () => quotes.find((quote) => quote.id === activeId) ?? null,
    [quotes, activeId],
  );

  return { quotes, activeId, active, show: setActiveId, create, remove, move };
}
