import React, { useState } from "react";
import { Input, Spin } from "antd";
import { Search, SquarePen } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { t } from "@/lib/i18n";
import { useChatConversations } from "../api/chatQueries";
import type { ChatConversationDto } from "../types";
import { ChatPanelHeader } from "./ChatPanelHeader";
import { ChatStatus } from "./ChatStatus";
import { ConversationRow } from "./ConversationRow";
import { NewChatDialog } from "./NewChatDialog";

interface ConversationListProps {
  branchId: string | undefined;
  onOpen: (conversationId: string) => void;
  onClose: () => void;
}

/** The caller's conversations, latest activity first, with a search box. */
export const ConversationList: React.FC<ConversationListProps> = ({ branchId, onOpen, onClose }) => {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const filter = useDebounce(search.trim());
  const { data, isLoading, isError, refetch } = useChatConversations(branchId, filter);

  const handleOpened = (conversationId: string) => {
    setCreating(false);
    onOpen(conversationId);
  };

  const newButton = (
    <button
      type="button"
      className="chat-icon-button"
      aria-label={t("Chat:New")}
      title={t("Chat:New")}
      onClick={() => setCreating(true)}
    >
      <SquarePen size={18} aria-hidden />
    </button>
  );

  return (
    <>
      <ChatPanelHeader title={t("Chat:Title")} onClose={onClose} actions={newButton} />
      <div className="chat-search">
        <Input
          allowClear
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("Chat:Search")}
          prefix={<Search size={15} aria-hidden />}
          aria-label={t("Chat:Search")}
        />
      </div>
      <div className="chat-panel-body">
        <ConversationItems
          loading={isLoading}
          error={isError}
          onRetry={() => void refetch()}
          emptyText={filter ? t("Chat:NoMatch") : t("Chat:Empty")}
          items={data ?? []}
          onOpen={onOpen}
        />
      </div>
      {creating && <NewChatDialog branchId={branchId} onOpened={handleOpened} onCancel={() => setCreating(false)} />}
    </>
  );
};

interface ConversationItemsProps {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  emptyText: string;
  items: ChatConversationDto[];
  onOpen: (conversationId: string) => void;
}

function ConversationItems({ loading, error, onRetry, emptyText, items, onOpen }: ConversationItemsProps) {
  if (loading) return <Spin className="chat-spin" />;
  if (error) return <ChatStatus text={t("Chat:LoadError")} onRetry={onRetry} />;
  if (items.length === 0) return <ChatStatus text={emptyText} />;
  return (
    <ul className="chat-conversations">
      {items.map((conversation) => (
        <li key={conversation.id}>
          <ConversationRow conversation={conversation} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}
