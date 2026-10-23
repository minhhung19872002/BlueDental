import { useEffect, useState } from "react";
import { INBOX_LIMITS, useSyncConversation } from "../api/inboxApi";

/**
 * Reads the conversation's history from Zalo when it is opened (the newest
 * page), then one page further back per "Tải tin cũ hơn" while Zalo still
 * returns a full page. What the inbox already holds is never fetched twice.
 */
export function useHistorySync(id: string, connected: boolean) {
  const sync = useSyncConversation();
  const { mutate } = sync;
  const [nextOffset, setNextOffset] = useState<number | null>(null);

  useEffect(() => {
    if (!connected) return;
    mutate(
      { id, offset: 0 },
      { onSuccess: (result) => setNextOffset(result.hasMore ? INBOX_LIMITS.chatPage : null) },
    );
  }, [id, connected, mutate]);

  const loadOlder = () => {
    if (nextOffset == null) return;
    mutate(
      { id, offset: nextOffset },
      { onSuccess: (result) => setNextOffset(result.hasMore ? nextOffset + INBOX_LIMITS.chatPage : null) },
    );
  };

  return {
    canLoadOlder: nextOffset != null,
    loadOlder,
    loading: sync.isPending,
    error: sync.data?.error ?? null,
  };
}

export type HistorySync = ReturnType<typeof useHistorySync>;
