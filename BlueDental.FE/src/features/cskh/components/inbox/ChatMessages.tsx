import { useEffect, useRef } from "react";
import { Button, Spin } from "antd";
import { t } from "@/lib/i18n";
import type { ChatEntry } from "../../api/inboxApi";
import type { HistorySync } from "../../hooks/useHistorySync";
import { ChatBubble } from "./ChatBubble";

interface Props {
  entries: ChatEntry[] | undefined;
  loading: boolean;
  customer: string;
  history: HistorySync;
}

/** The chat, oldest at the top; it follows the newest message as messages come in. */
export function ChatMessages({ entries, loading, customer, history }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const lastKey = entries?.[entries.length - 1]?.key;

  // The box scrolls, not the page: scrollIntoView would drag the page along.
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [lastKey]);

  return (
    <div ref={boxRef} className="ibx-messages" aria-live="polite">
      <Spin spinning={loading}>
        {history.canLoadOlder && (
          <div className="ibx-older">
            <Button size="small" loading={history.loading} disabled={history.loading} onClick={history.loadOlder}>
              {t("CSKH:Inbox:LoadOlder")}
            </Button>
          </div>
        )}
        {history.error && <p className="ibx-sync-error">{t("CSKH:Inbox:SyncFailed", history.error)}</p>}
        <ul className="ibx-msg-list">
          {(entries ?? []).map((entry) => (
            <ChatBubble key={entry.key} entry={entry} customer={customer} />
          ))}
        </ul>
        {!loading && entries?.length === 0 && <p className="ibx-list-empty">{t("CSKH:Inbox:NoMessages")}</p>}
      </Spin>
    </div>
  );
}
