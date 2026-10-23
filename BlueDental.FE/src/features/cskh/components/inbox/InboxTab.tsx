import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useDebounce } from "@/hooks/useDebounce";
import { useMinuteNow } from "@/hooks/useNow";
import { t } from "@/lib/i18n";
import { INBOX_TAB, useInboxList, useSyncRecent, type InboxTab as InboxTabKey } from "../../api/inboxApi";
import { ConversationList } from "./ConversationList";
import { ConversationView } from "./ConversationView";
import { InboxHeader } from "./InboxHeader";

/** URL key of the open conversation, so a link or a reload lands on it. */
const CONVERSATION_PARAM = "conversation";

/**
 * CSKH ▸ Hộp thư Zalo (BA P2210, F-79): the branch OA's conversations. Opening
 * the tab reads Zalo's recent chats once, for whatever the webhook missed.
 */
export function InboxTab({ canHandle }: { canHandle: boolean }) {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get(CONVERSATION_PARAM);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<InboxTabKey>(INBOX_TAB.Unreplied);
  const debounced = useDebounce(filter.trim(), 300);
  const list = useInboxList({ filter: debounced, tab });
  const syncRecent = useSyncRecent();
  const { mutate: sync } = syncRecent;
  const now = useMinuteNow(true);
  const meId = useAuthStore((s) => s.user?.id ?? null);
  const meName = useAuthStore((s) => s.user?.name ?? null);
  const connected = list.data?.connected ?? false;

  useEffect(() => {
    if (connected) sync();
  }, [connected, sync]);

  const handleSelect = useCallback(
    (id: string) =>
      setParams((next) => {
        next.set(CONVERSATION_PARAM, id);
        return next;
      }),
    [setParams],
  );

  return (
    <div className="ibx">
      <InboxHeader
        oaName={list.data?.oaName ?? null}
        connected={connected}
        meName={meName}
        syncing={syncRecent.isPending}
        onSync={() => sync()}
      />
      <div className="ibx-grid">
        <ConversationList
          view={{ items: list.data?.items ?? [], counts: list.data?.counts, loading: list.isLoading }}
          query={{ tab, filter, onTabChange: setTab, onFilterChange: setFilter }}
          selectedId={selectedId}
          meId={meId}
          now={now}
          onSelect={handleSelect}
        />
        {selectedId ? (
          <ConversationView
            key={selectedId}
            id={selectedId}
            meId={meId}
            canHandle={canHandle}
            connected={connected}
            now={now}
          />
        ) : (
          <div className="ibx-pane-center ibx-pane-wide">
            <EmptyState
              icon="💬"
              title={connected ? t("CSKH:Inbox:PickOne") : t("CSKH:Inbox:NotConnected")}
              description={connected ? undefined : t("CSKH:Inbox:NotConnectedHint")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
