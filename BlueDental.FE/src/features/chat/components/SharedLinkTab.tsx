import React, { useMemo } from "react";
import { t } from "@/lib/i18n";
import { useChatSharedLinks } from "../api/chatQueries";
import type { ChatSharedFilter, ChatSharedLinkDto } from "../types";
import { groupByDay, isWebLink, linkKey, type SharedPicking } from "../utils/chatShared";
import { ChatSpinner } from "./ChatSpinner";
import { ChatStatus } from "./ChatStatus";
import { SharedDayList } from "./SharedDayList";
import { SharedLinkRow } from "./SharedLinkRow";

interface SharedLinkTabProps {
  conversationId: string;
  filter: ChatSharedFilter;
  filtered: boolean;
  picking: SharedPicking;
  onJump: (messageId: string) => void;
}

/**
 * The Link tab. Links sit inside the encrypted text, so the server reads the
 * 5,000 newest messages (of the filter) for them and says when it stopped short.
 */
export const SharedLinkTab: React.FC<SharedLinkTabProps> = ({ conversationId, filter, filtered, picking, onJump }) => {
  const { data, isPending, isError, refetch } = useChatSharedLinks(conversationId, filter);
  const groups = useMemo(() => groupByDay(data?.items.filter((link) => isWebLink(link.url)) ?? []), [data]);

  if (isPending) return <ChatSpinner />;
  if (isError && !data) return <ChatStatus text={t("Chat:LoadError")} onRetry={() => void refetch()} />;
  if (groups.length === 0 && data.isComplete) {
    return <ChatStatus text={t(filtered ? "Chat:NoSharedMatch" : "Chat:NoSharedLinks")} />;
  }

  const renderItem = (link: ChatSharedLinkDto) => (
    <SharedLinkRow key={linkKey(link)} link={link} picking={picking} onJump={onJump} />
  );

  return (
    <>
      <SharedDayList groups={groups} layout="rows" renderItem={renderItem} />
      {!data.isComplete && <p className="chat-search-note">{t("Chat:LinksPartial")}</p>}
    </>
  );
};
