import { useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { STATS_LIMITS, type StatsOutcome, type StatsRecipientQuery, type StatsRecipientSort } from "../api/statsApi";

export interface StatsRecipientSearch {
  /** What is in the box, ahead of the debounce. */
  text: string;
  outcome: StatsOutcome | null;
  sorting: StatsRecipientSort;
  /** The debounced query the table and the Excel read. */
  query: StatsRecipientQuery;
  setText: (text: string) => void;
  setOutcome: (outcome: StatsOutcome | null) => void;
  setSorting: (sorting: StatsRecipientSort) => void;
}

/**
 * Người nhận's search box, status filter and sort. Held by the page, not the
 * table, because "Xuất báo cáo Excel" exports the same recipients.
 */
export function useStatsRecipientQuery(): StatsRecipientSearch {
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<StatsOutcome | null>(null);
  const [sorting, setSorting] = useState<StatsRecipientSort>("at desc");
  const filter = useDebounce(text.trim().slice(0, STATS_LIMITS.maxFilter), 300);

  const query = useMemo<StatsRecipientQuery>(() => ({ filter, outcome, sorting }), [filter, outcome, sorting]);

  return { text, outcome, sorting, query, setText, setOutcome, setSorting };
}
