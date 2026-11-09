import React from "react";
import { MessageCircle } from "lucide-react";
import { t } from "@/lib/i18n";

interface ChatDockButtonProps {
  open: boolean;
  unreadCount: number;
  onToggle: () => void;
}

/** The header chat button; its red badge counts unread messages in the branch shown. */
export const ChatDockButton: React.FC<ChatDockButtonProps> = ({ open, unreadCount, onToggle }) => (
  <button
    type="button"
    className={["app-header-icon-btn", open && "chat-dock-button--open"].filter(Boolean).join(" ")}
    aria-label={t("Chat:Open")}
    aria-expanded={open}
    title={t("Chat:Title")}
    onClick={onToggle}
  >
    <MessageCircle size={18} strokeWidth={1.8} aria-hidden />
    {unreadCount > 0 && <span className="chat-dock-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
  </button>
);
