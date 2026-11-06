import React from "react";
import { MessageCircleWarning } from "lucide-react";
import { t } from "@/lib/i18n";

interface ChatDockFallbackProps {
  onRetry: () => void;
}

/** Stands in for the dock after a render error: the page stays usable, a click brings chat back. */
export const ChatDockFallback: React.FC<ChatDockFallbackProps> = ({ onRetry }) => (
  <div className="chat-dock">
    <button
      type="button"
      className="chat-dock-button chat-dock-button--failed"
      aria-label={t("Chat:DockFailed")}
      title={t("Chat:DockFailed")}
      onClick={onRetry}
    >
      <MessageCircleWarning size={24} aria-hidden />
    </button>
  </div>
);
