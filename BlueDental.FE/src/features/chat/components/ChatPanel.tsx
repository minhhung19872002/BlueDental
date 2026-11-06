import React, { useState } from "react";
import { t } from "@/lib/i18n";
import { ChatThread } from "./ChatThread";
import { ConversationList } from "./ConversationList";

interface ChatPanelProps {
  branchId: string | undefined;
  onClose: () => void;
}

/**
 * The chat window docked to the right edge: the conversation list, or one
 * thread with a way back to it.
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({ branchId, onClose }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const handleBack = () => setActiveId(null);

  return (
    <aside className="chat-panel" aria-label={t("Chat:Title")}>
      {activeId ? (
        <ChatThread key={activeId} conversationId={activeId} onBack={handleBack} onClose={onClose} />
      ) : (
        <ConversationList branchId={branchId} onOpen={setActiveId} onClose={onClose} />
      )}
    </aside>
  );
};
