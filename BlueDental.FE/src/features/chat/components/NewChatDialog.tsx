import React, { useState } from "react";
import { Button, Input, Modal, Segmented } from "antd";
import { t } from "@/lib/i18n";
import { useCreateGroupChat, useOpenDirectChat } from "../api/chatMutations";
import { CHAT_LIMITS, type ChatContactDto } from "../types";
import { ContactPicker } from "./ContactPicker";
import { SelectedContacts } from "./SelectedContacts";

type NewChatMode = "direct" | "group";

interface NewChatDialogProps {
  branchId: string | undefined;
  onOpened: (conversationId: string) => void;
  onCancel: () => void;
}

/**
 * Start a chat: a click on someone opens (or reopens) the two-person chat;
 * "Tạo nhóm" takes a name and the people to add. Anyone may make a group.
 */
export const NewChatDialog: React.FC<NewChatDialogProps> = ({ branchId, onOpened, onCancel }) => {
  const [mode, setMode] = useState<NewChatMode>("direct");
  const [name, setName] = useState("");
  const [members, setMembers] = useState<ChatContactDto[]>([]);
  const openDirect = useOpenDirectChat();
  const createGroup = useCreateGroupChat();
  const busy = openDirect.isPending || createGroup.isPending;
  const canCreate = name.trim().length > 0 && members.length > 0;

  const handlePickDirect = (contact: ChatContactDto) => {
    openDirect.mutate(contact.id, { onSuccess: (conversation) => onOpened(conversation.id) });
  };

  const handleToggleMember = (contact: ChatContactDto) => {
    setMembers((current) =>
      current.some((m) => m.id === contact.id) ? current.filter((m) => m.id !== contact.id) : [...current, contact],
    );
  };

  const handleCreateGroup = () => {
    createGroup.mutate(
      { name: name.trim(), memberIds: members.map((m) => m.id) },
      { onSuccess: (conversation) => onOpened(conversation.id) },
    );
  };

  const footer =
    mode === "group" ? (
      <>
        <Button onClick={onCancel}>{t("Chat:Cancel")}</Button>
        <Button type="primary" disabled={!canCreate || busy} loading={createGroup.isPending} onClick={handleCreateGroup}>
          {t("Chat:CreateGroup")}
        </Button>
      </>
    ) : (
      <Button onClick={onCancel}>{t("Chat:Cancel")}</Button>
    );

  return (
    <Modal open title={t("Chat:New")} onCancel={onCancel} footer={footer} width={460} destroyOnHidden>
      <div className="chat-new">
        <Segmented<NewChatMode>
          block
          value={mode}
          onChange={setMode}
          options={[
            { value: "direct", label: t("Chat:Direct") },
            { value: "group", label: t("Chat:Group") },
          ]}
        />
        {mode === "group" && (
          <>
            <label className="chat-field">
              <span className="chat-field-label">
                {t("Chat:GroupName")} <span className="chat-required">*</span>
              </span>
              <Input
                value={name}
                maxLength={CHAT_LIMITS.maxGroupNameLength}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("Chat:GroupNamePlaceholder")}
              />
            </label>
            <SelectedContacts contacts={members} onRemove={handleToggleMember} />
          </>
        )}
        <ContactPicker
          branchId={branchId}
          selectedIds={mode === "group" ? members.map((m) => m.id) : undefined}
          onPick={mode === "group" ? handleToggleMember : handlePickDirect}
          disabled={busy}
        />
      </div>
    </Modal>
  );
};
