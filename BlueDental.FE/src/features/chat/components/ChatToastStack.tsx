import React from "react";
import { X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { ChatAlert } from "../hooks/useNewMessageAlerts";
import { initialsOf } from "../utils/chatFormat";

interface ChatToastStackProps {
  alerts: ChatAlert[];
  onOpen: (conversationId: string) => void;
  onDismiss: (conversationId: string) => void;
}

interface ChatToastProps {
  alert: ChatAlert;
  onOpen: (conversationId: string) => void;
  onDismiss: (conversationId: string) => void;
}

/**
 * One new-message toast (R-1165). The bar along its foot runs 5 s and the
 * toast leaves when it ends; pointing at the toast or tabbing into it pauses
 * the bar. A newer message in the same conversation restarts it.
 */
const ChatToast: React.FC<ChatToastProps> = ({ alert, onOpen, onDismiss }) => {
  const handleOpen = () => onOpen(alert.conversationId);
  const handleDismiss = () => onDismiss(alert.conversationId);

  return (
    <div className="chat-toast">
      <button type="button" className="chat-toast-body" onClick={handleOpen}>
        <span className="chat-avatar chat-toast-avatar" aria-hidden>
          {initialsOf(alert.senderName)}
        </span>
        <span className="chat-toast-text">
          <span className="chat-toast-title">{alert.title}</span>
          <span className="chat-toast-preview">{alert.preview}</span>
          {alert.unreadCount > 1 && (
            <span className="chat-toast-more">{t("Chat:UnreadInConversation", alert.unreadCount)}</span>
          )}
        </span>
      </button>
      <button
        type="button"
        className="chat-chip-button chat-toast-close"
        aria-label={t("Chat:DismissAlert")}
        title={t("Chat:DismissAlert")}
        onClick={handleDismiss}
      >
        <X size={14} aria-hidden />
      </button>
      <span key={alert.messageId} className="chat-toast-timer" aria-hidden onAnimationEnd={handleDismiss} />
    </div>
  );
};

/** The new-message toasts, top right under the header, newest on top. */
export const ChatToastStack: React.FC<ChatToastStackProps> = ({ alerts, onOpen, onDismiss }) => (
  <section className="chat-toasts" aria-label={t("Chat:NewMessages")} aria-live="polite">
    {alerts.map((alert) => (
      <ChatToast key={alert.conversationId} alert={alert} onOpen={onOpen} onDismiss={onDismiss} />
    ))}
  </section>
);
