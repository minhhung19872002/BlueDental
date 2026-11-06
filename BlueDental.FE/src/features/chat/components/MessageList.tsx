import React, { useMemo, useRef } from "react";
import { Button, Spin } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { useChatMessages } from "../api/chatQueries";
import { useStickToBottom } from "../hooks/useStickToBottom";
import type { ChatMessageDto } from "../types";
import { ChatStatus } from "./ChatStatus";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  conversationId: string;
  /** Group chats name the sender above each run of their messages. */
  showSenders: boolean;
  onEdit: (message: ChatMessageDto) => void;
}

/** The thread, oldest at the top; older pages load on request. */
export const MessageList: React.FC<MessageListProps> = ({ conversationId, showSenders, onEdit }) => {
  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useChatMessages(conversationId);
  const messages = useMemo(() => (data ? data.pages.flatMap((page) => page.items).reverse() : []), [data]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const newest = messages.at(-1);
  useStickToBottom(scrollRef, contentRef, newest?.id, newest?.isMine ?? false);

  return (
    <div className="chat-messages" ref={scrollRef}>
      <div className="chat-messages-content" ref={contentRef}>
        {hasNextPage && (
          <Button
            size="small"
            className="chat-load-older"
            loading={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {t("Chat:LoadOlder")}
          </Button>
        )}
        {isLoading && <Spin className="chat-spin" />}
        {isError && <ChatStatus text={t("Chat:LoadError")} onRetry={() => void refetch()} />}
        {!isLoading && !isError && messages.length === 0 && <ChatStatus text={t("Chat:NoMessages")} />}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newDay = !previous || !dayjs(previous.sentAt).isSame(message.sentAt, "day");
          const newSender = newDay || previous.senderId !== message.senderId;
          return (
            <React.Fragment key={message.id}>
              {newDay && <div className="chat-day">{dayjs(message.sentAt).format("DD/MM/YYYY")}</div>}
              <MessageBubble message={message} showSender={showSenders && newSender && !message.isMine} onEdit={onEdit} />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
