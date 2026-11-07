import React from "react";
import { t } from "@/lib/i18n";
import { ChatThread } from "./ChatThread";
import { ConversationList } from "./ConversationList";

interface ChatPanelProps {
  branchId: string | undefined;
  /** The open thread; the dock owns it so a toast can open one (R-1165). */
  activeId: string | null;
  onActiveChange: (conversationId: string | null) => void;
  onClose: () => void;
}

/**
 * The chat window docked to the right edge: the conversation list, or one
 * thread with a way back to it.
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({ branchId, activeId, onActiveChange, onClose }) => {
  const handleBack = () => onActiveChange(null);

  return (
    <aside className="chat-panel" aria-label={t("Chat:Title")}>
      {activeId ? (
        <ChatThread key={activeId} conversationId={activeId} onBack={handleBack} onClose={onClose} />
      ) : (
        <ConversationList branchId={branchId} onOpen={onActiveChange} onClose={onClose} />
      )}
    </aside>
  );
};
