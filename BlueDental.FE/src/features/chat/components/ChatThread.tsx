import React, { useCallback, useState } from "react";
import { FolderOpen, Search } from "lucide-react";
import { describeApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { useChatConversation, useChatMessages } from "../api/chatQueries";
import { isStillEditable } from "../hooks/useEditWindow";
import { useMarkReadWhenUnread } from "../hooks/useMarkReadWhenUnread";
import { CHAT_KIND, type ChatMemberDto, type ChatMessageDto } from "../types";
import { ChatComposer } from "./ChatComposer";
import { ChatPanelHeader } from "./ChatPanelHeader";
import { ChatStatus } from "./ChatStatus";
import { MessageList } from "./MessageList";
import { MessageSearch } from "./MessageSearch";
import { SharedLibrary } from "./SharedLibrary";
import { ThreadMenu } from "./ThreadMenu";

/** Until the conversation loads: nobody has read anything. */
const NO_MEMBERS: readonly ChatMemberDto[] = [];

interface ChatThreadProps {
  conversationId: string;
  onBack: () => void;
  onClose: () => void;
}

/**
 * One conversation: its messages, newest at the bottom, and the composer.
 * The magnifier swaps them for a search of the thread, the folder for its
 * Kho lưu trữ (R-1160); a picked result or item brings the thread back
 * scrolled to its message.
 */
type ThreadView = "thread" | "search" | "library";

export const ChatThread: React.FC<ChatThreadProps> = ({ conversationId, onBack, onClose }) => {
  const { data: conversation, error, refetch } = useChatConversation(conversationId);
  const { data: messagePages } = useChatMessages(conversationId);
  const [editing, setEditing] = useState<ChatMessageDto | null>(null);
  const [view, setView] = useState<ThreadView>("thread");
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

  const handleJump = (messageId: string) => {
    setView("thread");
    setFocusMessageId(messageId);
  };

  const toggleView = (next: ThreadView) => setView((current) => (current === next ? "thread" : next));

  const actions = (
    <>
      <ViewButton label={t("Chat:SearchMessages")} pressed={view === "search"} onClick={() => toggleView("search")}>
        <Search size={18} aria-hidden />
      </ViewButton>
      <ViewButton label={t("Chat:Library")} pressed={view === "library"} onClick={() => toggleView("library")}>
        <FolderOpen size={18} aria-hidden />
      </ViewButton>
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
      {view === "search" && (
        <MessageSearch
          conversationId={conversationId}
          onPick={(message) => handleJump(message.id)}
          onClose={() => setView("thread")}
        />
      )}
      {view === "library" && conversation && <SharedLibrary conversation={conversation} onJump={handleJump} />}
      {view === "thread" && (
        <>
          <MessageList
            conversationId={conversationId}
            isGroup={isGroup}
            members={conversation?.members ?? NO_MEMBERS}
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

interface ViewButtonProps {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

/** A header toggle that swaps the thread for another view of it. */
function ViewButton({ label, pressed, onClick, children }: ViewButtonProps) {
  return (
    <button
      type="button"
      className={["chat-icon-button", pressed && "chat-icon-button--active"].filter(Boolean).join(" ")}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
