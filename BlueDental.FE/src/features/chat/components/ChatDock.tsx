import React, { useCallback, useState } from "react";
import { useBranchFilter } from "@/lib/clinicBranch";
import { useChatUnreadCount } from "../api/chatQueries";
import { useChatLive } from "../hooks/useChatLive";
import { useNewMessageAlerts } from "../hooks/useNewMessageAlerts";
import { requestDesktopNotifyPermission } from "../utils/desktopNotify";
import { ChatDockButton } from "./ChatDockButton";
import { ChatPanel } from "./ChatPanel";
import { ChatToastStack } from "./ChatToastStack";
import "./chat.css";

/**
 * Chat nội bộ (F-89, BA 2026-11-06): a round button in the bottom-right
 * corner of every screen, where "Mời lên" used to sit — that dock moves one
 * place left. A click opens the chat beside it, docked to the right edge over
 * the current page; the page itself does not reflow. New messages also show
 * as toasts top right (R-1165); a click on one opens its thread here.
 */
export const ChatDock: React.FC = () => {
  const branchId = useBranchFilter();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shownBranch, setShownBranch] = useState(branchId);
  const unread = useChatUnreadCount(branchId, true);

  // Switching branch drops the thread from the old one.
  if (shownBranch !== branchId) {
    setShownBranch(branchId);
    setActiveId(null);
  }

  const openConversation = useCallback((conversationId: string) => {
    requestDesktopNotifyPermission();
    setOpen(true);
    setActiveId(conversationId);
  }, []);
  const alerts = useNewMessageAlerts({ branchId, viewingId: open ? activeId : null, onOpen: openConversation });
  useChatLive(true, alerts.handleChanged);

  const handleToggle = () => {
    // The browser asks about Windows notifications once, on this click.
    if (!open) requestDesktopNotifyPermission();
    setOpen((value) => !value);
    setActiveId(null);
  };
  const handleClose = () => {
    setOpen(false);
    setActiveId(null);
  };

  return (
    <>
      <div className="chat-dock">
        <ChatDockButton open={open} unreadCount={unread.data?.count ?? 0} onToggle={handleToggle} />
      </div>
      <ChatToastStack alerts={alerts.alerts} onOpen={openConversation} onDismiss={alerts.dismiss} />
      {open && (
        <ChatPanel
          key={branchId ?? "all"}
          branchId={branchId}
          activeId={activeId}
          onActiveChange={setActiveId}
          onClose={handleClose}
        />
      )}
    </>
  );
};
