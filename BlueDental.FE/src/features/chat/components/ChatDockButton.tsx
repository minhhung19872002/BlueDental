import React from "react";
import { MessageCircle } from "lucide-react";
import { t } from "@/lib/i18n";

interface ChatDockButtonProps {
  open: boolean;
  unreadCount: number;
  onToggle: () => void;
}

/**
 * The header chat button: a round blue-to-violet badge with a white filled bubble (R-1182), so it reads as
 * "chat" at a glance beside the grey header icons. Its red badge counts unread messages in the branch shown.
 */
export const ChatDockButton: React.FC<ChatDockButtonProps> = ({ open, unreadCount, onToggle }) => (
  <button
    type="button"
    className={["app-header-icon-btn", "chat-dock-button", open && "chat-dock-button--open"].filter(Boolean).join(" ")}
    aria-label={t("Chat:Open")}
    aria-expanded={open}
    title={t("Chat:Title")}
    onClick={onToggle}
  >
    <MessageCircle size={18} strokeWidth={1.8} fill="currentColor" aria-hidden />
    {unreadCount > 0 && <span className="chat-dock-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
  </button>
);
