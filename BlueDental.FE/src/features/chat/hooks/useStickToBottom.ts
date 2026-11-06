import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/** Within this many pixels of the end the reader counts as "at the bottom". */
const NEAR_BOTTOM_PX = 80;

/**
 * Keeps a message list on its newest message the way chat apps do: it opens
 * at the bottom, follows new messages and late-loading images while the
 * reader is at the bottom, and leaves the scroll alone once they scroll up —
 * except for their own message, which always brings them back down.
 */
export function useStickToBottom(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  newestId: string | undefined,
  newestIsMine: boolean,
): { unpin: () => void } {
  const pinnedRef = useRef(true);

  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;

    const handleScroll = () => {
      pinnedRef.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < NEAR_BOTTOM_PX;
    };
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) scroller.scrollTop = scroller.scrollHeight;
    });

    scroller.addEventListener("scroll", handleScroll, { passive: true });
    observer.observe(content);
    return () => {
      scroller.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [scrollRef, contentRef]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !newestId) return;
    if (newestIsMine) pinnedRef.current = true;
    if (pinnedRef.current) scroller.scrollTop = scroller.scrollHeight;
  }, [scrollRef, newestId, newestIsMine]);

  // A jump to an older message lets go of the bottom at once: waiting for the
  // scroll event would let a late image pull the list back down first.
  const unpin = useCallback(() => {
    pinnedRef.current = false;
  }, []);
  return { unpin };
}
