import React from "react";
import { MessageSquareText } from "lucide-react";
import { t } from "@/lib/i18n";

interface SharedJumpButtonProps {
  onClick: () => void;
}

/** Back to the thread, scrolled to the message that carried the item. */
export const SharedJumpButton: React.FC<SharedJumpButtonProps> = ({ onClick }) => (
  <button
    type="button"
    className="chat-shared-jump"
    aria-label={t("Chat:GoToMessage")}
    title={t("Chat:GoToMessage")}
    onClick={onClick}
  >
    <MessageSquareText size={15} aria-hidden />
  </button>
);
