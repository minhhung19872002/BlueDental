import React, { useState } from "react";
import { useBranchFilter } from "@/lib/clinicBranch";
import { useChatUnreadCount } from "../api/chatQueries";
import { useChatLive } from "../hooks/useChatLive";
import { ChatDockButton } from "./ChatDockButton";
import { ChatPanel } from "./ChatPanel";
import "./chat.css";

/**
 * Chat nội bộ (F-89, BA 2026-11-06): a round button in the bottom-right
 * corner of every screen, where "Mời lên" used to sit — that dock moves one
 * place left. A click opens the chat beside it, docked to the right edge over
 * the current page; the page itself does not reflow.
 */
export const ChatDock: React.FC = () => {
  const branchId = useBranchFilter();
  const [open, setOpen] = useState(false);
  const unread = useChatUnreadCount(branchId, true);
  useChatLive(true);

  const handleToggle = () => setOpen((value) => !value);
  const handleClose = () => setOpen(false);

  return (
    <>
      <div className="chat-dock">
        <ChatDockButton open={open} unreadCount={unread.data?.count ?? 0} onToggle={handleToggle} />
      </div>
      {/* Keyed by branch: switching branch drops the thread from the old one. */}
      {open && <ChatPanel key={branchId ?? "all"} branchId={branchId} onClose={handleClose} />}
    </>
  );
};
