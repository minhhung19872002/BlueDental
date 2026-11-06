import React from "react";
import { Button } from "antd";
import { t } from "@/lib/i18n";

interface ChatStatusProps {
  text: string;
  /** Given for a failed load: a retry button follows the text. */
  onRetry?: () => void;
}

/** A centred line for an empty list, an empty thread or a failed load. */
export const ChatStatus: React.FC<ChatStatusProps> = ({ text, onRetry }) => (
  <div className="chat-status" role={onRetry ? "alert" : undefined}>
    <p>{text}</p>
    {onRetry && (
      <Button size="small" onClick={onRetry}>
        {t("Chat:Retry")}
      </Button>
    )}
  </div>
);
