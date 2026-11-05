import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { arrivalCallKeys } from "./arrivalCallQueries";

/** What the caches held before a flip, to put back if the server refuses it. */
export type FlagCacheSnapshot = [QueryKey, unknown][];

const BOARD_ROOT = ["receptions"] as const;

interface Flaggable {
  id: string;
  isFlagged: boolean;
}

const isFlaggable = (value: unknown): value is Flaggable =>
  typeof value === "object" && value !== null && "id" in value && "isFlagged" in value;

const isFlaggableList = (value: unknown): value is Flaggable[] =>
  Array.isArray(value) && value.every(isFlaggable);

interface BoardPage {
  items: Flaggable[];
}

/** The board's infinite pages; ["receptions", …] also roots a doctor's busy spans and work days. */
const isBoardData = (value: unknown): value is { pages: BoardPage[] } =>
  typeof value === "object" &&
  value !== null &&
  "pages" in value &&
  Array.isArray(value.pages) &&
  value.pages.every(
    (page: unknown) => typeof page === "object" && page !== null && "items" in page && isFlaggableList(page.items),
  );

const flip = <T extends Flaggable>(items: T[], id: string, flagged: boolean): T[] =>
  items.map((item) => (item.id === id ? { ...item, isFlagged: flagged } : item));

/**
 * "Đặt cờ" / "Gỡ cờ" show on the click: the visit's card on the board and its
 * row on the "Đã đến" panel flip in the cache at once, instead of after the
 * server answers and the whole board is fetched again (owner 2026-11-05: the
 * wait read as lag). In-flight fetches are cancelled first so an older answer
 * cannot flip it back; the refetch after the write then confirms it.
 */
export async function flipFlagInCache(
  queryClient: QueryClient,
  id: string,
  flagged: boolean,
): Promise<FlagCacheSnapshot> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: BOARD_ROOT }),
    queryClient.cancelQueries({ queryKey: arrivalCallKeys.all }),
  ]);
  const snapshot: FlagCacheSnapshot = [
    ...queryClient.getQueriesData({ queryKey: BOARD_ROOT }),
    ...queryClient.getQueriesData({ queryKey: arrivalCallKeys.all }),
  ];

  queryClient.setQueriesData({ queryKey: BOARD_ROOT }, (data: unknown) =>
    isBoardData(data)
      ? { ...data, pages: data.pages.map((page) => ({ ...page, items: flip(page.items, id, flagged) })) }
      : data,
  );
  queryClient.setQueriesData({ queryKey: arrivalCallKeys.all }, (data: unknown) =>
    isFlaggableList(data) ? flip(data, id, flagged) : data,
  );
  return snapshot;
}

/** The server refused the flip: every cache goes back to what it held. */
export function restoreFlagCache(queryClient: QueryClient, snapshot: FlagCacheSnapshot | undefined): void {
  snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}
