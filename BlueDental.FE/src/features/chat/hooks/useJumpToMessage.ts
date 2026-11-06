import { useEffect, type RefObject } from "react";

const FLASH_CLASS = "chat-message--flash";
const FLASH_MS = 2000;

interface JumpTarget {
  /** The message to bring into view; null when there is nothing to do. */
  messageId: string | null;
  loadedIds: readonly string[];
  hasOlder: boolean;
  /** The first page or an older one is on its way. */
  loadingOlder: boolean;
  loadOlder: () => void;
  /** Called once the message is scrolled to, before onDone. */
  onShown: () => void;
  /** Called once the message is shown, or once it is clear it cannot be. */
  onDone: () => void;
}

/**
 * Scrolls a thread to one message, loading older pages until it is among
 * them, then flashes it so the eye finds it. Used for a picked search result and Kho lưu trữ's "Xem tin nhắn".
 */
export function useJumpToMessage(scrollRef: RefObject<HTMLElement | null>, target: JumpTarget): void {
  const { messageId, loadedIds, hasOlder, loadingOlder, loadOlder, onShown, onDone } = target;
  const loaded = messageId !== null && loadedIds.includes(messageId);

  useEffect(() => {
    if (messageId === null) return;
    if (!loaded) {
      if (loadingOlder) return;
      if (hasOlder) loadOlder();
      else onDone();
      return;
    }

    // A frame later, so the list has settled at the bottom before it moves.
    const frame = requestAnimationFrame(() => {
      const element = scrollRef.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`);
      if (element) {
        element.scrollIntoView({ block: "center" });
        onShown();
      }
      element?.classList.add(FLASH_CLASS);
      window.setTimeout(() => element?.classList.remove(FLASH_CLASS), FLASH_MS);
      onDone();
    });
    return () => cancelAnimationFrame(frame);
  }, [messageId, loaded, hasOlder, loadingOlder, loadOlder, onShown, onDone, scrollRef]);
}
