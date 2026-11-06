import React from "react";
import { ArrowLeft, X } from "lucide-react";
import { t } from "@/lib/i18n";

interface ChatPanelHeaderProps {
  title: string;
  subtitle?: string;
  /** Shown as a back arrow before the title; the list view has none. */
  onBack?: () => void;
  onClose: () => void;
  /** Buttons between the title and the close cross. */
  actions?: React.ReactNode;
}

export const ChatPanelHeader: React.FC<ChatPanelHeaderProps> = ({ title, subtitle, onBack, onClose, actions }) => (
  <header className="chat-panel-header">
    {onBack && (
      <button type="button" className="chat-icon-button" aria-label={t("Chat:Back")} onClick={onBack}>
        <ArrowLeft size={18} aria-hidden />
      </button>
    )}
    <div className="chat-panel-heading">
      <h2 className="chat-panel-title" title={title}>
        {title}
      </h2>
      {subtitle && <span className="chat-panel-subtitle">{subtitle}</span>}
    </div>
    {actions}
    <button type="button" className="chat-icon-button" aria-label={t("Chat:Close")} onClick={onClose}>
      <X size={18} aria-hidden />
    </button>
  </header>
);
