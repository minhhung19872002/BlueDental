import React, { useState } from "react";
import { Dropdown, type MenuProps } from "antd";
import { MoreVertical } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { t } from "@/lib/i18n";
import { useRecallChatMessage } from "../api/chatMutations";
import type { ChatMessageDto } from "../types";

interface MessageActionsProps {
  message: ChatMessageDto;
  onEdit: (message: ChatMessageDto) => void;
}

/** "Sửa" / "Thu hồi" on the caller's own message; recalling asks first. */
export const MessageActions: React.FC<MessageActionsProps> = ({ message, onEdit }) => {
  const [confirming, setConfirming] = useState(false);
  const recall = useRecallChatMessage();

  const items: MenuProps["items"] = [
    ...(message.content ? [{ key: "edit", label: t("Chat:Edit") }] : []),
    { key: "recall", label: t("Chat:Recall"), danger: true },
  ];

  const handleMenu: MenuProps["onClick"] = ({ key }) => {
    if (key === "edit") onEdit(message);
    if (key === "recall") setConfirming(true);
  };

  const handleRecall = () => {
    recall.mutate(message.id, { onSettled: () => setConfirming(false) });
  };

  return (
    <>
      <Dropdown menu={{ items, onClick: handleMenu }} trigger={["click"]} placement="bottomRight">
        <button type="button" className="chat-message-actions" aria-label={t("Chat:MessageActions")}>
          <MoreVertical size={16} aria-hidden />
        </button>
      </Dropdown>
      <ConfirmDialog
        open={confirming}
        title={t("Chat:Recall")}
        message={t("Chat:RecallConfirm")}
        confirmLabel={t("Chat:Recall")}
        cancelLabel={t("Chat:Cancel")}
        pending={recall.isPending}
        onConfirm={handleRecall}
        onClose={() => setConfirming(false)}
      />
    </>
  );
};
