import React, { useCallback, useMemo, useRef } from "react";
import { Button } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { useChatMessages } from "../api/chatQueries";
import { useJumpToMessage } from "../hooks/useJumpToMessage";
import { useStickToBottom } from "../hooks/useStickToBottom";
import type { ChatMessageDto } from "../types";
import { ChatSpinner } from "./ChatSpinner";
import { ChatStatus } from "./ChatStatus";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  conversationId: string;
  /** Group chats name the sender above each run of their messages. */
  showSenders: boolean;
  onEdit: (message: ChatMessageDto) => void;
  /** A search result to scroll to and flash; loads older pages until it is there. */
  focusMessageId: string | null;
  onFocused: () => void;
}

/** The thread, oldest at the top; older pages load on request. */
export const MessageList: React.FC<MessageListProps> = ({
  conversationId,
  showSenders,
  onEdit,
  focusMessageId,
  onFocused,
}) => {
  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useChatMessages(conversationId);
  const messages = useMemo(() => (data ? data.pages.flatMap((page) => page.items).reverse() : []), [data]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const newest = messages.at(-1);
  const { unpin } = useStickToBottom(scrollRef, contentRef, newest?.id, newest?.isMine ?? false);
  const loadedIds = useMemo(() => messages.map((message) => message.id), [messages]);
  const loadOlder = useCallback(() => void fetchNextPage(), [fetchNextPage]);
  useJumpToMessage(scrollRef, {
    messageId: focusMessageId,
    loadedIds,
    hasOlder: hasNextPage,
    loadingOlder: isLoading || isFetchingNextPage,
    loadOlder,
    onShown: unpin,
    onDone: onFocused,
  });

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
        {isLoading && <ChatSpinner />}
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
