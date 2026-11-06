import { useEffect, useRef, useSyncExternalStore } from "react";
import { useMarkChatRead } from "../api/chatMutations";

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

const isPageVisible = () => document.visibilityState === "visible";

/**
 * Marks the open thread read whenever it shows unread messages — on open and
 * again when a message arrives while it is open — but only while the tab is
 * on screen: a message that lands in a background tab stays unread until the
 * reader comes back to it (R-1162 H4.5). Each (thread, count) pair is tried
 * once, so a failed mark is not retried in a loop.
 */
export function useMarkReadWhenUnread(conversationId: string, unreadCount: number): void {
  const { mutate } = useMarkChatRead();
  const triedRef = useRef<string | null>(null);
  const visible = useSyncExternalStore(subscribeVisibility, isPageVisible);

  useEffect(() => {
    if (unreadCount <= 0) {
      triedRef.current = null;
      return;
    }
    if (!visible) return;
    const attempt = `${conversationId}:${unreadCount}`;
    if (triedRef.current === attempt) return;
    triedRef.current = attempt;
    mutate(conversationId);
  }, [conversationId, unreadCount, visible, mutate]);
}
