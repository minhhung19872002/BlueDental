import React, { useCallback, useMemo } from "react";
import { useLoadMoreSentinel } from "@/hooks/useLoadMoreSentinel";
import { t } from "@/lib/i18n";
import { useChatSharedFiles } from "../api/chatQueries";
import { CHAT_SHARED_KIND, type ChatSharedFileDto, type ChatSharedFilter, type ChatSharedKind } from "../types";
import { groupByDay, type SharedPicking } from "../utils/chatShared";
import { ChatSpinner } from "./ChatSpinner";
import { ChatStatus } from "./ChatStatus";
import { SharedDayList } from "./SharedDayList";
import { SharedFileRow } from "./SharedFileRow";
import { SharedMediaTile } from "./SharedMediaTile";

interface SharedFileTabProps {
  conversationId: string;
  kind: ChatSharedKind;
  filter: ChatSharedFilter;
  /** A filter is set, so an empty list means "nothing matches", not "nothing sent". */
  filtered: boolean;
  picking: SharedPicking;
  onJump: (messageId: string) => void;
}

/** The Ảnh or File tab: newest first, a page at a time as the list is scrolled. */
export const SharedFileTab: React.FC<SharedFileTabProps> = ({
  conversationId,
  kind,
  filter,
  filtered,
  picking,
  onJump,
}) => {
  const { data, isPending, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = useChatSharedFiles(
    conversationId,
    kind,
    filter,
  );
  const groups = useMemo(() => groupByDay(data?.pages.flatMap((page) => page.items) ?? []), [data]);
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage]);
  const sentinelRef = useLoadMoreSentinel(Boolean(hasNextPage) && !isFetchingNextPage && !isError, loadMore);
  const isMedia = kind === CHAT_SHARED_KIND.Media;

  if (isPending) return <ChatSpinner />;
  if (isError && !data) return <ChatStatus text={t("Chat:LoadError")} onRetry={() => void refetch()} />;
  if (groups.length === 0) {
    const empty = filtered ? "Chat:NoSharedMatch" : isMedia ? "Chat:NoSharedMedia" : "Chat:NoSharedFiles";
    return <ChatStatus text={t(empty)} />;
  }

  const renderItem = (file: ChatSharedFileDto) =>
    isMedia ? (
      <SharedMediaTile key={file.attachment.id} file={file} picking={picking} onJump={onJump} />
    ) : (
      <SharedFileRow key={file.attachment.id} file={file} picking={picking} onJump={onJump} />
    );

  return (
    <>
      <SharedDayList groups={groups} layout={isMedia ? "grid" : "rows"} renderItem={renderItem} />
      <div ref={sentinelRef} className="chat-shared-sentinel" />
      {isFetchingNextPage && <ChatSpinner size="small" />}
    </>
  );
};
