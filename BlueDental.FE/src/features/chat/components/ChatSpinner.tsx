import React from "react";
import { Spin } from "antd";
import { t } from "@/lib/i18n";

interface ChatSpinnerProps {
  size?: "small" | "default";
}

/** The one loading mark of the chat panel, centred in whatever it fills. */
export const ChatSpinner: React.FC<ChatSpinnerProps> = ({ size = "default" }) => (
  <div className="chat-spin" role="status" aria-label={t("Common:Loading")}>
    <Spin size={size} />
  </div>
);
