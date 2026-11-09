import React from "react";
import { MessageCircleWarning } from "lucide-react";
import { t } from "@/lib/i18n";

interface ChatDockFallbackProps {
  onRetry: () => void;
}

/** Stands in for the header button after a render error: the page stays usable, a click brings chat back. */
export const ChatDockFallback: React.FC<ChatDockFallbackProps> = ({ onRetry }) => (
  <button
    type="button"
    className="app-header-icon-btn chat-dock-button--failed"
    aria-label={t("Chat:DockFailed")}
    title={t("Chat:DockFailed")}
    onClick={onRetry}
  >
    <MessageCircleWarning size={18} strokeWidth={1.8} aria-hidden />
  </button>
);
