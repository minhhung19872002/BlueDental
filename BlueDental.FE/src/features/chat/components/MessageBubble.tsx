import React from "react";
import { t } from "@/lib/i18n";
import type { ChatMessageDto } from "../types";
import { formatMessageTime } from "../utils/chatFormat";
import { MessageActions } from "./MessageActions";
import { MessageAttachments } from "./MessageAttachments";

interface MessageBubbleProps {
  message: ChatMessageDto;
  showSender: boolean;
  onEdit: (message: ChatMessageDto) => void;
}

/**
 * One message. Text is rendered as text (React escapes it), never as HTML.
 * A recalled message keeps its place and reads "Tin nhắn đã được thu hồi".
 */
export const MessageBubble = React.memo(function MessageBubble({ message, showSender, onEdit }: MessageBubbleProps) {
  const className = [
    "chat-message",
    message.isMine && "chat-message--mine",
    message.isRecalled && "chat-message--recalled",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} data-message-id={message.id}>
      {showSender && <span className="chat-message-sender">{message.senderName}</span>}
      <div className="chat-message-row">
        {message.isMine && !message.isRecalled && <MessageActions message={message} onEdit={onEdit} />}
        <div className="chat-bubble">
          {message.isRecalled ? (
            <p className="chat-bubble-text">{t("Chat:Recalled")}</p>
          ) : (
            <>
              {message.content && <p className="chat-bubble-text">{message.content}</p>}
              {message.attachments.length > 0 && (
                <MessageAttachments messageId={message.id} attachments={message.attachments} />
              )}
            </>
          )}
        </div>
      </div>
      <span className="chat-message-meta">
        {formatMessageTime(message.sentAt)}
        {message.editedAt && !message.isRecalled && ` · ${t("Chat:Edited")}`}
      </span>
    </div>
  );
});
