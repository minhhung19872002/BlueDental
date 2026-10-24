import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { INBOX_TAB, type InboxTab } from "../api/inboxApi";

/** URL key of the open conversation, so a link or a reload lands on it. */
const CONVERSATION_PARAM = "conversation";
/** URL key of the chip on, so a reload keeps the open conversation in the list (R-1025). */
const BOX_PARAM = "box";

const BOXES: { tab: InboxTab; key: string }[] = [
  { tab: INBOX_TAB.Unreplied, key: "unreplied" },
  { tab: INBOX_TAB.Mine, key: "mine" },
  { tab: INBOX_TAB.Cared, key: "cared" },
  { tab: INBOX_TAB.All, key: "all" },
];

const boxKey = (tab: InboxTab) => BOXES.find((box) => box.tab === tab)?.key ?? "unreplied";

/**
 * Hộp thư Zalo's place in the URL: the open conversation and the chip on. A
 * link that names only the conversation opens on "Tất cả", the one chip sure to list it.
 */
export function useInboxRoute() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get(CONVERSATION_PARAM);
  const tab =
    BOXES.find((box) => box.key === params.get(BOX_PARAM))?.tab ?? (selectedId ? INBOX_TAB.All : INBOX_TAB.Unreplied);

  const select = useCallback(
    (id: string) =>
      setParams((next) => {
        next.set(CONVERSATION_PARAM, id);
        next.set(BOX_PARAM, boxKey(tab));
        return next;
      }),
    [setParams, tab],
  );

  const changeTab = useCallback(
    (value: InboxTab) =>
      setParams(
        (next) => {
          next.set(BOX_PARAM, boxKey(value));
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  return { selectedId, tab, select, changeTab };
}
