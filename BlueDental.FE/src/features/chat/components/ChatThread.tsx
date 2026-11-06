import React, { useState } from "react";
import { t } from "@/lib/i18n";
import { useChatConversation } from "../api/chatQueries";
import { useMarkReadWhenUnread } from "../hooks/useMarkReadWhenUnread";
import { CHAT_KIND, type ChatMessageDto } from "../types";
import { ChatComposer } from "./ChatComposer";
import { ChatPanelHeader } from "./ChatPanelHeader";
import { ChatStatus } from "./ChatStatus";
import { MessageList } from "./MessageList";
import { ThreadMenu } from "./ThreadMenu";

interface ChatThreadProps {
  conversationId: string;
  onBack: () => void;
  onClose: () => void;
}

/** One conversation: its messages, newest at the bottom, and the composer. */
export const ChatThread: React.FC<ChatThreadProps> = ({ conversationId, onBack, onClose }) => {
  const { data: conversation, isError, refetch } = useChatConversation(conversationId);
  const [editing, setEditing] = useState<ChatMessageDto | null>(null);
  useMarkReadWhenUnread(conversationId, conversation?.unreadCount ?? 0);

  if (isError) {
    return (
      <>
        <ChatPanelHeader title={t("Chat:Title")} onBack={onBack} onClose={onClose} />
        <ChatStatus text={t("Chat:LoadError")} onRetry={() => void refetch()} />
      </>
    );
  }

  const isGroup = conversation?.kind === CHAT_KIND.Group;

  return (
    <>
      <ChatPanelHeader
        title={conversation?.title ?? ""}
        subtitle={isGroup ? t("Chat:Members", conversation.members.length) : undefined}
        onBack={onBack}
        onClose={onClose}
        actions={isGroup && <ThreadMenu conversation={conversation} onLeft={onBack} />}
      />
      <MessageList conversationId={conversationId} showSenders={isGroup} onEdit={setEditing} />
      <ChatComposer
        conversationId={conversationId}
        editing={editing}
        onEditDone={() => setEditing(null)}
      />
    </>
  );
};
