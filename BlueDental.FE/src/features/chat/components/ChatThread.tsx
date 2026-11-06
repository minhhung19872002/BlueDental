import React, { useCallback, useState } from "react";
import { Search } from "lucide-react";
import { describeApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { useChatConversation, useChatMessages } from "../api/chatQueries";
import { isStillEditable } from "../hooks/useEditWindow";
import { useMarkReadWhenUnread } from "../hooks/useMarkReadWhenUnread";
import { CHAT_KIND, type ChatMessageDto } from "../types";
import { ChatComposer } from "./ChatComposer";
import { ChatPanelHeader } from "./ChatPanelHeader";
import { ChatStatus } from "./ChatStatus";
import { MessageList } from "./MessageList";
import { MessageSearch } from "./MessageSearch";
import { ThreadMenu } from "./ThreadMenu";

interface ChatThreadProps {
  conversationId: string;
  onBack: () => void;
  onClose: () => void;
}

/**
 * One conversation: its messages, newest at the bottom, and the composer.
 * The magnifier swaps them for a search of the thread; a picked result
 * brings the thread back scrolled to it.
 */
export const ChatThread: React.FC<ChatThreadProps> = ({ conversationId, onBack, onClose }) => {
  const { data: conversation, error, refetch } = useChatConversation(conversationId);
  const { data: messagePages } = useChatMessages(conversationId);
  const [editing, setEditing] = useState<ChatMessageDto | null>(null);
  const [searching, setSearching] = useState(false);
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null);
  const handleFocused = useCallback(() => setFocusMessageId(null), []);
  useMarkReadWhenUnread(conversationId, conversation?.unreadCount ?? 0);

  if (error) {
    // 404: the caller was taken out of the group (or left in another tab).
    const gone = describeApiError(error).status === 404;
    return (
      <>
        <ChatPanelHeader title={t("Chat:Title")} onBack={onBack} onClose={onClose} />
        {gone ? (
          <ChatStatus text={t("Chat:NoLongerMember")} />
        ) : (
          <ChatStatus text={t("Chat:LoadError")} onRetry={() => void refetch()} />
        )}
      </>
    );
  }

  const isGroup = conversation?.kind === CHAT_KIND.Group;

  // Pages and their items run newest first.
  const handleEditLast = () => {
    const now = Date.now();
    const last = messagePages?.pages
      .flatMap((page) => page.items)
      .find((message) => message.isMine && isStillEditable(message, now));
    if (last) setEditing(last);
  };

  const handlePick = (message: ChatMessageDto) => {
    setSearching(false);
    setFocusMessageId(message.id);
  };

  const actions = (
    <>
      <button
        type="button"
        className={["chat-icon-button", searching && "chat-icon-button--active"].filter(Boolean).join(" ")}
        aria-label={t("Chat:SearchMessages")}
        aria-pressed={searching}
        title={t("Chat:SearchMessages")}
        onClick={() => setSearching((current) => !current)}
      >
        <Search size={18} aria-hidden />
      </button>
      {isGroup && <ThreadMenu conversation={conversation} onLeft={onBack} />}
    </>
  );

  return (
    <>
      <ChatPanelHeader
        title={conversation?.title ?? ""}
        subtitle={isGroup ? t("Chat:Members", conversation.members.length) : undefined}
        onBack={onBack}
        onClose={onClose}
        actions={actions}
      />
      {searching ? (
        <MessageSearch conversationId={conversationId} onPick={handlePick} onClose={() => setSearching(false)} />
      ) : (
        <>
          <MessageList
            conversationId={conversationId}
            showSenders={isGroup}
            onEdit={setEditing}
            focusMessageId={focusMessageId}
            onFocused={handleFocused}
          />
          <ChatComposer
            conversationId={conversationId}
            editing={editing}
            onEditingChange={setEditing}
            onEditLast={handleEditLast}
          />
        </>
      )}
    </>
  );
};
