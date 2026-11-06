import React, { useState } from "react";
import { Input } from "antd";
import { Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { t } from "@/lib/i18n";
import { useChatMessageSearch } from "../api/chatQueries";
import { CHAT_LIMITS, type ChatMessageDto } from "../types";
import { formatMessageTime } from "../utils/chatFormat";
import { toDisplayText } from "../utils/chatPatientTokens";
import { highlightMatches } from "../utils/chatSearch";
import { ChatSpinner } from "./ChatSpinner";
import { ChatStatus } from "./ChatStatus";

interface MessageSearchProps {
  conversationId: string;
  /** A result was picked: the thread comes back scrolled to it. */
  onPick: (message: ChatMessageDto) => void;
  onClose: () => void;
}

const SEARCH_DEBOUNCE_MS = 400;

/**
 * Searches the words of one conversation, newest first. The server decrypts
 * and matches, accent-blind, so the words typed never leave the browser in a
 * URL; it looks through the 5,000 newest messages and says so when it stops.
 */
export const MessageSearch: React.FC<MessageSearchProps> = ({ conversationId, onPick, onClose }) => {
  const [text, setText] = useState("");
  const query = useDebounce(text.trim(), SEARCH_DEBOUNCE_MS);
  const { data, isError, refetch } = useChatMessageSearch(conversationId, query);
  // Typing (debounce not yet run out) or waiting on the server: one spinner, centred.
  const typing = text.trim() !== query;
  const loading = typing ? text.trim().length > 0 : Boolean(query) && !data && !isError;
  const shown = !typing && query ? data : undefined;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") onClose();
  };

  return (
    <div className="chat-message-search">
      <div className="chat-search">
        <Input
          autoFocus
          allowClear
          value={text}
          maxLength={CHAT_LIMITS.maxSearchTextLength}
          placeholder={t("Chat:SearchMessages")}
          aria-label={t("Chat:SearchMessages")}
          prefix={<Search size={15} aria-hidden />}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="chat-search-results" aria-live="polite" aria-busy={loading}>
        {!text.trim() && <ChatStatus text={t("Chat:SearchMessagesHint")} />}
        {loading && <ChatSpinner />}
        {!typing && query && isError && <ChatStatus text={t("Chat:LoadError")} onRetry={() => void refetch()} />}
        {shown && shown.items.length === 0 && <ChatStatus text={t("Chat:NoMessageMatch")} />}
        {shown && shown.items.length > 0 && (
          <ul className="chat-search-list">
            {shown.items.map((message) => (
              <li key={message.id}>
                <button type="button" className="chat-search-hit" onClick={() => onPick(message)}>
                  <span className="chat-search-hit-head">
                    <span className="chat-search-hit-sender">{message.senderName}</span>
                    <span className="chat-search-hit-time">{formatMessageTime(message.sentAt)}</span>
                  </span>
                  <span className="chat-search-hit-text">
                    {highlightMatches(toDisplayText(message.content ?? ""), query).map((segment, index) =>
                      segment.hit ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>,
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {shown && !shown.isComplete && <p className="chat-search-note">{t("Chat:SearchPartial")}</p>}
      </div>
    </div>
  );
};
