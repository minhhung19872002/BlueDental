import React from "react";
import { Users } from "lucide-react";
import { CHAT_KIND, type ChatConversationDto } from "../types";
import { formatChatTime, initialsOf, previewMessage } from "../utils/chatFormat";

interface ConversationRowProps {
  conversation: ChatConversationDto;
  onOpen: (conversationId: string) => void;
}

/** One conversation: avatar, title, last message, time and unread count. */
export const ConversationRow: React.FC<ConversationRowProps> = ({ conversation, onOpen }) => {
  const unread = conversation.unreadCount > 0;
  const isGroup = conversation.kind === CHAT_KIND.Group;

  return (
    <button
      type="button"
      className={["chat-conversation", unread && "chat-conversation--unread"].filter(Boolean).join(" ")}
      onClick={() => onOpen(conversation.id)}
    >
      <span className={["chat-avatar", isGroup && "chat-avatar--group"].filter(Boolean).join(" ")} aria-hidden>
        {isGroup ? <Users size={18} /> : initialsOf(conversation.title)}
      </span>
      <span className="chat-conversation-text">
        <span className="chat-conversation-top">
          <span className="chat-conversation-title">{conversation.title}</span>
          <span className="chat-conversation-time">{formatChatTime(conversation.lastActivityAt)}</span>
        </span>
        <span className="chat-conversation-bottom">
          <span className="chat-conversation-preview">{previewMessage(conversation.lastMessage)}</span>
          {unread && (
            <span className="chat-unread-count">
              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  );
};
