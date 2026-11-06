import React, { useState } from "react";
import { Button, Input, Modal } from "antd";
import { t } from "@/lib/i18n";
import { useRenameChat } from "../api/chatMutations";
import { CHAT_LIMITS, type ChatConversationDto } from "../types";

interface RenameGroupDialogProps {
  conversation: ChatConversationDto;
  onClose: () => void;
}

export const RenameGroupDialog: React.FC<RenameGroupDialogProps> = ({ conversation, onClose }) => {
  const [name, setName] = useState(conversation.name ?? conversation.title);
  const rename = useRenameChat();
  const trimmed = name.trim();

  const handleSave = () => {
    rename.mutate({ id: conversation.id, name: trimmed }, { onSuccess: onClose });
  };

  const footer = (
    <>
      <Button onClick={onClose}>{t("Chat:Cancel")}</Button>
      <Button type="primary" loading={rename.isPending} disabled={!trimmed || rename.isPending} onClick={handleSave}>
        {t("Chat:Save")}
      </Button>
    </>
  );

  return (
    <Modal open title={t("Chat:Rename")} onCancel={onClose} footer={footer} width={420} destroyOnHidden>
      <label className="chat-field">
        <span className="chat-field-label">
          {t("Chat:GroupName")} <span className="chat-required">*</span>
        </span>
        <Input
          autoFocus
          value={name}
          maxLength={CHAT_LIMITS.maxGroupNameLength}
          onChange={(event) => setName(event.target.value)}
          onPressEnter={() => trimmed && handleSave()}
        />
      </label>
    </Modal>
  );
};
