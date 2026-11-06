import React, { useMemo, useState } from "react";
import { Button } from "antd";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { t } from "@/lib/i18n";
import { useSharedSelection } from "../hooks/useSharedSelection";
import { CHAT_SHARED_KIND, type ChatConversationDto } from "../types";
import {
  EMPTY_SHARED_FILTER,
  isFiltered,
  toSharedFilter,
  type SharedFilterState,
  type SharedPick,
  type SharedPicking,
} from "../utils/chatShared";
import { SharedFileTab } from "./SharedFileTab";
import { SharedFilters } from "./SharedFilters";
import { SharedLinkTab } from "./SharedLinkTab";
import { SharedSelectionBar } from "./SharedSelectionBar";

type LibraryTab = "media" | "file" | "link";

interface SharedLibraryProps {
  conversation: ChatConversationDto;
  /** An item's "Xem tin nhắn": the thread comes back scrolled to its message. */
  onJump: (messageId: string) => void;
}

/**
 * Kho lưu trữ (R-1160): the pictures, files and links sent in one
 * conversation, by day, filtered by who sent them and when. Recalled
 * messages take theirs away. "Chọn" ticks several to download or copy.
 */
export const SharedLibrary: React.FC<SharedLibraryProps> = ({ conversation, onJump }) => {
  const [tab, setTab] = useState<LibraryTab>("media");
  const [filterState, setFilterState] = useState<SharedFilterState>(EMPTY_SHARED_FILTER);
  const { selecting, setMode, selected, toggle, clear } = useSharedSelection<SharedPick>();
  const filter = useMemo(() => toSharedFilter(filterState), [filterState]);
  const filtered = isFiltered(filterState);
  const picking = useMemo<SharedPicking>(() => ({ selecting, selected, toggle }), [selecting, selected, toggle]);

  const tabs = [
    { key: "media" as const, label: t("Chat:LibraryMedia") },
    { key: "file" as const, label: t("Chat:LibraryFiles") },
    { key: "link" as const, label: t("Chat:LibraryLinks") },
  ];

  const handleTab = (next: LibraryTab) => {
    setTab(next);
    setMode(false);
  };

  const handleFilter = (next: SharedFilterState) => {
    setFilterState(next);
    clear();
  };

  const body =
    tab === "link" ? (
      <SharedLinkTab
        conversationId={conversation.id}
        filter={filter}
        filtered={filtered}
        picking={picking}
        onJump={onJump}
      />
    ) : (
      <SharedFileTab
        key={tab}
        conversationId={conversation.id}
        kind={tab === "media" ? CHAT_SHARED_KIND.Media : CHAT_SHARED_KIND.File}
        filter={filter}
        filtered={filtered}
        picking={picking}
        onJump={onJump}
      />
    );

  return (
    <div className="chat-shared" aria-label={t("Chat:Library")} role="region">
      <div className="chat-shared-toolbar">
        <SegmentedTabs items={tabs} activeKey={tab} onChange={handleTab} className="chat-shared-tabs" />
        <Button aria-pressed={selecting} onClick={() => setMode(!selecting)}>
          {selecting ? t("Common:Cancel") : t("Chat:Select")}
        </Button>
      </div>
      <SharedFilters members={conversation.members} value={filterState} onChange={handleFilter} />
      <div className="chat-shared-body">
        {body}
      </div>
      {selecting && <SharedSelectionBar selected={selected} onDone={() => setMode(false)} />}
    </div>
  );
};
