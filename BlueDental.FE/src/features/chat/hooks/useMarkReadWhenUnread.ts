import { useEffect, useRef } from "react";
import { useMarkChatRead } from "../api/chatMutations";

/**
 * Marks the open thread read whenever it shows unread messages — on open and
 * again when a message arrives while it is open. Each (thread, count) pair is
 * tried once, so a failed mark is not retried in a loop.
 */
export function useMarkReadWhenUnread(conversationId: string, unreadCount: number): void {
  const { mutate } = useMarkChatRead();
  const triedRef = useRef<string | null>(null);

  useEffect(() => {
    if (unreadCount <= 0) {
      triedRef.current = null;
      return;
    }
    const attempt = `${conversationId}:${unreadCount}`;
    if (triedRef.current === attempt) return;
    triedRef.current = attempt;
    mutate(conversationId);
  }, [conversationId, unreadCount, mutate]);
}
