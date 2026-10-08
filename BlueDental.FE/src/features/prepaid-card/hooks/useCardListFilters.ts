import { useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import type { CardListFilter, CardState } from "../types";

const PAGE_SIZE = 20;

/** Search, status, type and page of the card list; any change returns to page 1. */
export function useCardListFilters() {
  const [keyword, setKeywordState] = useState("");
  const [state, setStateValue] = useState<CardState | undefined>();
  const [cardTypeId, setCardTypeIdValue] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const debounced = useDebounce(keyword, 300);

  const query = useMemo<CardListFilter>(
    () => ({
      filter: debounced.trim(),
      state,
      cardTypeId,
      skipCount: (page - 1) * pageSize,
      maxResultCount: pageSize,
    }),
    [debounced, state, cardTypeId, page, pageSize],
  );

  return {
    query,
    keyword,
    state,
    cardTypeId,
    page,
    pageSize,
    setKeyword: (value: string) => {
      setKeywordState(value);
      setPage(1);
    },
    setState: (value: CardState | undefined) => {
      setStateValue(value);
      setPage(1);
    },
    setCardTypeId: (value: string | undefined) => {
      setCardTypeIdValue(value);
      setPage(1);
    },
    setPage: (next: number, size: number) => {
      setPage(size === pageSize ? next : 1);
      setPageSize(size);
    },
  };
}
